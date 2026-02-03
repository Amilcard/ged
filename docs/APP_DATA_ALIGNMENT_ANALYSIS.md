# Analyse : Alignement App ↔ Workflow n8n ↔ Supabase

**Date** : 30 janvier 2026
**Contexte** : Intégration des données UFOVAL dans l'app GED "Colonies de Vacances"

---

## Résumé exécutif

L'app affiche des données qui **ne sont pas extraites** par le workflow n8n actuel. Certains champs sont disponibles dans UFOVAL mais non capturés, d'autres nécessitent un traitement supplémentaire.

---

## 1. Analyse détaillée : Page Listing

| Champ affiché | Source actuelle | Statut | Action requise |
|---------------|-----------------|--------|----------------|
| Titre | `title_pro` / `title_kids` | ✅ OK | Rien |
| Description courte | `description_kids` | ✅ OK | Rien |
| Dates (saison) | Non capturé | ❌ Manquant | Extraire depuis UFOVAL |
| Durée (7 jours) | Calculable depuis sessions | ⚠️ Dérivé | Calculer ou stocker |
| Âge (12-17 ans) | `age_min` / `age_max` | ✅ OK | Rien |
| Lieu (Berlin, Courchevel) | Non capturé | ❌ Manquant | Extraire depuis UFOVAL |
| Tags activités | `themes` (existe) | ✅ OK | Vérifier mapping |
| "Hébergement inclus" | Non capturé | ❌ Manquant | Extraire depuis UFOVAL |
| Badge "Été" | Non capturé | ❌ Manquant | Extraire depuis UFOVAL |

---

## 2. Analyse détaillée : Page Détail

| Champ affiché | Source actuelle | Statut | Action requise |
|---------------|-----------------|--------|----------------|
| Titre | `title_pro` | ✅ OK | Rien |
| Dates session | `start_date`, `end_date` | ✅ OK | Rien |
| Places | `seats_left` | ✅ OK | Rien |
| Villes départ | `city_departure` | ✅ OK | Rien |
| Programme | Non capturé | ❌ Manquant | **Extraction complexe** |
| Logistique (lieu, hébergement, encadrement) | Non capturé | ❌ Manquant | **Extraction complexe** |
| Prix | `price` | ✅ OK | Mais non affiché |

---

## 3. Données disponibles dans UFOVAL (à extraire)

D'après le fichier `out/ufoval/ufoval_enrichment_full.json`, les données suivantes sont disponibles :

| Champ UFOVAL | Colonne Supabase cible | Priorité |
|---------------|------------------------|----------|
| `contentKids.season` | `season` | Haute |
| `contentKids.location` | `location` | Haute |
| `contentKids.duration` | `duration_days` | Moyenne |
| `contentKids.programme` | `program_json` | Haute |
| `contentKids.inclusions` | `inclusions_json` | Moyenne |
| `contentKids.logistics` | `logistics_json` | Moyenne |
| `themes` | `themes_json` | Basse (existe déjà) |

---

## 4. Modifications du schema Supabase proposées

### Table `gd_stays` - Ajouts

```sql
-- Champs manquants pour l'app
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS season TEXT,              -- "Été", "Hiver", etc.
ADD COLUMN IF NOT EXISTS location TEXT,           -- "Berlin", "Courchevel"
ADD COLUMN IF NOT EXISTS duration_days INTEGER,    -- 7, 14, etc.
ADD COLUMN IF NOT EXISTS programme_json JSONB,    -- Programme détaillé
ADD COLUMN IF NOT EXISTS inclusions_json JSONB,   -- "Hébergement inclus", etc.
ADD COLUMN IF NOT EXISTS logistics_json JSONB;    -- Lieu, hébergement, encadrement

-- Commentaires
COMMENT ON COLUMN public.gd_stays.season IS 'Saison du séjour (Été, Hiver, Printemps, Automne)';
COMMENT ON COLUMN public.gd_stays.location IS 'Ville ou région du séjour';
COMMENT ON COLUMN public.gd_stays.duration_days IS 'Durée en jours';
COMMENT ON COLUMN public.gd_stays.programme_json IS 'Programme détaillé des activités';
COMMENT ON COLUMN public.gd_stays.inclusions_json IS 'Ce qui est inclus (hébergement, repas, etc.)';
COMMENT ON COLUMN public.gd_stays.logistics_json IS 'Informations logistiques (lieu, hébergement, encadrement)';
```

---

## 5. Modifications du workflow n8n requises

### Nœud `HTTP__UPSERT_GD_STAYS` - Ajouter dans le Body

