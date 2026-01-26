#!/usr/bin/env tsx
/**
 * Script de correction des reformulations UFOVAL
 *
 * Corrections apportées :
 * 1. Localisations douteuses ("Voir plus de photos", "Chamonix -", etc.)
 * 2. Prix dans les descriptions Pro ("à partir de XXX euros")
 * 3. Vérification title_kids vide (faux positif mais on vérifie)
 */

interface Session {
  start_date: string;
  end_date: string;
  price_base: number;
  price_unit: string;
  capacity_remaining: number | null;
  capacity_total: number | null;
  status: string;
}

interface ProContent {
  title_pro: string;
  short_description_pro: string;
  description_pro: string;
  program_brief_pro: string[];
  educational_option_pro: string;
  departure_city_info: string;
}

interface KidsContent {
  title_kids: string;
  short_description_kids: string;
  description_kids: string;
  program_brief_kids: string[];
  educational_option_kids: string;
  departure_city_info_kids: string;
}

interface Sejour {
  source_url: string;
  source_partner: string;
  age_min: number;
  age_max: number;
  location_name: string;
  sessions_json: Session[];
  pro: ProContent;
  kids: KidsContent;
  generated_at?: string;
  model?: string;
}

// Mapping des localisations douteuses vers les bonnes valeurs
const LOCATION_FIXES: Record<string, string> = {
  "Voir plus de photos": "À déterminer",
  "Chamonix -": "Chamonix",
  "Corse Saint-Florent": "Saint-Florent (Corse)",
  "Duingt-Annecy": "Duingt (Annecy)",
  "St Raphaël": "Saint-Raphaël",
};

// Regex pour remplacer les prix dans les descriptions
const PRICE_REGEX = /\d{3,4}\s+(euros|EUR|€)/gi;
const SESSION_COUNT_REGEX = /Sept sessions sont disponibles à partir de \d{3,4}\s+euros?\./gi;
const SESSION_COUNT_REGEX_2 = /Trois sessions sont disponibles, avec un tarif à partir de \d{3,4}\s+euros?\./gi;
const SESSION_COUNT_REGEX_3 = /Une session unique est disponible, avec un tarif à partir de \d{3,4}\s+euros?\./gi;
const SESSION_COUNT_REGEX_4 = /Deux sessions sont disponibles, avec un tarif à partir de \d{3,4}\s+euros?\./gi;
const SESSION_COUNT_REGEX_5 = /Huit sessions disponibles, ce séjour est proposé à partir de \d{3,4}\s+euros?\./gi;
const SESSION_COUNT_REGEX_6 = /Avec \d+ sessions disponibles, chaque séjour est conçu pour maximiser les bénéfices éducatifs\./gi;

function fixDescription(text: string): string {
  let result = text;

  // Remplacer les mentions de prix avec session count
  result = result.replace(SESSION_COUNT_REGEX, "Plusieurs sessions sont disponibles tout l'été.");
  result = result.replace(SESSION_COUNT_REGEX_2, "Plusieurs sessions sont disponibles tout l'été.");
  result = result.replace(SESSION_COUNT_REGEX_3, "Une session est disponible en août.");
  result = result.replace(SESSION_COUNT_REGEX_4, "Deux sessions sont disponibles en août.");
  result = result.replace(SESSION_COUNT_REGEX_5, "Plusieurs sessions sont disponibles tout l'été.");
  result = result.replace(SESSION_COUNT_REGEX_6, "Plusieurs sessions sont disponibles tout l'été.");

  // Nettoyer les prix restants
  result = result.replace(PRICE_REGEX, "tarif adapté");

  return result;
}

function fixLocationName(locationName: string): string {
  if (LOCATION_FIXES[locationName]) {
    return LOCATION_FIXES[locationName];
  }
  return locationName;
}

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || "./out/ufoval/rewrite_ready_for_supabase.json";
  const outputFile = args[1] || "./out/ufoval/rewrite_ready_for_supabase_fixed.json";

  console.log(`\n🔧 Correction des reformulations UFOVAL`);
  console.log(`📁 Entrée: ${inputFile}`);
  console.log(`📁 Sortie: ${outputFile}\n`);

  // Lire le fichier JSON
  let sejours: Sejour[];
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(inputFile, "utf-8");
    sejours = JSON.parse(content);
  } catch (err) {
    console.error(`❌ Erreur de lecture du fichier: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`📊 ${sejours.length} séjours à traiter\n`);

  let fixedLocations = 0;
  let fixedPrices = 0;
  let fixedTitles = 0;

  // Corriger chaque séjour
  for (let i = 0; i < sejours.length; i++) {
    const sejour = sejours[i];
    let modifications: string[] = [];

    // 1. Corriger la localisation
    const originalLocation = sejour.location_name;
    const fixedLocation = fixLocationName(originalLocation);
    if (originalLocation !== fixedLocation) {
      sejour.location_name = fixedLocation;
      fixedLocations++;
      modifications.push(`location: "${originalLocation}" → "${fixedLocation}"`);
    }

    // 2. Corriger les prix dans description_pro
    const originalDesc = sejour.pro.description_pro;
    const fixedDesc = fixDescription(originalDesc);
    if (originalDesc !== fixedDesc) {
      sejour.pro.description_pro = fixedDesc;
      fixedPrices++;
      modifications.push("prix retirés de description_pro");
    }

    // 3. Vérifier title_kids
    if (!sejour.kids.title_kids || sejour.kids.title_kids.trim().length < 3) {
      // Générer un title_kids à partir de title_pro
      sejour.kids.title_kids = sejour.pro.title_pro
        .replace(/\s+(aux|à|en|pour|des|de|la|le|les)\s+(Saint-|Saint |l'|Aiguilles?)/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 4)
        .join(" ") || sejour.pro.title_pro;
      fixedTitles++;
      modifications.push(`title_kids généré: "${sejour.kids.title_kids}"`);
    }

    if (modifications.length > 0) {
      console.log(`#${i + 1}: ${sejour.pro.title_pro}`);
      for (const mod of modifications) {
        console.log(`   ✓ ${mod}`);
      }
    }
  }

  // Sauvegarder le fichier corrigé
  try {
    const fs = await import("fs/promises");
    await fs.writeFile(outputFile, JSON.stringify(sejours, null, 2), "utf-8");
    console.log(`\n✅ Fichier corrigé sauvegardé: ${outputFile}`);
  } catch (err) {
    console.error(`❌ Erreur d'écriture: ${(err as Error).message}`);
    process.exit(1);
  }

  // Résumé
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📈 RÉSUMÉ DES CORRECTIONS`);
  console.log(`${"=".repeat(50)}`);
  console.log(`📍 Localisations corrigées: ${fixedLocations}`);
  console.log(`💰 Prix retirés des descriptions: ${fixedPrices}`);
  console.log(`📝 Titles_kids vérifiés/corrigés: ${fixedTitles}`);
  console.log(`${"=".repeat(50)}\n`);
}

main().catch((err) => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
