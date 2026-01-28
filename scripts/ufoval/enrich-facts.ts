/**
 * UFOVAL - Enrich FACTS (accommodation + geography) from stay pages
 * TARGETED: extracts structured facts WITHOUT modifying marketing texts
 *
 * Usage:
 *   npx tsx scripts/ufoval/enrich-facts.ts --dry-run --limit 5          # Audit only
 *   npx tsx scripts/ufoval/enrich-facts.ts --write --limit 10           # Apply to DB
 *   npx tsx scripts/ufoval/enrich-facts.ts --dry-run --slug=xxx --debug # Debug specific stay
 *
 * FACTS extracted:
 * - geoLabel: clean location name
 * - geoPrecision: zone/ambiance (montagne, bord de mer, forêt, etc.)
 * - accommodationLabel: venue/centre name
 * - accommodationType: centre, camping, auberge, gîte, etc.
 * - accommodationFacts: structured list (chambres, sanitaires, équipements)
 * - meetingPoint: RDV point / dépôt sur place
 * - sourceFacts: raw scraped + metadata
 * - factsSyncedAt: timestamp
 */
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const WRITE = args.includes('--write');
const DEBUG = args.includes('--debug');
const LIMIT_MATCH = args.find(a => a.startsWith('--limit='));
const SLUG_MATCH = args.find(a => a.startsWith('--slug='));
const LIMIT = LIMIT_MATCH ? Number.parseInt(LIMIT_MATCH.split('=')[1], 10) : undefined;
const SLUG = SLUG_MATCH ? SLUG_MATCH.split('=')[1] : undefined;

if (!DRY_RUN && !WRITE) {
  console.error('❌ Please specify --dry-run or --write');
  process.exit(1);
}

console.log(`🚀 Mode: ${DRY_RUN ? 'DRY-RUN (audit only)' : 'WRITE (apply to DB)'}`);
if (LIMIT) console.log(`📊 Limit: ${LIMIT} stays`);
if (SLUG) console.log(`🎯 Slug filter: ${SLUG}`);
if (DEBUG) console.log(`🐛 Debug mode: verbose output`);

// Types pour les faits extraits
type AccommodationFact = {
  category: string;  // e.g., "chambres", "sanitaires", "équipements"
  items: string[];   // e.g., ["4 lits", "douche", "wc séparé"]
};

type CheerioSelector = ReturnType<typeof cheerio.load>;

type ExtractedFacts = {
  geoLabel?: string | null;
  geoPrecision?: string | null;
  accommodationLabel?: string | null;
  accommodationType?: string | null;
  accommodationFacts?: AccommodationFact[];
  meetingPoint?: string | null;
  rawHtml?: string;  // Only stored in sourceFacts
  debugInfo?: {
    geoLabelSource?: string;
    geoPrecisionSource?: string;
    accommodationTypeSource?: string;
  };
};

/**
 * Normaliser le texte (trim, espaces insécables, etc.)
 */
