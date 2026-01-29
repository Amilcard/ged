# Validation de l'âge (P0)

## Règle métier

L'âge de l'enfant est calculé **au jour près** à la date de début de la session sélectionnée.

- **Condition** : `ageMin ≤ âge_au_départ ≤ ageMax`
- Si hors limites → CTA bloqué + message explicatif

## Implémentation

### Fonctions (lib/utils.ts)

```typescript
// Calcule l'âge exact à une date donnée
calculateAgeAtDate(birthDate: string, targetDate: string): number | null

// Valide l'âge par rapport aux limites du séjour
validateChildAge(birthDate, sessionStartDate, ageMin, ageMax): AgeValidationResult
```

### Interface

- **Input** : `type="date"` (format YYYY-MM-DD)
- **Feedback immédiat** :
  - ✓ Vert si âge valide
  - ✗ Rouge si hors limites avec message explicatif

## Tests manuels

### Séjour exemple : 8-12 ans, session du 04/07/2026

| Cas | Date naissance | Âge au 04/07 | Résultat attendu |
|-----|----------------|--------------|------------------|
| Limite -1 jour | 05/07/2018 | 7 ans | ❌ Refusé (trop jeune) |
| Pile limite min | 04/07/2018 | 8 ans | ✓ Accepté |
| Dans limites | 01/01/2016 | 10 ans | ✓ Accepté |
| Pile limite max | 04/07/2014 | 12 ans | ✓ Accepté |
| Limite +1 jour | 03/07/2014 | 12 ans | ✓ Accepté |
| Hors limite max | 03/07/2013 | 13 ans | ❌ Refusé (trop âgé) |

### Message d'erreur

> "À la date du départ, l'enfant aura Z ans. Ce séjour est prévu pour les X–Y ans."

## Fichiers modifiés

- `lib/utils.ts` : fonctions `calculateAgeAtDate`, `validateChildAge`
- `components/booking-modal.tsx` : formulaire date + validation
