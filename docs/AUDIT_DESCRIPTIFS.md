# Audit Descriptifs Stay Detail

## Champs disponibles vs affichés

### Champs `stay` (source BDD/Prisma)

| Champ | Source import | Affiché UI | État | Fix proposé |
|-------|--------------|------------|------|-------------|
| `title` | `stay.pro.title_pro` | ✅ Hero + page | OK | - |
| `descriptionShort` | `stay.pro.short_description_pro` | ✅ Section Présentation | OK (Pro) | Utiliser contentKids.description en Kids |
| `programme` | `stay.pro.program_brief_pro` | ✅ Mini + Full Programme | ⚠️ Vide si pas de programme_brief | Masquer si vide (fait) |
| `themes` | `stay.pro.program_brief_pro` | ✅ Tags | ⚠️ Même source que programme! | À séparer (thèmes vrais) |
| `geography` | `stay.location_name` | ✅ Card Lieu | OK | - |
| `accommodation` | Hardcodé "À confirmer" | ✅ Card Hébergement | ⚠️ Jamais réel | Utiliser données UFOVAL |
| `supervision` | Hardcodé "Encadrement pro" | ✅ Card Encadrement | ⚠️ Jamais réel | Utiliser données UFOVAL |
| `pdfUrl` | Non importé | ✅ Bouton PDF | ⚠️ Toujours null | À importer si dispo |
| `geoLabel` | Non importé | ✅ Card Lieu (fallback) | ⚠️ Null | À importer |
| `accommodationLabel` | Non importé | ✅ Card Hébergement | ⚠️ Null | À importer |

### Champs `contentKids` (JSON dans stay.contentKids)

| Champ | Source import | Affiché UI | État | Fix proposé |
|-------|--------------|------------|------|-------------|
| `title` | `stay.kids.title_kids` | ❌ Non utilisé | PERDU | Afficher en mode Kids |
| `short_description` | `stay.kids.short_description_kids` | ❌ Non utilisé | PERDU | Fallback avant descriptionShort |
| `description` | `stay.kids.description_kids` | ❌ Non utilisé | PERDU | Afficher en mode Kids (priorité) |
| `program_brief` | `stay.kids.program_brief_kids` | ❌ Non utilisé | PERDU | Afficher programme Kids |
| `educational_option` | `stay.kids.educational_option_kids` | ❌ Non utilisé | PERDU | Afficher en section Options |
| `departure_city_info` | `stay.kids.departure_city_info_kids` | ❌ Non utilisé | PERDU | Info transport Kids |
| `departureCities` | Enrichment API | ✅ Section Villes | OK | - |

## Sections UI actuelles

| Section | Mode Pro | Mode Kids | État |
|---------|----------|-----------|------|
| Hero (titre) | `stay.title` | `stay.title` | ⚠️ Pas de titre Kids |
| Présentation | `stay.descriptionShort` | `stay.descriptionShort` | ❌ Pas de description Kids |
| Mini Programme | `programme[:5]` | `programme[:5]` | ⚠️ Pas de programme Kids |
| Full Programme | `programme` | `programme` | ⚠️ Pas de programme Kids |
| Lieu | `geoLabel` / `geography` | Idem | OK |
| Hébergement | `accommodationLabel` / hardcodé | Idem | ⚠️ Données manquantes |
| Encadrement | Hardcodé | Idem | ⚠️ Données manquantes |
| Villes départ | `departureCities` | Idem | OK |
| PDF | `pdfUrl` | Idem | ⚠️ Jamais rempli |

## Régressions identifiées

1. **Mode Kids n'utilise PAS contentKids** - Les descriptions longues Kids existent mais ne sont pas affichées
2. **Themes = Programme** - Les tags affichés sont les items de programme, pas de vrais thèmes
3. **Hébergement/Encadrement hardcodés** - Pas de vraies données importées
4. **Sections Programme non masquées si vides** - Affiche des blocs vides

## Plan de correction (1 commit)

### Fix 1: Mode Kids - Utiliser contentKids
```tsx
// Section Description
{isKids ? (
  <p>{contentKidsParsed?.description || contentKidsParsed?.short_description || stay?.descriptionShort || ''}</p>
) : (
  <p>{stay?.descriptionShort ?? ''}</p>
)}
```

### Fix 2: Masquer sections vides
```tsx
{miniProgramme.length > 0 && (
  <section>...</section>
)}
```

### Fix 3 (optionnel): Programme Kids
```tsx
const programmeItems = isKids && contentKidsParsed?.program_brief
  ? contentKidsParsed.program_brief
  : programme;
```

## Prochaines étapes

1. ✅ Branche `feat/ufoval-descriptions-detail` avec Fix 1 + Fix 2 (commit b263405)
2. ⏳ Merge PR après validation
3. 📋 Lot suivant: importer données réelles hébergement/encadrement