function norm(s: string): string {
  return String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// RÈGLE A — GeoLabel Quality Guard
// ============================================================================
// On n'accepte geoLabel que si :
// - longueur >= 4 caractères
// - contient au moins une majuscule OU un mot "lieu" crédible
// - n'est pas dans une blacklist ("son", "danger", "proximit", "nager", etc.)
// Sinon : geoLabel = stay.geography (déjà en base) ou null
// ============================================================================

const GEO_LABEL_BLACKLIST = [
  'son', 'danger', 'proximit', 'nager', 'baignade', 'camping', 'baby', 'kayak',
  'avis', 'client', 'contact', 'accueil', 'accueil?', 'page', 'site', 'lien',
  'ici', 'ici.', 'lire', 'suite', 'voir', 'plus', 'tout', 'toute', 'toutes',
  'cette', 'cet', 'ces', 'mes', 'ses', 'nos', 'vos', 'leurs', 'mon', 'ton',
  'ma', 'ta', 'sa', 'notre', 'votre', 'leur', 'mes', 'tes', 'ses',
  'premier', 'première', 'deuxième', 'second', 'seconde', 'dernier', 'dernière',
  'bon', 'bonne', 'bons', 'bonnes', 'mauvais', 'mauvaise', 'petit', 'petite',
  'grand', 'grande', 'beau', 'belle', 'bel', 'nouveaux', 'nouvelle', 'nouvel',
  'autre', 'autres', 'certain', 'certaine', 'certains', 'certaines', 'aucun',
  'aucune', 'aucuns', 'aucunes', 'tel', 'telle', 'tels', 'telles', 'même',
  'mêmes', 'très', 'trop', 'peu', 'beaucoup', 'bien', 'mal', 'moins', 'plus',
];

const GEO_LABEL_CREDIBLE_WORDS = [
  'ville', 'village', 'bourg', 'cit', 'station', 'resort', 'resort?', 'lieu',
  'endroit', 'place', 'quartier', 'centre', 'bourg', 'hameau', 'domaine',
  'valle', 'val', 'baie', 'golfe', 'cap', 'pointe', 'fleuve', 'rivier',
];

/**
 * Vérifier si un geoLabel est valide selon la Règle A
 */
function isValidGeoLabel(label: string | null): boolean {
  if (!label) return false;

  const trimmed = norm(label);
  if (trimmed.length < 4) return false;

  // Blacklist check
  const lower = trimmed.toLowerCase();
  if (GEO_LABEL_BLACKLIST.some(word => lower.includes(word))) {
    return false;
  }

  // Must have uppercase letter OR credible word
  const hasUppercase = /[A-Z]/.test(trimmed);
  const hasCredibleWord = GEO_LABEL_CREDIBLE_WORDS.some(word => lower.includes(word));

  return hasUppercase || hasCredibleWord;
}

/**
 * Extraire le libellé géographique depuis le HTML (avec garde-fou)
 */
function extractGeoLabel($: any): { label: string | null; source: string } {
  // 1. Essayer depuis le titre H1
  const h1 = norm($('h1').first().text());
  const h1Match = h1.match(/(?:à|a|en|dans)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (h1Match && h1Match[1] && isValidGeoLabel(h1Match[1])) {
    return { label: norm(h1Match[1]), source: 'H1 title' };
  }

  // 2. Essayer depuis le premier paragraphe
  const firstP = norm($('p').first().text());
  const pMatch = firstP.match(/(?:située?\s+)?(?:à|a|en|dans)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (pMatch && pMatch[1] && isValidGeoLabel(pMatch[1])) {
    return { label: norm(pMatch[1]), source: 'First paragraph' };
  }

  // 3. Chercher "Séjour à X" ou "Colonie à X"
  const bodyText = norm($('body').text());
  const stayMatch = bodyText.match(/(?:séjour|colonie|stage|vacances?)\s+(?:à|a|en)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (stayMatch && stayMatch[1] && isValidGeoLabel(stayMatch[1])) {
    return { label: norm(stayMatch[1]), source: 'Body text (séjour pattern)' };
  }

  return { label: null, source: 'No valid match found' };
}

// ============================================================================
// RÈGLE B — GeoPrecision from URL
// ============================================================================
// Source la plus fiable : l'URL UFOVAL (sourceUrl)
// - si l'URL contient mer/littoral/plage → bord_de_mer
// - si l'URL contient montagne/alpe → montagne
// - si l'URL contrien forêt/bois → foret
// - si l'URL contient campagne/rural → campagne
// - sinon → null (pas de valeur par défaut)
// ============================================================================

function extractGeoPrecisionFromUrl(url: string): string | null {
  const lower = url.toLowerCase();

  // Check patterns in URL (most reliable source)
  if (/(mer|littoral|plage|ocean|côtes?)/.test(lower)) return 'bord_de_mer';
  if (/(montagne|alpe|alpes|massif|altitude|sommet)/.test(lower)) return 'montagne';
  if (/(forêt|foret|bois|sous-bois)/.test(lower)) return 'foret';
  if (/(campagne|rural|ferme)/.test(lower)) return 'campagne';
  if (/(lac|riviere|eau)/.test(lower)) return 'bord_de_eau';
  if ((/ile|iles|île|îles/).test(lower)) return 'ile';

  return null; // No default value
}

// ============================================================================
// RÈGLE C — Accommodation Type (no default)
// ============================================================================
// Tant que tu ne trouves pas un vrai bloc "Hébergement / Logement", tu laisses null
// Pas de "centre" par défaut
// ============================================================================

/**
 * Détecter le type d'hébergement depuis le HTML (strict)
 * Ne renvoie une valeur que si un bloc "Hébergement" ou "Logement" est trouvé
 */
function extractAccommodationType($: any): { type: string | null; source: string } {
  // 1. Chercher un bloc "Hébergement" ou "Logement"
  const sections = $('h1, h2, h3, h4').map((_idx: number, el: any) => {
    const title = norm($(el).text());
    const content = norm($(el).nextUntil('h1, h2, h3, h4').text());
    return { title, content };
  }).get();

  for (const { title, content } of sections) {
    const titleLower = title.toLowerCase();
    // Must be in an accommodation section
    if (/(hébergement|logement|héberg|où dormir| où loger|落脚|accommodat)/i.test(titleLower)) {
      const combined = (title + ' ' + content).toLowerCase();

      const types = [
        { pattern: 'centre.*vacances|colonie|colonies', value: 'centre' },
        { pattern: 'auberge.*jeunesse|auberge', value: 'auberge' },
        { pattern: '\\bcamping\\b|\\bcamp\\b', value: 'camping' },
        { pattern: 'gîte|gite', value: 'gite' },
        { pattern: 'village.*vacances', value: 'village' },
        { pattern: 'hôtel|hotel', value: 'hotel' },
        { pattern: 'chalet', value: 'chalet' },
      ];

      for (const { pattern, value } of types) {
        if (new RegExp(pattern, 'i').test(combined)) {
          return { type: value, source: `Accommodation section: "${title}"` };
        }
      }
    }
  }

  return { type: null, source: 'No accommodation section found' };
}

/**
 * Extraire le nom de l'hébergement depuis le HTML
 */
function extractAccommodationLabel($: any): string | null {
  // Chercher dans les titres et sous-titres
  let found: string | null = null;
  $('h1, h2, h3').each((_idx: number, el: any) => {
    if (found) return;
    const text = norm($(el).text());
    // Patterns courants: "Centre XXX", "Auberge YYY", "Village ZZZ"
    const patterns = [
      /^(Centre|Auberge|Village|Gîte|Hôtel|Domaine)\s+.+/i,
      /^(Camping|Chalet|Maison)\s+.+/i,
    ];
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        found = text;
        return false;
      }
    }
  });

  return found;
}

/**
 * Extraire les faits d'hébergement depuis le HTML
 */
function extractAccommodationFacts($: any): AccommodationFact[] {
  const facts: AccommodationFact[] = [];

  // Recherche de sections contenant des infos sur l'hébergement
  const sections = $('h1, h2, h3, h4, strong, b').map((_idx: number, el: any) => {
    const title = norm($(el).text());
    const content = norm($(el).parent().text());
    return { title, content };
  }).get();

  // Catégories de faits à extraire
  const categories = [
    {
      key: 'chambres',
      patterns: ['chambre', 'coucher', 'lit', 'dortoir', 'cabane'],
      examples: ['2 lits', '3 lits', '4 lits', 'lits superposés', 'chambre collective'],
    },
    {
      key: 'sanitaires',
      patterns: ['douche', 'wc', 'toilette', 'salle de bain', 'sanitaire'],
      examples: ['douche', 'wc', 'wc séparés', 'salle de bain', 'sanitaires collectifs'],
    },
    {
      key: 'equipements',
      patterns: ['chauffage', 'clim', 'wifi', 'radio', 'tv', 'lecteur'],
      examples: ['chauffage', 'chauffage central', 'wifi', 'climatisation'],
    },
    {
      key: 'restauration',
      patterns: ['cuisine', 'repas', 'restaurant', 'self', 'cantine', 'petit déj'],
      examples: ['petit déjeuner', 'repas', 'self', 'cantine', 'cuisine équipée'],
    },
    {
      key: 'exterieur',
      patterns: ['terrain', 'jardin', 'cour', 'aire de jeu', 'sport', 'ping-pong'],
      examples: ['terrain de sport', 'aire de jeux', 'cour', 'jardin', 'ping-pong'],
    },
  ];

  for (const category of categories) {
    const items: string[] = [];
    for (const { title, content } of sections) {
      const titleLower = title.toLowerCase();
      const contentLower = content.toLowerCase();
      if (
        category.patterns.some(p => titleLower.includes(p) || contentLower.includes(p))
      ) {
        // Extraire les exemples trouvés
        for (const example of category.examples) {
          if (contentLower.includes(example.toLowerCase()) && !items.includes(example)) {
            items.push(example);
          }
        }
      }
    }
    if (items.length > 0) {
      facts.push({ category: category.key, items });
    }
  }

  return facts;
}

/**
 * Extraire le point de RDV depuis le HTML
 */
function extractMeetingPoint($: any): string | null {
  const bodyText = norm($('body').text()).toLowerCase();
  const meetingPatterns = [
    /point\s+de\s+rdv\s*[:\s]+([^.]+)/i,
    /rendez-vous\s+[:\s]+([^.]+)/i,
    /lieu\s+de\s+dépôt\s+[:\s]+([^.]+)/i,
    /dépôt\s+sur\s+place\s*[:\s]+([^.]+)/i,
    /meeting\s+point\s*[:\s]+([^.]+)/i,
  ];

  for (const pattern of meetingPatterns) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      return norm(match[1]);
    }
  }

  // Chercher dans les sections avec titres pertinents
  let found: string | null = null;
  $('h1, h2, h3, h4, strong, b').each((_idx: number, el: any) => {
    if (found) return;
    const title = norm($(el).text()).toLowerCase();
    if (title.includes('rdv') || title.includes('rendez-vous') || title.includes('dépôt') || title.includes('meeting')) {
      const content = norm($(el).parent().text());
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        found = lines.slice(1, 3).join(' ');
      }
    }
  });

  return found;
}

