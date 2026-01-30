/**
 * Script de reformulation des contenus UFOVAL
 *
 * Ce script analyse les descriptions des séjours UFOVAL et les reformule
 * pour être adaptés au public GED (travailleurs sociaux).
 *
 * Usage: npx ts-node scripts/n8n/refactor-ufoval-content.ts
 */

interface UFOVALStay {
  source_url: string;
  title: string;
  description: string;
  category: string;
  filtered_sessions: Array<{
    start_date: string;
    end_date: string;
    duration_days: number;
    base_price_eur: number;
    promo_price_eur: number | null;
  }>;
  departures: Array<{
    city: string | null;
    city_label: string;
    extra_eur: number;
  }>;
}

interface RefactoredContent {
  original_title: string;
  refactored_title: string;
  original_description: string;
  refactored_description: string;
  key_points: string[];
  target_audience: string[];
  educational_value: string;
  highlights: string[];
}

/**
 * Reformuler le titre pour le public GED
 */
function refactorTitle(title: string): string {
  // Supprimer les termes trop marketing
  const cleaned = title
    .replace(/!/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Ajouter un préfixe descriptif si nécessaire
  if (!cleaned.toLowerCase().includes('séjour') && !cleaned.toLowerCase().includes('colo')) {
    return `Séjour éducatif - ${cleaned}`;
  }

  return cleaned;
}

/**
 * Reformuler la description pour les travailleurs sociaux
 */
function refactorDescription(description: string, category: string): RefactoredContent {
  // Extraire les informations clés
  const sentences = description.split(/[.!]/).filter(s => s.trim().length > 10);

  // Identifier les activités
  const activities: string[] = [];
  const activityKeywords = ['natation', 'vélo', 'vtt', 'randonnée', 'équitation', 'sport', 'jeux', 'craft', 'atelier', 'sortie', 'visite', 'découverte'];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (activityKeywords.some(keyword => lower.includes(keyword))) {
      activities.push(sentence.trim());
    }
  });

  // Identifier les bienfaits éducatifs
  const educationalBenefits: string[] = [];
  const educationalKeywords = ['autonomie', 'confiance', 'socialisation', 'partage', 'équipe', 'apprendre', 'découvrir', 'respect'];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (educationalKeywords.some(keyword => lower.includes(keyword))) {
      educationalBenefits.push(sentence.trim());
    }
  });

  // Générer la reformulation
  const refactoredDescription = `
Ce séjour éducatif proposé par notre partenaire UFOVAL offre une expérience complète d'apprentissage et de découverte.

${activities.length > 0 ? `
**Activités principales :**
${activities.map(a => `• ${a}`).join('\n')}
` : ''}

${educationalBenefits.length > 0 ? `
**Objectifs éducatifs :**
${educationalBenefits.map(b => `• ${b}`).join('\n')}
` : ''}

**Public cible :**
Ce séjour s'adresse aux enfants et adolescents recherchant une expérience vacances enrichissante dans un cadre sécurisé et encadré par des professionnels.
`.trim();

  return {
    original_title: '',
    refactored_title: '',
    original_description: description,
    refactored_description: refactoredDescription.trim(),
    key_points: activities.slice(0, 3),
    target_audience: ['Enfants', 'Adolescents'],
    educational_value: educationalBenefits.join(' '),
    highlights: activities.slice(0, 5)
  };
}

/**
 * Reformater les sessions pour affichage
 */
function formatSessions(sessions: UFOVALStay['filtered_sessions']): string {
  return sessions.map(session => {
    const startDate = new Date(session.start_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long'
    });
    const endDate = new Date(session.end_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long'
    });

    const price = session.promo_price_eur || session.base_price_eur;
    const priceDisplay = session.promo_price_eur
      ? `~${session.promo_price_eur}€~ ~~${session.base_price_eur}~~`
      : `${session.base_price_eur}€`;

    return `Du ${startDate} au ${endDate} (${session.duration_days} jours) - ${priceDisplay}`;
  }).join('\n');
}

/**
 * Reformater les villes de départ
 */
function formatDepartures(departures: UFOVALStay['departures']): string {
  const withTransport = departures.filter(d => d.city !== null);

  if (withTransport.length === 0) {
    return 'Sans transport organisé';
  }

  const sorted = withTransport.sort((a, b) => a.extra_eur - b.extra_eur);
  return sorted.map(d => `${d.city_label} (+${d.extra_eur}€)`).join(', ');
}

/**
 * Traiter un séjour UFOVAL complet
 */
export function processUFOVALStay(stay: UFOVALStay): RefactoredContent & {
  sessions_formatted: string;
  departures_formatted: string;
  price_range: string;
  duration_range: string;
} {
  const refactored = refactorDescription(stay.description, stay.category);

  // Calculer les plage de prix et durées
  const prices = stay.filtered_sessions.map(s => s.promo_price_eur || s.base_price_eur);
  const durations = stay.filtered_sessions.map(s => s.duration_days);

  const priceRange = prices.length > 0
    ? `À partir de ${Math.min(...prices)}€`
    : 'Tarif communiqué aux professionnels';

  const durationRange = durations.length > 0
    ? `${Math.min(...durations)} à ${Math.max(...durations)} jours`
    : 'Durée variable';

  return {
    ...refactored,
    original_title: stay.title,
    refactored_title: refactorTitle(stay.title),
    sessions_formatted: formatSessions(stay.filtered_sessions),
    departures_formatted: formatDepartures(stay.departures),
    price_range: priceRange,
    duration_range: durationRange
  };
}

/**
 * Script principal
 */
async function main() {
  const fs = require('fs');
  const path = require('path');

  // Lire le fichier d'enrichment UFOVAL
  const enrichmentPath = path.join(process.cwd(), 'out', 'ufoval', 'ufoval_enrichment_full.json');

  if (!fs.existsSync(enrichmentPath)) {
    console.error(`Fichier non trouvé: ${enrichmentPath}`);
    console.error('Veuillez d\'abord exécuter le workflow n8n pour générer ce fichier.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(enrichmentPath, 'utf-8');
  const ufovalData: UFOVALStay[] = JSON.parse(rawData);

  console.log(`Traitement de ${ufovalData.length} séjours UFOVAL...`);

  const results = ufovalData.map(stay => {
    try {
      return processUFOVALStay(stay);
    } catch (error) {
      console.error(`Erreur traitement séjour ${stay.source_url}:`, error);
      return null;
    }
  }).filter(Boolean);

  // Sauvegarder les résultats
  const outputPath = path.join(process.cwd(), 'out', 'ufoval', 'ufoval_refactored.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`✅ Terminé ! ${results.length} séjours reformulés sauvegardés dans: ${outputPath}`);
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

export { processUFOVALStay, refactorDescription, refactorTitle };
