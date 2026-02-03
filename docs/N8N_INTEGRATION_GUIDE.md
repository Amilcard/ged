# Guide d'Intégration n8n → Supabase

**Workflow** : "Grattoir UFOVAL - Production GED"
**Date** : 30 janvier 2026
**Objectif** : Ajouter l'écriture automatique dans Supabase au workflow de scraping UFOVAL

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Configuration Supabase](#configuration-supabase)
4. [Ajout des 4 nœuds n8n](#ajout-des-4-nœuds-n8n)
5. [Validation](#validation)
6. [Rollback](#rollback)

---

## Vue d'ensemble

### Architecture actuelle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Workflow n8n existant                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Scraping] → [Reformulation] → [Enrichissement] → [Export JSON]│
│                                                                  │
│   Export vers : /path/to/ufoval_seed_YYYY-MM-DD.json           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture cible (avec les 4 nœuds)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Workflow n8n modifié                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Scraping] → [Reformulation] → [Enrichissement]               │
│                              ↓                                   │
│                    ┌─────────────────┐                          │
│                    │ FILTER (NOUVEAU)│                          │
│                    └─────────────────┘                          │
│                         ↓         ↓                              │
│                      TRUE      FALSE                             │
│                       ↓                                          │
│              ┌──────────────────┐                                │
│              │ HTTP Upsert      │                                │
│              │ gd_stays (NOUVEAU)│                              │
│              └──────────────────┘                                │
│                       ↓                                          │
│              ┌──────────────────┐                                │
│              │ Transform (NOUVEAU)│                               │
│              │ sessions→rows    │                                │
│              └──────────────────┘                                │
│                       ↓                                          │
│              ┌──────────────────┐                                │
│              │ HTTP Upsert      │                                │
│              │ gd_stay_sessions │                                │
│              │   (NOUVEAU)      │                                │
│              └──────────────────┘                                │
│                                                                  │
│   [Export JSON] ← PRÉSERVÉ (non modifié)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Les 4 nœuds à ajouter

| Ordre | Nom | Type | Description |
|-------|-----|------|-------------|
| 1 | `FILTER__VALID_ITEMS_FOR_DB` | IF | Filtre les items complets |
| 2 | `HTTP__UPSERT_GD_STAYS` | HTTP Request | Upsert des séjours |
| 3 | `TRANSFORM__SESSIONS_TO_ROWS` | Code | Transforme sessions en lignes |
| 4 | `HTTP__UPSERT_GD_STAY_SESSIONS` | HTTP Request | Upsert des sessions |

---

## Prérequis

### 1. Accès n8n

- **URL** : https://n8n.srv1307641.hstgr.cloud
- **Workflow ID** : `SqjOjFYjQfc9y2PD`
- **Nom** : "Grattoir UFOVAL - Production GED"

### 2. Accès Supabase

- **Project ID** : `iirfvndgzutbxwfdwawu`
- **Tables** : `gd_stays`, `gd_stay_sessions`
- **Service Role Key** : Nécessaire pour n8n (bypass RLS)

### 3. Fichiers de configuration locaux

- [`scripts/n8n/nodes-config.json`](../scripts/n8n/nodes-config.json) - Configuration des 4 nœuds
- [`scripts/n8n/validate-supabase.ts`](../scripts/n8n/validate-supabase.ts) - Script de validation

---

## Configuration Supabase

### Étape 1 : Ajouter les colonnes manquantes

Ouvrir le **SQL Editor** Supabase et exécuter :

```sql
-- Colonnes pour gd_stays
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS title_pro TEXT,
ADD COLUMN IF NOT EXISTS title_kids TEXT,
ADD COLUMN IF NOT EXISTS description_pro TEXT,
ADD COLUMN IF NOT EXISTS description_kids TEXT,
ADD COLUMN IF NOT EXISTS sessions_json JSONB,
ADD COLUMN IF NOT EXISTS import_batch_ts TIMESTAMPTZ DEFAULT now();

-- Colonnes pour gd_stay_sessions
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS city_departure TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER,
ADD COLUMN IF NOT EXISTS import_batch_ts TIMESTAMPTZ DEFAULT now();
```

Ou exécuter le script complet : [`docs/URGENT_ALTER_TABLES_ADD_COLUMNS.sql`](URGENT_ALTER_TABLES_ADD_COLUMNS.sql)

### Étape 2 : Créer les index UNIQUE

```sql
-- Index UNIQUE sur source_url pour éviter les doublons de stays
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stays_source_url
ON public.gd_stays(source_url)
WHERE source_url IS NOT NULL;

-- Index UNIQUE composite pour les sessions
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
ON public.gd_stay_sessions(stay_slug, start_date, end_date);
```

Ou exécuter : [`docs/supabase_setup_ufoval.sql`](supabase_setup_ufoval.sql)

### Étape 3 : Valider avec le script local

```bash
# Variables d'environnement
export SUPABASE_URL="https://iirfvndgzutbxwfdwawu.supabase.co"
export SUPABASE_SERVICE_KEY="votre_service_role_key"

# Exécuter la validation
npx tsx scripts/n8n/validate-supabase.ts
```

---

## Ajout des 4 nœuds n8n

### Point d'insertion

Ajouter les 4 nœuds **après** le nœud **"Enrichissement JSON de Sauvegarder"**.

### Méthode rapide (10 minutes)

#### Nœud 1 : FILTER__VALID_ITEMS_FOR_DB

1. Ajouter un nœud de type **IF**
2. Le nommer : `FILTER__VALID_ITEMS_FOR_DB`
3. Mode : **All conditions must be true**
4. Conditions :

| Value 1 | Operation |
|---------|-----------|
| `{{ $json.source_url }}` | is not empty |
| `{{ $json.pro.title_pro }}` | is not empty |
| `{{ $json.kids.title_kids }}` | is not empty |
| `{{ $json.sessions_json }}` | is not empty |

5. Connecter depuis **"Enrichissement JSON de Sauvegarder"**

---

#### Nœud 2 : HTTP__UPSERT_GD_STAYS

1. Ajouter un nœud **HTTP Request** depuis la sortie TRUE du FILTER
2. Le nommer : `HTTP__UPSERT_GD_STAYS`
3. Configuration :

| Paramètre | Valeur |
|-----------|--------|
| Method | `POST` |
| URL | `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url` |
| Authentication | Supabase API (votre credential) |

**Headers** :

| Nom | Valeur |
|-----|--------|
| Prefer | `resolution=merge-duplicates,return=representation` |

**Body** (JSON, Expression) :

```javascript
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  title: item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre',
  title_pro: item.json.pro?.title_pro,
  title_kids: item.json.kids?.title_kids,
  description_pro: item.json.pro?.description_pro || null,
  description_kids: item.json.kids?.description_kids || null,
  sessions_json: typeof item.json.sessions_json === 'string' ? item.json.sessions_json : JSON.stringify(item.json.sessions_json),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

---

#### Nœud 3 : TRANSFORM__SESSIONS_TO_ROWS

1. Ajouter un nœud **Code** (ou Function)
2. Le nommer : `TRANSFORM__SESSIONS_TO_ROWS`
3. Mode : **Run Once for All Items**
4. Code JavaScript :

```javascript
// Transformation sessions_json → lignes DB
const output = [];

for (const item of $input.all()) {
  const stay = item.json;

  // Parse sessions_json
  let sessions = [];
  try {
    if (Array.isArray(stay.sessions_json)) {
      sessions = stay.sessions_json;
    } else if (typeof stay.sessions_json === 'string') {
      sessions = JSON.parse(stay.sessions_json);
    } else if (stay.sessions_json && typeof stay.sessions_json === 'object') {
      sessions = [stay.sessions_json];
    }
  } catch (e) {
    console.error(`[TRANSFORM] Failed to parse sessions_json:`, e);
    continue;
  }

  const staySlug = stay.slug || (stay.source_url ?
    stay.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase() :
    null
  );

  if (!staySlug) {
    console.error('[TRANSFORM] Missing slug/source_url');
    continue;
  }

  // Créer une ligne par session
  for (const session of sessions) {
    const startDate = session.start_date || session.date_debut || session.dateDebut;
    const endDate = session.end_date || session.date_fin || session.dateFin;

    if (!startDate || !endDate) {
      console.warn('[TRANSFORM] Missing dates for session:', session);
      continue;
    }

    output.push({
      json: {
        stay_slug: staySlug,
        start_date: startDate,
        end_date: endDate,
        seats_left: session.seats_left ?? session.places_restantes ?? session.placesRestantes ?? null,
        city_departure: session.city_departure ?? session.ville_depart ?? session.villeDepart ?? null,
        price: session.price ?? session.tarif ?? session.prix ?? null,
        age_min: session.age_min ?? session.ageMin ?? null,
        age_max: session.age_max ?? session.ageMax ?? null,
        import_batch_ts: new Date().toISOString()
      }
    });
  }
}

return output;
```

---

#### Nœud 4 : HTTP__UPSERT_GD_STAY_SESSIONS

1. Ajouter un nœud **HTTP Request** depuis le nœud Code
2. Le nommer : `HTTP__UPSERT_GD_STAY_SESSIONS`
3. Configuration :

| Paramètre | Valeur |
|-----------|--------|
| Method | `POST` |
| URL | `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date` |
| Authentication | Supabase API (même credential) |

**Headers** :

| Nom | Valeur |
|-----|--------|
| Prefer | `resolution=merge-duplicates,return=representation` |

**Body** (JSON, Expression) :

```javascript
={{ $input.all().map(item => ({
  stay_slug: item.json.stay_slug,
  start_date: item.json.start_date,
  end_date: item.json.end_date,
  seats_left: item.json.seats_left,
  city_departure: item.json.city_departure,
  price: item.json.price,
  age_min: item.json.age_min,
  age_max: item.json.age_max,
  import_batch_ts: item.json.import_batch_ts
})) }}
```

---

### IMPORTANT : Préserver l'ancienne connexion

**Ne PAS supprimer** la connexion existante :
```
[Enrichissement JSON de Sauvegarder] → [Notifier Fin du S...]
```

Cette connexion garantit que l'export JSON continue de fonctionner.

---

## Validation

### 1. Dans n8n

1. Sauvegarder le workflow (**Save**)
2. Exécuter manuellement (**Execute Workflow**)
3. Vérifier que tous les nœuds passent en **vert**
4. Vérifier que le fichier JSON export est créé

### 2. Dans Supabase

Exécuter ces requêtes dans le **SQL Editor** :

```sql
-- Stays importés
SELECT count(*) as stays_importés,
       max(import_batch_ts) as dernier_import
FROM public.gd_stays
WHERE import_batch_ts >= now() - interval '5 minutes';
-- Attendu : ~30

-- Sessions importées
SELECT count(*) as sessions_importées
FROM public.gd_stay_sessions
WHERE import_batch_ts >= now() - interval '5 minutes';

-- Vérifier les doublons
SELECT source_url, count(*) as nb
FROM public.gd_stays
GROUP BY source_url
HAVING count(*) > 1;
-- Attendu : 0 lignes
```

### 3. Critères de succès

- ✅ ~30 stays dans `gd_stays`
- ✅ Sessions correspondantes dans `gd_stay_sessions`
- ✅ Aucun doublon
- ✅ JSON export créé (comportement préservé)
- ✅ `import_batch_ts` à jour

---

## Rollback

En cas de problème, le rollback est **immédiat et sans perte de données** :

1. Ouvrir le workflow dans n8n
2. **Désactiver** (toggle OFF) les 4 nouveaux nœuds :
   - ❌ FILTER__VALID_ITEMS_FOR_DB
   - ❌ HTTP__UPSERT_GD_STAYS
   - ❌ TRANSFORM__SESSIONS_TO_ROWS
   - ❌ HTTP__UPSERT_GD_STAY_SESSIONS
3. Sauvegarder le workflow

**Résultat** : Le workflow revient au comportement initial (JSON export uniquement).

---

## Ressources

### Fichiers de référence

| Fichier | Description |
|---------|-------------|
| [scripts/n8n/nodes-config.json](../scripts/n8n/nodes-config.json) | Configuration JSON des 4 nœuds |
| [scripts/n8n/validate-supabase.ts](../scripts/n8n/validate-supabase.ts) | Script de validation Supabase |
| [URGENT_ALTER_TABLES_ADD_COLUMNS.sql](URGENT_ALTER_TABLES_ADD_COLUMNS.sql) | Ajout des colonnes |
| [supabase_setup_ufoval.sql](supabase_setup_ufoval.sql) | Index UNIQUE |

### Documentation détaillée

- [GUIDE_ULTRA_SIMPLE_N8N.md](GUIDE_ULTRA_SIMPLE_N8N.md) - Guide débutant
- [N8N_QUICK_ADD_STEPS.md](N8N_QUICK_ADD_STEPS.md) - Version rapide
- [UFOVAL_N8N_SUPABASE_UPSERT_IMPLEMENTATION.md](UFOVAL_N8N_SUPABASE_UPSERT_IMPLEMENTATION.md) - Guide complet

---

## Support

En cas d'erreur :

1. **Vérifier les logs n8n** pour les messages d'erreur
2. **Vérifier les credentials Supabase** dans n8n
3. **Exécuter le script de validation** : `npx tsx scripts/n8n/validate-supabase.ts`
4. **Consulter la documentation** détaillée ci-dessus

---

**Document généré le** : 30 janvier 2026
**Pour** : GED - Groupe & Découverte
**Projet** : Intégration n8n → Supabase pour UFOVAL