/**
 * Extraire tous les faits depuis une page HTML
 */
function extractFactsFromHtml(html: string, sourceUrl: string): ExtractedFacts {
  const $ = cheerio.load(html);

  // Règle A: GeoLabel avec garde-fou qualité
  const { label: geoLabelRaw, source: geoLabelSource } = extractGeoLabel($);
  const geoLabel = isValidGeoLabel(geoLabelRaw) ? geoLabelRaw : null;

  // Règle B: GeoPrecision depuis l'URL (plus fiable)
  const geoPrecision = extractGeoPrecisionFromUrl(sourceUrl);
  const geoPrecisionSource = geoPrecision ? 'URL pattern matching' : 'No URL pattern match';

  // Règle C: AccommodationType uniquement si bloc trouvé
  const { type: accommodationType, source: accommodationTypeSource } = extractAccommodationType($);

  const accommodationLabel = extractAccommodationLabel($);
  const accommodationFacts = extractAccommodationFacts($);
  const meetingPoint = extractMeetingPoint($);

  return {
    geoLabel,
    geoPrecision,
    accommodationLabel,
    accommodationType,
    accommodationFacts,
    meetingPoint,
    rawHtml: html, // Only stored in sourceFacts, not in individual fields
    debugInfo: {
      geoLabelSource: DEBUG ? geoLabelSource : undefined,
      geoPrecisionSource: DEBUG ? geoPrecisionSource : undefined,
      accommodationTypeSource: DEBUG ? accommodationTypeSource : undefined,
    },
  };
}