```javascript
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  title: item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre',
  title_pro: item.json.pro?.title_pro,
  title_kids: item.json.kids?.title_kids,
  description_pro: item.json.pro?.description_pro || null,
  description_kids: item.json.kids?.description_kids || null,

  // --- NOUVEAUX CHAMPS ---
  season: item.json.kids?.season || extractSeason(item.json.kids?.title_kids),
  location: item.json.kids?.location || extractLocation(item.json.kids?.title_kids),
  duration_days: calculateDuration(item.json.sessions_json),
  programme_json: item.json.kids?.programme || null,
  inclusions_json: item.json.kids?.inclusions || null,
  logistics_json: item.json.kids?.logistics || null,
  // ------------------------

  sessions_json: typeof item.json.sessions_json === 'string' ? item.json.sessions_json : JSON.stringify(item.json.sessions_json),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

### Nouveau nœud Code : `ENRICH__STAY_METADATA`

Ce nœud doit être ajouté **AVANT** le nœud `FILTER__VALID_ITEMS_FOR_DB` pour enrichir les données avec :
- Extraction de la saison depuis le titre
- Extraction de la localisation depuis le titre
- Calcul de la durée
- Parsing du programme et des inclusions

---

## 6. Cartographie complète des données

### Flux de données

```
┌─────────────────┐
│  UFOVAL Site    │
│  (Scraping)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  n8n Workflow (extraction)      │
│  - Données brutes UFOVAL         │
│  - Enrichissement métier        │ ← NOUVEAU
│  - Filtrage                     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Supabase (stockage)            │
│  - gd_stays (+ nouveaux champs) │ ← À MODIFIER
│  - gd_stay_sessions             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  GED App (Frontend)             │
│  - Page listing                 │
│  - Page détail                  │
│  - Sous-domaine colonies        │
└─────────────────────────────────┘
```

### Mapping des champs

| App (listing) | App (détail) | Supabase | UFOVAL source | Priorité |
|---------------|--------------|----------|----------------|----------|
| title | title | title_pro | contentKids.title_kids | ✅ |
| description | description | description_kids | contentKids.description_kids | ✅ |
| dates (saison) | dates (saison) | season | contentKids.season | ❌ À AJOUTER |
| duration | duration | duration_days | Calculé depuis sessions | ⚠️ À CALCULER |
| age | age | age_min/age_max | sessions | ✅ |
| location | location | location | contentKids.location | ❌ À AJOUTER |
| - | programme | programme_json | contentKids.programme | ❌ À AJOUTER |
| - | logistics | logistics_json | contentKids.logistics | ❌ À AJOUTER |
| - | inclusions | inclusions_json | contentKids.inclusions | ❌ À AJOUTER |
| - | departure cities | city_departure | sessions | ✅ |

---

## 7. Plan d'action priorisé

### Phase 1 - Critique (pour MVP app)

1. ✅ **Exécuter le workflow n8n actuel** (4 nœuds déjà créés)
2. ✅ **Vérifier l'import dans Supabase**
3. ⚠️ **Ajouter les champs manquants critiques** :
   - `season` (Saison)
   - `location` (Lieu)
   - `duration_days` (Durée calculée)

### Phase 2 - Amélioration

4. **Extraire et stocker** `programme_json` (Programme détaillé)
5. **Extraire et stocker** `logistics_json` (Logistique)
6. **Extraire et stocker** `inclusions_json` (Inclusions)

### Phase 3 - Intégration Frontend

7. **Adapter l'app** pour utiliser les nouveaux champs Supabase
8. **Créer le sous-domaine** `colonies.ged.fr` (ou similaire)
9. **Tester l'affichage** des données enrichies

---

## 8. Exemple de données attendues

```json
// gd_stays (après enrichissement)
{
  "slug": "sejour-esport-courchevel",
  "title_pro": "Séjour E-sport and Sport à Courchevel",
  "title_kids": "E-sport et Sport à Courchevel",
  "season": "Été",
  "location": "Courchevel",
  "duration_days": 7,
  "age_min": 12,
  "age_max": 17,
  "programme_json": {
    "title": "Au programme",
    "items": [
      "Sessions d'e-sport encadrées",
      "Activités sportives variées",
      "Découverte de la montagne"
    ]
  },
  "inclusions_json": [
    "Sessions d'e-sport encadrées",
    "Activités sportives variées",
    "Hébergement et repas inclus"
  ],
  "logistics_json": {
    "lieu": "Courchevel (montagne)",
    "hebergement": "Résidence de tourisme Courchevel",
    "encadrement": "Encadrement professionnel"
  },
  "sessions_json": [...]
}

// gd_stay_sessions
{
  "stay_slug": "sejour-esport-courchevel",
  "start_date": "2026-07-19",
  "end_date": "2026-07-25",
  "seats_left": 30,
  "city_departure": "Paris",
  "price": 850
}
```

---

## 9. Checklist de validation

- [ ] Le workflow n8n extrait les données de base
- [ ] Les 4 nœuds Supabase fonctionnent
- [ ] Les données s'affichent dans l'app locale
- [ ] Saison et lieu sont correctement extraits
- [ ] La durée est calculée correctement
- [ ] Le programme s'affiche sur la page détail
- [ ] La logistique s'affiche sur la page détail
- [ ] Les villes de départ s'affichent
- [ ] Le sous-domaine colonies est configuré

---

**Document créé pour** : Planifier l'alignement des données entre n8n, Supabase et l'app GED
**Prochaine étape** : Implémenter les modifications du workflow n8n pour extraire les champs manquants
