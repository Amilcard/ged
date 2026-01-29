# Règles de Tarification GED

## Vue d'ensemble

Le prix d'un séjour GED est composé de plusieurs éléments :

| Composant | Description | Source |
|-----------|-------------|--------|
| **Prix session** | Prix de base du séjour pour une session donnée | `enrichment.sessions[].promo_price_eur` ou `base_price_eur` |
| **Surcoût transport** | Supplément selon la ville de départ | `departureCities[].extra_eur` |
| **Option éducative** | Option ZEN (49€) ou ULTIME (79€) | Choix utilisateur dans le modal |

## Calcul du prix

### Fonction centralisée

```typescript
import { getPriceBreakdown } from '@/lib/pricing';

const breakdown = getPriceBreakdown({
  sessionPrice: 718,        // Prix session sélectionnée
  cityExtraEur: 220,        // Surcoût ville (ex: Paris +220€)
  optionType: 'ZEN',        // Option éducative
  minSessionPrice: 718,     // Prix minimum (pour "À partir de")
});

// Résultat :
// {
//   baseSession: 718,
//   extraTransport: 220,
//   extraOption: 49,
//   total: 987,
//   minPrice: 718,
//   hasSelection: true
// }
```

### Affichage UI

#### Écran détail (`stay-detail.tsx`)

1. **"À partir de X€"** : Toujours visible (prix minimum session + sans transport)
2. **"Estimation: Y€"** : Visible uniquement si l'utilisateur a sélectionné une ville

#### Modal de réservation (`booking-modal.tsx`)

- Total dynamique dans le header : `sessionPrice + extraVille + optionPrice`
- Détail du breakdown visible

## Villes de départ standard

```typescript
const STANDARD_CITIES = ['Paris', 'Lyon', 'Lille', 'Marseille', 'Bordeaux', 'Rennes'];
```

## Options éducatives

| Option | Prix | Description |
|--------|------|-------------|
| ZEN | 49€ | Suivi personnalisé |
| ULTIME | 79€ | Accompagnement renforcé 1+1 |

## Tests manuels

1. **Sélection ville → prix change**
   - Aller sur un détail séjour en mode Pro
   - Sélectionner une ville de départ (ex: Paris +220€)
   - Vérifier que l'estimation affiche le total (session + transport)

2. **Reset → retour au minimum**
   - Désélectionner la ville
   - Vérifier que seul "À partir de X€" est affiché

3. **Modal cohérent**
   - Cliquer "Réserver"
   - Vérifier que le total dans le modal correspond à l'estimation

## Fichiers concernés

- `lib/pricing.ts` - Fonction `getPriceBreakdown`
- `app/sejour/[id]/stay-detail.tsx` - Affichage prix détail
- `components/booking-modal.tsx` - Affichage prix modal
