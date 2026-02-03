# Synthèse : Modifications SQL + Workflow n8n pour l'app Colonies de Vacances

**Date** : 31 janvier 2026
**Workflow n8n** : "Grattoir UFOVAL - Production GED" (ID: `SqjOjFYjQfc9y2PD`)
**Objectif** : Aligner les données extraites par n8n avec l'affichage de l'app GED

---

## 1. Pourquoi ces modifications ?

### Problème identifié
L'app Colonies de Vacances affiche des informations qui **ne sont pas extraites** par le workflow n8n actuel.

| Champ affiché dans l'app | Disponible dans UFOVAL ? | Extrait par n8n ? | Stocké dans Supabase ? |
|--------------------------|-------------------------|-------------------|------------------------|
| Saison (badge "Été") | ✅ Oui | ❌ Non | ❌ Non |
| Lieu (Berlin, Courchevel) | ✅ Oui | ❌ Non | ❌ Non |
| Durée (7, 12 jours) | ✅ Oui (calculable) | ❌ Non | ❌ Non |
| Programme détaillé | ✅ Oui | ❌ Non | ❌ Non |
| Logistique (hébergement, etc.) | ✅ Oui | ❌ Non | ❌ Non |
| Inclusions (repas, etc.) | ✅ Oui | ❌ Non | ❌ Non |

### Solution proposée
1. **Ajouter les colonnes dans Supabase** → Script `CONSOLIDATED_COLUMNS_ALL.sql`
2. **Modifier le workflow n8n** → Extraire ces nouvelles données
3. **L'app utilise les nouvelles colonnes** → Affichage cohérent

---

## 2. Les 4 parties du script SQL consolidé

### Partie 1 : Colonnes pour l'import UFOVAL (workflow n8n)

**Pourquoi ?** Le workflow n8n a besoin de colonnes spécifiques pour stocker les données brutes venant d'UFOVAL.

```sql
-- Table gd_stays
title_pro, title_kids, description_pro, description_kids, sessions_json, import_batch_ts

-- Table gd_stay_sessions
city_departure, price, age_min, age_max, import_batch_ts
```

**Usage dans l'app :**
- `title_kids` → Titre affiché dans la card du listing
- `description_kids` → Description courte dans la card
- `city_departure` → Liste des villes de départ (page détail)
- `price` → Prix affiché en mode Pro
- `age_min`, `age_max` → Tranche d'âge affichée (ex: "12-17 ans")

### Partie 2 : Colonnes pour l'app Colonies de Vacances (affichage)

**Pourquoi ?** L'app affiche des informations qui ne sont pas dans les données de base d'UFOVAL.

```sql
-- MVP Listing (page d'accueil)
season, location_region, location_city, duration_days

-- Phase 2 Détail (page détail d'un séjour)
programme_json, inclusions_json, logistics_json
```

**Usage dans l'app :**
| Colonne | Écran | Usage |
|---------|-------|------|
| `season` | Listing | Badge "Été", filtre par saison |
| `location_region` | Listing | Filtre par région (Alpes, Méditerranée, etc.) |
| `location_city` | Listing | Nom du lieu (Courchevel, Berlin, etc.) |
| `duration_days` | Listing | Durée affichée (ex: "7 jours") |
| `programme_json` | Détail | Liste des activités du séjour |
| `inclusions_json` | Détail | Ce qui est inclus (hébergement, repas, etc.) |
| `logistics_json` | Détail | Lieu, type d'hébergement, encadrement |

### Partie 3 : Index UNIQUE pour éviter les doublons

**Pourquoi ?** Le workflow n8n utilise `UPSERT` (INSERT ou UPDATE si existe). Sans ces index UNIQUE, on aurait des doublons.

```sql
-- Empêche les doublons de stays (même source_url = même séjour)
CREATE UNIQUE INDEX uniq_gd_stays_source_url ON gd_stays(source_url)

-- Empêche les doublons de sessions (même séjour + mêmes dates = même session)
CREATE UNIQUE INDEX uniq_gd_stay_sessions_slug_dates ON gd_stay_sessions(stay_slug, start_date, end_date)
```

**Cohérence avec l'app :**
- L'affichage ne présente pas de doublons
- Chaque séjour a une page détail unique (basée sur slug)