/**
 * Récupérer le HTML depuis une URL
 */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GED-UFOVAL-Facts/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/**
 * MAIN
 */
async function main() {
  // Récupérer les séjours avec source_url
  const whereClause: any = {
    sourceUrl: { not: null },
    published: true,
  };

  if (SLUG) {
    whereClause.slug = SLUG;
  }

  const stays = await prisma.stay.findMany({
    where: whereClause,
    select: {
      id: true,
      slug: true,
      title: true,
      sourceUrl: true,
      geography: true,
      accommodation: true,
      // New FACTS fields
      geoLabel: true,
      geoPrecision: true,
      accommodationLabel: true,
      accommodationType: true,
      accommodationFacts: true,
      meetingPoint: true,
      sourceFacts: true,
      factsSyncedAt: true,
    },
    orderBy: { title: 'asc' },
  });

  const toProcess = LIMIT ? stays.slice(0, LIMIT) : stays;
  console.log(`\n📋 Found ${stays.length} stays with source_url${SLUG ? ` (filtered by slug: ${SLUG})` : ''}`);
  if (LIMIT) console.log(`📊 Processing first ${toProcess.length} (limited)`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const stay = toProcess[i];
    const url = stay.sourceUrl!;
    const id = stay.slug || stay.id;

    console.log(`[${i + 1}/${toProcess.length}] ${id}`);
    if (DEBUG) console.log(`  🔗 URL: ${url}`);

    try {
      const html = await fetchHtml(url);
      const facts = extractFactsFromHtml(html, url);

      if (DEBUG && facts.debugInfo) {
        console.log(`  🐛 geoLabel source: ${facts.debugInfo.geoLabelSource}`);
        console.log(`  🐛 geoPrecision source: ${facts.debugInfo.geoPrecisionSource}`);
        console.log(`  🐛 accommodationType source: ${facts.debugInfo.accommodationTypeSource}`);
      }

      // Build sourceFacts (raw scraped + metadata)
      const sourceFacts = {
        scrapedAt: new Date().toISOString(),
        sourceUrl: url,
        rawHtml: facts.rawHtml, // Only store raw HTML in sourceFacts
        extractedAt: new Date().toISOString(),
        debugInfo: facts.debugInfo,
      };

      // Prepare update data (rawHtml excluded from individual fields)
      const updateData = {
        geoLabel: facts.geoLabel ?? null,
        geoPrecision: facts.geoPrecision ?? null,
        accommodationLabel: facts.accommodationLabel ?? null,
        accommodationType: facts.accommodationType ?? null,
        accommodationFacts: (facts.accommodationFacts?.length ?? 0) > 0 ? (facts.accommodationFacts as any) : null,
        meetingPoint: facts.meetingPoint ?? null,
        sourceFacts: sourceFacts as any,
        factsSyncedAt: new Date(),
      };

      if (DRY_RUN) {
        // Audit mode: display extracted facts
        console.log(`  📊 geoLabel: ${updateData.geoLabel ?? '(none)'}`);
        console.log(`  📊 geoPrecision: ${updateData.geoPrecision ?? '(none)'}`);
        console.log(`  📊 accommodationLabel: ${updateData.accommodationLabel ?? '(none)'}`);
        console.log(`  📊 accommodationType: ${updateData.accommodationType ?? '(none)'}`);
        console.log(`  📊 accommodationFacts: ${JSON.stringify(updateData.accommodationFacts)}`);
        console.log(`  📊 meetingPoint: ${updateData.meetingPoint ?? '(none)'}`);
        console.log(`  ✓ Would update DB`);
      } else if (WRITE) {
        // Write mode: apply to DB
        await prisma.stay.update({
          where: { id: stay.id },
          data: updateData,
        });
        console.log(`  ✓ DB updated`);
      }

      successCount++;
    } catch (e: any) {
      console.error(`  ❌ Error: ${e?.message || e}`);
      errorCount++;
    }
    console.log('');
  }

  console.log(`\n✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n${DRY_RUN ? '🔍 DRY-RUN complete (no DB writes)' : '💾 WRITE complete (DB updated)'}`);
}

main()
  .catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
