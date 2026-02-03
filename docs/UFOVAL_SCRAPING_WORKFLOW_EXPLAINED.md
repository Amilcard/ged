# Workflow Complet : Scraping UFOVAL → Supabase → App GED

**Date** : 31 janvier 2026
**Objectif** : Expliquer comment les 18 séjours UFOVAL arrivent dans l'app GED

---

## 📊 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                      18 SÉJOURS UFOVAL                          │
│         https://ufoval.fol74.org/sejours-*.html                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SCRIPTS LOCAL (TypeScript)                   │
│                    scripts/ufoval/*.ts                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FICHIERS JSON STRUCTURÉS                      │
│                   out/ufoval/*.json                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WORKFLOW n8n                               │
│              (lit le JSON → envoie à Supabase)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                   │
│              gd_stays + gd_stay_sessions                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APP GED (Next.js)                          │
│         Colonies de Vacances (listing + détail)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Scripts locaux de scraping

### 1. **extract-sessions.ts** - Dates + Prix

**Fichier** : `scripts/ufoval/extract-sessions.ts`

**Input** : `out/ufoval/rewrite_ready_for_supabase.json` (18 URLs)
**Output** : `out/ufoval/ufoval_sessions.json`

**Ce qu'il fait :**
- Télécharge le HTML de chaque page UFOVAL
- Extrait les sessions (dates + prix) depuis les tableaux et cartes
- Parse les prix en euros (ex: "1 234,56 €" → 1234.56)
- Calcule la durée en jours

**Structure de sortie :**
```json
{
  "generatedAt": "2026-01-26T...",
  "total": 18,
  "ok": 18,
  "results": [
    {
      "id": "natation-et-sensation",
      "source_url": "https://ufoval.fol74.org/...",
      "ok": true,
      "sessions": [
        {
          "start_date": "2026-07-18",
          "end_date": "2026-07-31",
          "base_price_eur": 1095,
          "promo_price_eur": null,
          "duration_days": 13
        }
      ]
    }
  ]
}
```

---

### 2. **extract-departures-and-prices.ts** - Villes de départ

**Fichier** : `scripts/ufoval/extract-departures-and-prices.ts`

**Input** : `out/ufoval/rewrite_ready_for_supabase.json`
**Output** : `out/ufoval/ufoval_departures_prices.json`

**Ce qu'il fait :**
- Extrait les villes de départ depuis le HTML
- Extrait les suppléments transport
- Associe chaque ville à un prix

---

### 3. **merge-departures-and-sessions.js** - Fusion

**Fichier** : `scripts/ufoval/merge-departures-and-sessions.js`

**Input** :
- `out/ufoval/ufoval_sessions.json`
- `out/ufoval/ufoval_departures_prices.json`

**Output** : `out/ufoval/ufoval_enrichment_full.json`

**Ce qu'il fait :**
- Fusionne sessions + départs dans un seul JSON
- Chaque séjour a toutes ses sessions avec prix et villes

---

### 4. **enrich-facts.ts** - Lieu + Hébergement

**Fichier** : `scripts/ufoval/enrich-facts.ts`

**Ce qu'il fait :**
- Extrait le lieu (geoLabel) depuis le HTML
- Détecte le type de lieu (mer, montagne, forêt) depuis l'URL
- Extrait le type d'hébergement (centre, auberge, camping)
- Extrait les équipements (chambres, sanitaires, etc.)

**Règles d'extraction :**
- **Règle A** : geoLabel doit être valide (longueur ≥ 4, pas de blacklist)
- **Règle B** : geoPrecision depuis l'URL (plus fiable)
- **Règle C** : accommodationType uniquement si bloc "Hébergement" trouvé

---

## 📁 Fichiers JSON de sortie

### rewrite_ready_final.json ⭐ LE PLUS IMPORTANT

**Chemin** : `out/ufoval/rewrite_ready_final.json`
**Date** : 28 janvier 2026 à 11:06
**Contenu** : 18 séjours complets

**Structure d'un séjour :**
```json
{
  "source_url": "https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-mer/natation-et-sensation?av=1115",
  "source_partner": "UFOVAL",
  "age_min": 6,
  "age_max": 8,
  "location_name": "Saint-Raphaël",

  "sessions_json": [
    {
      "start_date": "2026-07-18",
      "end_date": "2026-07-31",
      "price_base": 1095,
      "price_unit": "€",
      "capacity_remaining": null,
      "capacity_total": null,
      "status": "open"
    }
    // ... 6 autres sessions
  ],

  "pro": {
    "title_pro": "Natation et Sensation à Saint-Raphaël",
    "short_description_pro": "Un séjour éducatif et sécurisant...",
    "description_pro": "Ce séjour à Saint-Raphaël est conçu...",
    "program_brief_pro": ["Initiation et perfectionnement...", "Activités nautiques..."],
    "educational_option_pro": "Les enfants développeront...",
    "departure_city_info": "Départ à confirmer"
  },

  "kids": {
    "title_kids": "Natation et Sensation",
    "short_description_kids": "Apprends à nager et amuse-toi !",
    "description_kids": "Viens à Saint-Raphaël pour un séjour plein de fun...",
    "program_brief_kids": ["Apprends à nager", "Joue dans l'eau"],
    "educational_option_kids": "Tu vas apprendre à nager comme un pro...",
    "departure_city_info_kids": "Départ à confirmer"
  },

  "generated_at": "2026-01-26T16:28:50.348Z",
  "model": "gpt-4o"
}
```

**Champs attendus par le filtre n8n :**
| Champ n8n | Champ JSON | Statut |
|-----------|------------|--------|
| `$json.source_url` | `source_url` | ✅ |
| `$json.pro?.title_pro` | `pro.title_pro` | ✅ |
| `$json.kids?.title_kids` | `kids.title_kids` | ✅ |
| `$json.sessions_json` | `sessions_json` | ✅ |

---

## 🔗 Workflow n8n

### Workflow : GED__UFOVAL__SCRAPE_SEED_STAYS__v1

**URL** : https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H

### Rôle du workflow n8n

**IMPORTANT :** Le workflow n8n **NE FAIT PAS DE SCRAPPING**.

Les scripts TypeScript ont déjà fait le scraping. Le workflow n8n doit seulement :
1. Lire le fichier `rewrite_ready_final.json`
2. Envoyer les données à Supabase

### Topologie actuelle (cassée)

```
[Scraping UFOVAL] → [Calculer le prix du GED]
                                    │
                                    ├─→ [Export JSON] ✅
                                    │
                          X─────────┴─────┐
                                           │
                                           ▼
                          [FILTER__ARTICLES_VALIDES]
                                           │
                                           ▼
                          [HTTP__UPSERT_GD_STAYS]
                                           │
                                           ▼
                          [TRANSFORM__SESSIONS_TO_ROWS]
                                           │
                                           ▼
                          [HTTP__UPSERT_GD_STAY_SESSIONS]
```

### Problème

La branche Supabase **n'est pas connectée** au flux principal.

### Solution

Connecter **"Calculer le prix du GED"** → **FILTER__ARTICLES_VALIDES**

---

## 🗄️ Supabase

### Tables

**gd_stays** (18 lignes attendues)
```sql
CREATE TABLE gd_stays (
  id SERIAL PRIMARY KEY,
  source_url TEXT UNIQUE,           -- Clé unique pour upsert
  slug TEXT,
  title_pro TEXT,
  title_kids TEXT,
  description_pro TEXT,
  description_kids TEXT,
  sessions_json JSONB,
  import_batch_ts TIMESTAMPTZ
);
```

**gd_stay_sessions** (~100 lignes attendues, 5-7 sessions par séjour)
```sql
CREATE TABLE gd_stay_sessions (
  id SERIAL PRIMARY KEY,
  stay_slug TEXT,
  start_date DATE,
  end_date DATE,
  seats_left INTEGER,
  city_departure TEXT,
  price NUMERIC(10,2),
  age_min INTEGER,
  age_max INTEGER,
  import_batch_ts TIMESTAMPTZ,
  UNIQUE (stay_slug, start_date, end_date)
);
```

### Colonnes manquantes pour l'app

**À ajouter avec `CONSOLIDATED_COLUMNS_ALL.sql` :**

**gd_stays** - MVP (affichage listing) :
- `season` : "Été", "Hiver", etc.
- `location_region` : "Alpes", "Méditerranée"
- `location_city` : "Courchevel", "Berlin"
- `duration_days` : 7, 12, etc.

**gd_stays** - Phase 2 (page détail) :
- `programme_json` : Programme détaillé
- `inclusions_json` : Ce qui est inclus
- `logistics_json` : Lieu, hébergement, encadrement

---

## 📱 App GED (Next.js)

### Pages

**Listing** (`/` ou sous-domaine colonies)
- Affiche les 18 séjours avec :
  - Badge saison
  - Titre (title_kids)
  - Durée
  - Lieu
  - Tranche d'âge
  - Tags (Hébergement inclus)

**Détail** (`/sejour/[slug]`)
- Affiche :
  - Sessions avec dates
  - Villes de départ
  - Prix (mode Pro)
  - Programme
  - Logistique
  - Inclusions

### Problème d'alignement

L'app affiche des données qui ne sont pas encore extraites :
- Saison (season) → À extraire depuis le titre ou l'URL
- Lieu (location_city) → Déjà dans `location_name`
- Programme → À extraire depuis `pro.program_brief_pro`

---

## 🎯 Pour une autre IA

### Ce qui est déjà fait

1. ✅ **Scripts TypeScript** : Scraping complet des 18 séjours UFOVAL
2. ✅ **JSON structuré** : `rewrite_ready_final.json` avec toutes les données
3. ✅ **Tables Supabase** : `gd_stays` et `gd_stay_sessions` créées
4. ✅ **4 nœuds n8n** : Créés mais pas connectés au flux

### Ce qui reste à faire

1. **CONNECTER** le workflow n8n :
   - Connecter "Calculer le prix du GED" → FILTER
   - Ou faire lire le JSON `rewrite_ready_final.json` directement

2. **Exécuter le SQL** :
   - `CONSOLIDATED_COLUMNS_ALL.sql` pour ajouter les colonnes manquantes

3. **Modifier le workflow** pour extraire les nouveaux champs :
   - season
   - location_region
   - duration_days
   - etc.

### Fichiers de référence

| Fichier | Usage |
|---------|-------|
| `out/ufoval/rewrite_ready_final.json` | JSON des 18 séjours (SOURCE DE VÉRITÉ) |
| `docs/CONSOLIDATED_COLUMNS_ALL.sql` | Script SQL à exécuter |
| `docs/N8N_CONNECTION_PROBLEM.md` | Problème de connexion n8n |
| `docs/WORKFLOW_CHANGES_EXPLAINED.md` | Explications des modifications |
| `docs/N8N_4_NODES_CONFIG_READY_TO_PASTE.json` | Configuration des 4 nœuds |

---

## 📋 Les 18 séjours UFOVAL

```
1. Natation et Sensation (Saint-Raphaël, mer)
2. Aqua Gliss
3. Les Robinson des Glières (montagne)
4. Les Apprentis Montagnards (montagne)
5. L'Aventure Verticale (mer)
6. Aqua Mix
7. Explore Mountain (montagne)
8. Nature Picture (montagne)
9. Aqua Fun (mer)
10. Mountain and Chill (montagne)
11. DH Expérience 11-13 ans (montagne)
12. Spérenza in Corsica (Corse, mer)
13. Destination Soleil (mer)
14. Annecy Element (Annecy)
15. Surf sur le Bassin (Ocean)
16. Moto Moto (montagne)
17. E-sport and Sport (Courchevel, montagne)
18. Street Art et Histoire (étranger)
```

---

**Document créé pour** : Permettre à une autre IA de comprendre le flux complet de données UFOVAL
**Date** : 31 janvier 2026
**Prochaine étape** : Connecter le workflow n8n et exécuter le SQL