### Partie 4 : Index pour optimiser les filtres de l'app

**Pourquoi ?** L'app a des filtres (saison, région). Sans index, la requête serait lente avec beaucoup de séjours.

```sql
CREATE INDEX idx_gd_stays_season ON gd_stays(season)
CREATE INDEX idx_gd_stays_location_region ON gd_stays(location_region)
CREATE INDEX idx_gd_stays_season_region ON gd_stays(season, location_region)
```

**Cohérence avec l'app :**
- Filtre rapide sur la page listing
- Recherche multi-critères fluide

---

## 3. Cohérence avec les écrans de la Webapp

### Page Listing (Page d'accueil)

```
┌─────────────────────────────────────────────────────────┐
│  Colonies de Vacances                          [Filtres] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Été]  E-sport et Sport à Courchevel            │    │
│  │        12-17 ans • 7 jours • Alpes              │    │
│  │                                                 │    │
│  │  Des sessions d'e-sport encadrées...            │    │
│  │  Hébergement inclus • Places disponibles        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Été]  Séjour linguistique Berlin               │    │
│  │        10-15 ans • 12 jours • Allemagne         │    │
│  │                                                 │    │
│  │  Découverte de Berlin + cours d'allemand...     │    │
│  │  Hébergement inclus • Places disponibles        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Mapping données → Affichage :**

| Élément affiché | Colonne Supabase | Source UFOVAL |
|----------------|------------------|---------------|
| Badge "Été" | `season` | `contentKids.season` |
| Titre "E-sport et Sport..." | `title_kids` | `contentKids.title_kids` |
| "12-17 ans" | `age_min`, `age_max` | (from sessions) |
| "7 jours" | `duration_days` | Calculé depuis sessions |
| "Alpes" | `location_region` | `contentKids.location` |
| "Courchevel" | `location_city` | `contentKids.location` |
| Description | `description_kids` | `contentKids.description_kids` |
| "Hébergement inclus" | `inclusions_json` | `contentKids.inclusions` |
| "Places disponibles" | `seats_left` | (from sessions) |

### Page Détail (Détail d'un séjour)

```
┌─────────────────────────────────────────────────────────┐
│  E-sport et Sport à Courchevel                          │
│  12-17 ans • Été • Alpes                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📅 Sessions disponibles                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 19 juillet 2026 - 25 juillet 2026               │    │
│  │ Paris • Lyon • Marseille • 30 places            │    │
│  │ Prix : 850€                                     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  📍 Lieu : Courchevel (montagne)                        │
│  🏠 Hébergement : Résidence de tourisme Courchevel      │
│  👨‍🏫 Encadrement : Encadrement professionnel            │
│                                                          │
│  📋 Au programme                                        │
│  • Sessions d'e-sport encadrées                         │
│  • Activités sportives variées                          │
│  • Découverte de la montagne                            │
│                                                          │
│  ✅ Ce qui est inclus                                   │
│  • Sessions d'e-sport encadrées                         │
│  • Activités sportives variées                          │
│  • Hébergement et repas inclus                         │
└─────────────────────────────────────────────────────────┘
```

**Mapping données → Affichage :**

| Section | Colonne Supabase | Source UFOVAL |
|---------|------------------|---------------|
| Dates sessions | `start_date`, `end_date` | (from sessions) |
| Villes départ | `city_departure` | (from sessions) |
| Places | `seats_left` | (from sessions) |
| Prix | `price` | (from sessions) |
| Lieu | `logistics_json.lieu` | `contentKids.logistics` |
| Hébergement | `logistics_json.hebergement` | `contentKids.logistics` |
| Encadrement | `logistics_json.encadrement` | `contentKids.logistics` |
| Programme | `programme_json` | `contentKids.programme` |
| Inclusions | `inclusions_json` | `contentKids.inclusions` |

---

## 4. Modifications du workflow n8n requises

### ⚠️ RÉPONSE À LA QUESTION : Faut-il créer/modifier des nœuds ?

**OUI**, il faut modifier le workflow n8n existant. Voici pourquoi et comment :

#### Pourquoi modifier le workflow ?

Le workflow actuel extrait les données de base mais **pas les nouveaux champs**. Pour que l'affichage soit cohérent, il faut :

1. Extraire `season`, `location`, `duration_days` depuis les données UFOVAL
2. Extraire `programme`, `inclusions`, `logistics` depuis `contentKids`
3. Envoyer ces nouvelles données dans les requêtes Supabase

#### Modifications à apporter (SANS créer de nouveaux nœuds)

Les 4 nœuds créés précédemment existent déjà dans le workflow. Il faut les **modifier** pour inclure les nouvelles colonnes :

**Nœud `HTTP__UPSERT_GD_STAYS` - Modifier le Body :**

```javascript
// AVANT (version actuelle)
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || generateSlug(item.json.source_url),
  title_pro: item.json.pro?.title_pro,
  title_kids: item.json.kids?.title_kids,
  description_pro: item.json.pro?.description_pro,
  description_kids: item.json.kids?.description_kids,
  sessions_json: JSON.stringify(item.json.sessions),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}

