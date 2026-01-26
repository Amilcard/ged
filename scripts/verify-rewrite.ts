#!/usr/bin/env tsx
/**
 * Script de vérification des reformulations UFOVAL
 *
 * Contrôles effectués :
 * - Pas de dates explicites dans les descriptions (ex: "juillet 2026")
 * - Pas de prix explicites dans les descriptions (ex: "630€", "630 euros")
 * - Tous les champs requis sont présents
 * - Cohérence des âges (age_min <= age_max)
 * - Les listes program_brief ne sont pas vides
 * - Pas de textes vides ou placeholder-type
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

interface VerificationError {
  sejourIndex: number;
  sejourTitle: string;
  field: string;
  severity: "error" | "warning";
  message: string;
}

// Regex pour détecter les dates et prix dans les textes
const DATE_PATTERNS = [
  /\b\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i,
  /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}\b/i,
  /\b0[7-8]\/\d{2}\b/, // Dates comme 07/18, 08/09
  /\bdébut\s+(juillet|août|septembre)\b/i,
  /\bfin\s+(juillet|août|septembre)\b/i,
  /\bmi\s+(juillet|août|septembre)\b/i,
];

const PRICE_PATTERNS = [
  /\b\d{3,4}\s*€\b/,
  /\b\d{3,4}\s+euros\b/i,
  /\bà partir de\s+\d{3,4}\b/i,
  /\b\d{3,4}\s*EUR\b/i,
];

const PLACEHOLDER_PATTERNS = [
  /\bà venir\b/i,
  /\bà compléter\b/i,
  /\bTBD\b/i,
  /\bXXX\b/i,
  /\b\décrivez ici\b/i,
];

function checkTextForIssues(
  text: string,
  fieldName: string
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text || text.trim().length === 0) {
    errors.push(`${fieldName}: texte vide`);
    return { errors, warnings };
  }
  if (text.trim().length < 5) {
    errors.push(`${fieldName}: texte trop court (${text.trim().length} chars)`);
    return { errors, warnings };
  }

  // Vérifier les dates
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      warnings.push(`${fieldName}: contient une possible date "${match[0]}" - doit être générique`);
      break; // Un seul warning par type
    }
  }

  // Vérifier les prix (seulement dans les descriptions, pas dans educational_option)
  if (!fieldName.includes("educational")) {
    for (const pattern of PRICE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        warnings.push(`${fieldName}: contient un possible prix "${match[0]}" - doit être générique`);
        break;
      }
    }
  }

  // Vérifier les placeholders
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      errors.push(`${fieldName}: contient un placeholder "${match[0]}"`);
      break;
    }
  }

  return { errors, warnings };
}

function verifySejour(sejour: Sejour, index: number): VerificationError[] {
  const errors: VerificationError[] = [];
  const { pro, kids, age_min, age_max, location_name, sessions_json } = sejour;

  // 1. Vérifier les âges
  if (age_min > age_max) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "ages",
      severity: "error",
      message: `age_min (${age_min}) > age_max (${age_max})`,
    });
  }

  if (age_min < 3 || age_max > 18) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "ages",
      severity: "warning",
      message: `âge hors plage habituelle 3-17: ${age_min}-${age_max}`,
    });
  }

  // 2. Vérifier le lieu
  if (!location_name || location_name.length < 2) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "location_name",
      severity: "error",
      message: "localisation manquante ou invalide",
    });
  }

  // Lieux qui semblent être des erreurs de scraping
  if (location_name.includes("Voir plus de photos") || location_name.includes("-")) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "location_name",
      severity: "warning",
      message: `localisation suspecte: "${location_name}"`,
    });
  }

  // 3. Vérifier les sessions
  if (!sessions_json || sessions_json.length === 0) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "sessions_json",
      severity: "error",
      message: "aucune session définie",
    });
  }

  // 4. Vérifier les contenus PRO
  const proFields: (keyof ProContent)[] = [
    "title_pro",
    "short_description_pro",
    "description_pro",
    "educational_option_pro",
  ];

  for (const field of proFields) {
    const check = checkTextForIssues(pro[field], field);
    for (const err of check.errors) {
      errors.push({
        sejourIndex: index,
        sejourTitle: pro.title_pro,
        field,
        severity: "error",
        message: err,
      });
    }
    for (const warn of check.warnings) {
      errors.push({
        sejourIndex: index,
        sejourTitle: pro.title_pro,
        field,
        severity: "warning",
        message: warn,
      });
    }
  }

  // Vérifier program_brief_pro
  if (!pro.program_brief_pro || pro.program_brief_pro.length === 0) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "program_brief_pro",
      severity: "error",
      message: "program_brief vide",
    });
  } else if (pro.program_brief_pro.length < 3) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "program_brief_pro",
      severity: "warning",
      message: `program_brief contient seulement ${pro.program_brief_pro.length} éléments (recommandé: 3+)`,
    });
  }

  // Vérifier departure_city_info
  if (pro.departure_city_info === "Départ à confirmer") {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "departure_city_info",
      severity: "warning",
      message: "ville de départ non renseignée",
    });
  }

  // 5. Vérifier les contenus KIDS
  const kidsFields: (keyof KidsContent)[] = [
    "title_kids",
    "short_description_kids",
    "description_kids",
    "educational_option_kids",
  ];

  for (const field of kidsFields) {
    const check = checkTextForIssues(kids[field], field);
    for (const err of check.errors) {
      errors.push({
        sejourIndex: index,
        sejourTitle: kids.title_kids,
        field,
        severity: "error",
        message: err,
      });
    }
    for (const warn of check.warnings) {
      errors.push({
        sejourIndex: index,
        sejourTitle: kids.title_kids,
        field,
        severity: "warning",
        message: warn,
      });
    }
  }

  // Vérifier program_brief_kids
  if (!kids.program_brief_kids || kids.program_brief_kids.length === 0) {
    errors.push({
      sejourIndex: index,
      sejourTitle: kids.title_kids,
      field: "program_brief_kids",
      severity: "error",
      message: "program_brief vide",
    });
  } else if (kids.program_brief_kids.length < 3) {
    errors.push({
      sejourIndex: index,
      sejourTitle: kids.title_kids,
      field: "program_brief_kids",
      severity: "warning",
      message: `program_brief contient seulement ${kids.program_brief_kids.length} éléments (recommandé: 3+)`,
    });
  }

  // 6. Vérifier la cohérence entre Pro et Kids
  const proWords = pro.description_pro.split(/\s+/).length;
  const kidsWords = kids.description_kids.split(/\s+/).length;

  if (kidsWords > proWords) {
    errors.push({
      sejourIndex: index,
      sejourTitle: pro.title_pro,
      field: "coherence",
      severity: "warning",
      message: `description Kids (${kidsWords} mots) plus longue que Pro (${proWords} mots) - inhabituel`,
    });
  }

  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || "./out/ufoval/rewrite_ready_for_supabase.json";

  console.log(`\n🔍 Vérification des reformulations`);
  console.log(`📁 Fichier: ${inputFile}\n`);

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

  console.log(`📊 ${sejours.length} séjours à vérifier\n`);

  // Vérifier chaque séjour
  const allErrors: VerificationError[] = [];
  for (let i = 0; i < sejours.length; i++) {
    const errors = verifySejour(sejours[i], i);
    allErrors.push(...errors);
  }

  // Afficher les résultats
  const errors = allErrors.filter((e) => e.severity === "error");
  const warnings = allErrors.filter((e) => e.severity === "warning");

  console.log(`\n${"=".repeat(70)}`);
  console.log(`📈 RÉSUMÉ`);
  console.log(`${"=".repeat(70)}`);
  console.log(`✅ Séjours vérifiés: ${sejours.length}`);
  console.log(`❌ Erreurs: ${errors.length}`);
  console.log(`⚠️  Avertissements: ${warnings.length}`);
  console.log(`${"=".repeat(70)}\n`);

  // Afficher les erreurs par séjour
  if (errors.length > 0 || warnings.length > 0) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📋 DÉTAIL DES PROBLÈMES`);
    console.log(`${"=".repeat(70)}\n`);

    // Grouper par séjour
    const bySejour = new Map<number, VerificationError[]>();
    for (const err of allErrors) {
      if (!bySejour.has(err.sejourIndex)) {
        bySejour.set(err.sejourIndex, []);
      }
      bySejour.get(err.sejourIndex)!.push(err);
    }

    for (const [index, errs] of bySejour.entries()) {
      const sejour = sejours[index];
      console.log(`\n#${index + 1}: ${sejour.pro.title_pro}`);
      console.log(`   URL: ${sejour.source_url}`);
      console.log(`   ${"-".repeat(66)}`);

      for (const err of errs) {
        const icon = err.severity === "error" ? "❌" : "⚠️ ";
        console.log(`   ${icon} [${err.field}] ${err.message}`);
      }
    }
  }

  // Recommandation
  console.log(`\n${"=".repeat(70)}`);
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`🎉 Aucune erreur détectée ! Les reformulations sont prêtes pour l'import.`);
  } else if (errors.length === 0) {
    console.log(`⚠️  Des avertissements sont présents. Vérifiez et corrigez si nécessaire.`);
  } else {
    console.log(`❌ Des erreurs doivent être corrigées avant l'import en base de données.`);
  }
  console.log(`${"=".repeat(70)}\n`);

  // Code de sortie
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Erreur inattendue:", err);
  process.exit(1);
});