// APRÈS (avec nouveaux champs)
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || generateSlug(item.json.source_url),
  title_pro: item.json.pro?.title_pro,
  title_kids: item.json.kids?.title_kids,
  description_pro: item.json.pro?.description_pro,
  description_kids: item.json.kids?.description_kids,

  // --- NOUVEAUX CHAMPS APP ---
  season: extractSeason(item.json.kids) || null,
  location_region: extractRegion(item.json.kids?.location) || null,
  location_city: extractCity(item.json.kids?.location) || null,
  duration_days: calculateDuration(item.json.sessions) || null,
  programme_json: item.json.kids?.programme || null,
  inclusions_json: item.json.kids?.inclusions || null,
  logistics_json: item.json.kids?.logistics || null,
  // ---------------------------

  sessions_json: JSON.stringify(item.json.sessions),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

**Nouveau nœud Code `ENRICH__EXTRACT_METADATA` - À AJOUTER :**

Ce nœud doit être inséré **AVANT** le nœud `FILTER__VALID_ITEMS_FOR_DB` pour extraire les métadonnées :

```javascript
// Code JavaScript pour le nœud ENRICH__EXTRACT_METADATA
const enrichedItems = $input.all().map(item => {
  const json = item.json;

  // Extraire la saison depuis le titre ou le contenu
  const season = extractSeason(json);

  // Extraire la localisation
  const location = json.kids?.location || extractLocationFromTitle(json.kids?.title_kids);
  const { region, city } = parseLocation(location);

  // Calculer la durée
  const durationDays = calculateDuration(json.sessions);

  // Extraire programme, inclusions, logistique
  const programme = json.kids?.programme || null;
  const inclusions = json.kids?.inclusions || null;
  const logistics = json.kids?.logistics || null;

  return {
    json: {
      ...json,
      season,
      location_region: region,
      location_city: city,
      duration_days: durationDays,
      programme_json: programme,
      inclusions_json: inclusions,
      logistics_json: logistics
    }
  };
});

return enrichedItems;

// --- Fonctions helper ---

function extractSeason(json) {
  // Priorité : champ explicite > détection depuis titre > null
  if (json.kids?.season) return json.kids.season;

  const title = (json.kids?.title_kids || json.pro?.title_pro || '').toLowerCase();
  if (title.includes('été') || title.includes('ete')) return 'Été';
  if (title.includes('hiver')) return 'Hiver';
  if (title.includes('printemps')) return 'Printemps';
  if (title.includes('automne')) return 'Automne';
  if (title.includes('noël') || title.includes('noel')) return 'Fin d''année';

  return null;
}

function extractLocationFromTitle(title) {
  if (!title) return null;

  // Liste de villes/lieux connus
  const locations = ['Courchevel', 'Berlin', 'Paris', 'Lyon', 'Marseille',
                     'Alpes', 'Méditerranée', 'Montagne', 'Mer'];

  for (const loc of locations) {
    if (title.includes(loc)) return loc;
  }

  return null;
}

function parseLocation(location) {
  if (!location) return { region: null, city: null };

  // Mapping des régions
  const regions = {
    'Alpes': 'Alpes',
    'Montagne': 'Alpes',
    'Méditerranée': 'Méditerranée',
    'Mer': 'Méditerranée',
    'Berlin': 'Allemagne',
    'Paris': 'Île-de-France'
  };

  // Extraction simple
  let region = null;
  let city = location;

  for (const [key, value] of Object.entries(regions)) {
    if (location.includes(key)) {
      region = value;
      if (key !== location) {
        city = location.replace(key, '').trim();
      }
      break;
    }
  }

  return { region, city: city || null };
}

function calculateDuration(sessions) {
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  // Prendre la première session pour calculer la durée
  const firstSession = sessions[0];
  if (firstSession.startDate && firstSession.endDate) {
    const start = new Date(firstSession.startDate);
    const end = new Date(firstSession.endDate);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return days;
  }

  return null;
}
```

#### Nouvelle topologie du workflow

```
┌─────────────────────────────────────┐
│  Scraping UFOVAL (existant)         │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  ENRICH__EXTRACT_METADATA (NOUVEAU) │  ← Extrait saison, lieu, durée
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  FILTER__VALID_ITEMS_FOR_DB         │  ← Existe déjà
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  HTTP__UPSERT_GD_STAYS              │  ← MODIFIER : ajouter nouveaux champs
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  TRANSFORM__SESSIONS_TO_ROWS        │  ← Existe déjà
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  HTTP__UPSERT_GD_STAY_SESSIONS      │  ← Existe déjà
└─────────────────────────────────────┘
```

---

## 5. Checklist de mise en œuvre

### Étape 1 : Base de données (Supabase)
- [ ] Exécuter `CONSOLIDATED_COLUMNS_ALL.sql` dans le SQL Editor
- [ ] Vérifier que les 13 colonnes sont créées sur `gd_stays`
- [ ] Vérifier que les 5 colonnes sont créées sur `gd_stay_sessions`
- [ ] Vérifier que les 5 index sont créés

### Étape 2 : Workflow n8n
- [ ] Ajouter le nœud `ENRICH__EXTRACT_METADATA` après le scraping
- [ ] Modifier le nœud `HTTP__UPSERT_GD_STAYS` pour inclure les nouveaux champs
- [ ] Tester le workflow en mode exécution unique
- [ ] Vérifier que les nouvelles colonnes sont remplies dans Supabase

### Étape 3 : App GED
- [ ] Mettre à jour les composants pour utiliser `season`, `location_region`, `duration_days`
- [ ] Mettre à jour la page détail pour afficher `programme_json`, `inclusions_json`, `logistics_json`
- [ ] Tester l'affichage avec les nouvelles données

---

## 6. Résumé pour une autre IA

Si une autre IA reprend ce projet, voici ce qu'elle doit savoir :

**Contexte :**
- Projet GED (Groupe & Découverte) : plateforme de séjours éducatifs pour enfants
- Workflow n8n "Grattoir UFOVAL" : scrape les données depuis ufoval.fr
- App Next.js : interface publique (kids) et pro (organisateurs)

**Problème résolu :**
L'app affichait des informations (saison, lieu, durée, programme) qui n'étaient pas extraites par le workflow n8n.

**Solution :**
1. **SQL** : Ajouter 18 colonnes (13 pour gd_stays, 5 pour gd_stay_sessions) + 5 index
2. **n8n** : Modifier le workflow pour extraire et envoyer ces nouvelles données
3. **App** : Utiliser les nouvelles colonnes pour l'affichage

**Fichiers clés :**
- `docs/CONSOLIDATED_COLUMNS_ALL.sql` - Script SQL complet
- `docs/APP_DATA_ALIGNMENT_ANALYSIS.md` - Analyse des écarts app/workflow
- `docs/N8N_INTEGRATION_GUIDE.md` - Guide d'intégration n8n
- `docs/N8N_4_NODES_CONFIG_READY_TO_PASTE.json` - Configuration des 4 nœuds

**Workflow n8n ID :** `SqjOjFYjQfc9y2PD`
**Supabase project :** `iirfvndgzutbxwfdwawu`
**Tables :** `gd_stays`, `gd_stay_sessions`

---

**Document créé pour :** Permettre à une autre IA de comprendre les modifications et continuer le développement
**Prochaine étape :** Exécuter le SQL consolidé, puis modifier le workflow n8n
