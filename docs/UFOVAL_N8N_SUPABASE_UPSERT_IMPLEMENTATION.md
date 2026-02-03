# UFOVAL n8n → Supabase : Implémentation sans régression

**Workflow** : `GED__UFOVAL__SCRAPE_SEED_STAYS__v1`
**Date** : 30 janvier 2026
**Mode** : Economy Secure No Regression

---

## 🎯 Objectif

Ajouter l'écriture automatique dans Supabase (`gd_stays` + `gd_stay_sessions`) **SANS modifier** le comportement actuel d'export JSON du workflow n8n.

### Contraintes strictes
- ✅ JSON export reste identique (source de vérité)
- ✅ Upserts idempotents (re-run safe)
- ✅ Rollback instantané = désactiver 4 nouveaux nœuds
- ✅ Pas de breaking changes sur scraping/reformulation

---

## 📋 ÉTAPE 0 : Préflight - Vérifications préalables

### 0.1 Vérifier le chemin absolu du fichier JSON

**Via SSH sur Hostinger :**

```bash
# Se connecter au container n8n (adapter selon votre setup)
docker exec -it n8n /bin/sh
# OU si installation directe :
cd ~

# Trouver le répertoire de travail n8n
echo $N8N_USER_FOLDER
# Ou chercher manuellement
find / -name "ufoval_seed_*.json" 2>/dev/null | head -5

# Vérifier le fichier du jour
ls -lh /home/node/.n8n/docs/automations/GED/exports/ufoval_seed_2026-01-30.json
# OU le chemin que vous trouvez

# Compter les items
cat <CHEMIN_FICHIER> | jq '. | length'
# Devrait retourner ~30

# Vérifier la structure d'un item (le premier)
cat <CHEMIN_FICHIER> | jq '.[0] | keys'
# Doit contenir : source_url, sessions_json, pro, kids, slug...
```

**✅ Acceptation** :
- Chemin absolu confirmé
- Fichier existe avec ~30 items
- Champs obligatoires présents : `source_url`, `sessions_json`, `pro.title_pro`, `kids.title_kids`

---

## 📋 ÉTAPE 1 : Supabase - Index UNIQUE et guardrails

### 1.1 Créer les index de déduplication

Ouvrir **Supabase SQL Editor** et exécuter :

```sql
-- Index UNIQUE sur source_url pour éviter doublons de stays
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stays_source_url
ON public.gd_stays(source_url)
WHERE source_url IS NOT NULL;

-- Index UNIQUE composite pour éviter doublons de sessions
-- (même séjour + mêmes dates = 1 seule ligne)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
ON public.gd_stay_sessions(stay_slug, start_date, end_date);

-- Vérifier la création
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('gd_stays', 'gd_stay_sessions')
  AND indexname LIKE 'uniq_%';
```

**✅ Attendu** : 2 lignes retournées avec les noms d'index `uniq_gd_stays_source_url` et `uniq_gd_stay_sessions_slug_dates`.

### 1.2 Vérifier RLS et service role

```sql
-- Vérifier si RLS est actif
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('gd_stays', 'gd_stay_sessions');

-- Si rowsecurity = true, vérifier que le service role bypass fonctionne
-- (le service role key bypass automatiquement RLS, mais vérifier qu'il n'y a pas de policies bloquantes)
```

**Note** : Le service role key configuré dans n8n **bypass automatiquement RLS**. Pas d'action supplémentaire nécessaire.

---

## 📋 ÉTAPE 2 : n8n - Ajouter le nœud FILTER (optionnel mais recommandé)

### 2.1 Position dans le workflow

```
[Aggregate Final]
    ↓
[Format Export]
    ↓
[Write JSON Export]  ← NE PAS MODIFIER
    ↓
[FILTER__VALID_ITEMS_FOR_DB]  ← NOUVEAU ✨
    ↓ (branche TRUE)
[HTTP__UPSERT_GD_STAYS]
```

### 2.2 Configuration du nœud FILTER

**Type de nœud** : `IF` (ou `Filter` selon version n8n)
**Nom** : `FILTER__VALID_ITEMS_FOR_DB`

**Conditions (mode AND - toutes doivent être vraies) :**

| Champ | Opération | Valeur |
|-------|-----------|--------|
| `{{ $json.source_url }}` | is not empty | - |
| `{{ $json.pro.title_pro }}` | is not empty | - |
| `{{ $json.kids.title_kids }}` | is not empty | - |
| `{{ $json.sessions_json }}` | is not empty | - |

**Expression alternative (si mode expression disponible) :**

```javascript
{{
  $json.source_url &&
  $json.pro?.title_pro &&
  $json.kids?.title_kids &&
  ($json.sessions_json && (
    (Array.isArray($json.sessions_json) && $json.sessions_json.length > 0) ||
    (typeof $json.sessions_json === 'string' && $json.sessions_json.length > 2)
  ))
}}
```

**Routing** :
- **TRUE** → Continue vers HTTP__UPSERT_GD_STAYS
- **FALSE** → (optionnel) connecter à un nœud `No Operation` ou laisser terminer

---

## 📋 ÉTAPE 3 : n8n - Upsert gd_stays

### 3.1 Configuration du nœud HTTP Request

**Type** : `HTTP Request`
**Nom** : `HTTP__UPSERT_GD_STAYS`
**Connecté depuis** : `FILTER__VALID_ITEMS_FOR_DB` (sortie TRUE)

#### Paramètres de base

| Paramètre | Valeur |
|-----------|--------|
| **Method** | `POST` |
| **URL** | `={{ $credentials.supabase.host }}/rest/v1/gd_stays` |

**Note** : Si `$credentials.supabase.host` ne fonctionne pas, utiliser : `https://VOTRE_PROJECT_REF.supabase.co/rest/v1/gd_stays`

#### Query Parameters

| Nom | Valeur |
|-----|--------|
| `on_conflict` | `source_url` |

#### Headers

| Nom | Valeur |
|-----|--------|
| `apikey` | `={{ $credentials.supabase.serviceRoleKey }}` |
| `Authorization` | `Bearer {{ $credentials.supabase.serviceRoleKey }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=representation` |

**Note** : Adapter `$credentials.supabase.serviceRoleKey` au nom exact de votre credential n8n.

#### Body (Send Body : Yes, Body Content Type : JSON)

```javascript
={{
  $input.all().map(item => ({
    source_url: item.json.source_url,
    slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
    title_pro: item.json.pro.title_pro,
    title_kids: item.json.kids.title_kids,
    description_pro: item.json.pro?.description_pro || null,
    description_kids: item.json.kids?.description_kids || null,
    sessions_json: typeof item.json.sessions_json === 'string'
      ? item.json.sessions_json
      : JSON.stringify(item.json.sessions_json),
    import_batch_ts: new Date().toISOString()
  }))
}}
```

**Options avancées** :
- **Split Into Items** : `No` (on envoie un array)
- **Ignore SSL Issues** : `No`
- **Response Format** : `JSON`

---

## 📋 ÉTAPE 4 : n8n - Transform sessions en lignes

### 4.1 Configuration du nœud Function

**Type** : `Function` ou `Code`
**Nom** : `TRANSFORM__SESSIONS_TO_ROWS`
**Connecté depuis** : `HTTP__UPSERT_GD_STAYS`

#### Code JavaScript

```javascript
const output = [];

for (const item of $input.all()) {
  const stay = item.json;

  // Gérer sessions_json qui peut être string ou array
  let sessions = [];
  try {
    if (Array.isArray(stay.sessions_json)) {
      sessions = stay.sessions_json;
    } else if (typeof stay.sessions_json === 'string') {
      sessions = JSON.parse(stay.sessions_json);
    } else if (stay.sessions_json && typeof stay.sessions_json === 'object') {
      sessions = [stay.sessions_json]; // Single session as object
    }
  } catch (e) {
    console.error(`Failed to parse sessions_json for stay ${stay.slug}:`, e);
    continue;
  }

  // Créer une ligne par session
  for (const session of sessions) {
    output.push({
      json: {
        stay_slug: stay.slug || stay.source_url?.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
        start_date: session.start_date || session.date_debut || session.dateDebut || null,
        end_date: session.end_date || session.date_fin || session.dateFin || null,
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

**✅ Acceptation** : Le nœud doit produire N items où N = somme de toutes les sessions de tous les stays.

---

## 📋 ÉTAPE 5 : n8n - Upsert gd_stay_sessions

### 5.1 Configuration du nœud HTTP Request

**Type** : `HTTP Request`
**Nom** : `HTTP__UPSERT_GD_STAY_SESSIONS`
**Connecté depuis** : `TRANSFORM__SESSIONS_TO_ROWS`

#### Paramètres de base

| Paramètre | Valeur |
|-----------|--------|
| **Method** | `POST` |
| **URL** | `={{ $credentials.supabase.host }}/rest/v1/gd_stay_sessions` |

#### Query Parameters

| Nom | Valeur |
|-----|--------|
| `on_conflict` | `stay_slug,start_date,end_date` |

#### Headers

| Nom | Valeur |
|-----|--------|
| `apikey` | `={{ $credentials.supabase.serviceRoleKey }}` |
| `Authorization` | `Bearer {{ $credentials.supabase.serviceRoleKey }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=representation` |

#### Body (Send Body : Yes, Body Content Type : JSON)

```javascript
={{
  $input.all().map(item => ({
    stay_slug: item.json.stay_slug,
    start_date: item.json.start_date,
    end_date: item.json.end_date,
    seats_left: item.json.seats_left,
    city_departure: item.json.city_departure,
    price: item.json.price,
    age_min: item.json.age_min,
    age_max: item.json.age_max,
    import_batch_ts: item.json.import_batch_ts
  }))
}}
```

---

## 📋 ÉTAPE 6 : Validation Supabase

### 6.1 Requêtes SQL de vérification

Exécuter dans **Supabase SQL Editor** après un run du workflow :

```sql
-- 1. Compter les stays importés dans les dernières 24h
SELECT
  count(*) as total_stays,
  max(import_batch_ts) as last_import
FROM public.gd_stays
WHERE import_batch_ts >= (now() - interval '24 hours');
-- Attendu : ~30 stays

-- 2. Compter les sessions importées dans les dernières 24h
SELECT
  count(*) as total_sessions,
  max(import_batch_ts) as last_import
FROM public.gd_stay_sessions
WHERE import_batch_ts >= (now() - interval '24 hours');
-- Attendu : total cohérent avec la somme des sessions dans le JSON

-- 3. Vérifier l'absence de doublons de stays
SELECT
  source_url,
  count(*) as duplicates
FROM public.gd_stays
GROUP BY source_url
HAVING count(*) > 1;
-- Attendu : 0 lignes

-- 4. Vérifier l'absence de doublons de sessions
SELECT
  stay_slug,
  start_date,
  end_date,
  count(*) as duplicates
FROM public.gd_stay_sessions
GROUP BY stay_slug, start_date, end_date
HAVING count(*) > 1;
-- Attendu : 0 lignes

-- 5. Vérifier la cohérence stays ↔ sessions
SELECT
  s.slug,
  s.title_pro,
  count(ss.id) as session_count
FROM public.gd_stays s
LEFT JOIN public.gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.import_batch_ts >= (now() - interval '24 hours')
GROUP BY s.slug, s.title_pro
ORDER BY session_count DESC
LIMIT 10;
-- Vérifier que chaque stay a au moins 1 session

-- 6. Détecter les sessions orphelines (sans stay parent)
SELECT
  ss.stay_slug,
  count(*) as orphan_count
FROM public.gd_stay_sessions ss
LEFT JOIN public.gd_stays s ON s.slug = ss.stay_slug
WHERE s.id IS NULL
  AND ss.import_batch_ts >= (now() - interval '24 hours')
GROUP BY ss.stay_slug;
-- Attendu : 0 lignes
```

### 6.2 Critères de validation

| Test | Résultat attendu |
|------|------------------|
| Total stays importés | ~30 (ou nombre d'items valides après FILTER) |
| Total sessions importées | Somme cohérente avec sessions_json |
| Doublons stays | 0 |
| Doublons sessions | 0 |
| Sessions orphelines | 0 |
| Stays sans sessions | 0 (tous les stays doivent avoir ≥1 session) |

---

## 📋 ÉTAPE 7 : Rollback et désactivation rapide

### 7.1 Procédure de rollback (si problème en prod)

**Dans l'éditeur n8n :**

1. Ouvrir le workflow `GED__UFOVAL__SCRAPE_SEED_STAYS__v1`
2. **Désactiver** (bouton toggle) les 4 nouveaux nœuds :
   - ❌ `FILTER__VALID_ITEMS_FOR_DB`
   - ❌ `HTTP__UPSERT_GD_STAYS`
   - ❌ `TRANSFORM__SESSIONS_TO_ROWS`
   - ❌ `HTTP__UPSERT_GD_STAY_SESSIONS`
3. Sauvegarder le workflow
4. **Vérifier** : le prochain run doit produire le JSON export normalement, sans écriture DB

**✅ Résultat** : Retour au comportement exact d'avant (JSON export seul).

### 7.2 Grouping recommandé dans n8n

Pour faciliter l'identification et la désactivation :

1. Sélectionner les 4 nouveaux nœuds
2. Clic droit → `Add to group` ou utiliser la fonction de grouping
3. Nommer le groupe : `🔄 DB UPSERT (désactivable)`
4. Ajouter une note sticky :

```
⚠️ ROLLBACK RAPIDE
Pour désactiver l'écriture DB sans toucher au scraping :
1. Désactiver tous les nœuds de ce groupe
2. Le workflow continuera à produire le JSON export normalement
```

---

## 📋 ÉTAPE 8 : Tests end-to-end

### 8.1 Scénario de test complet

**Test 1 : Premier import (fresh data)**

1. Vider les tables (environnement de test uniquement) :
   ```sql
   TRUNCATE public.gd_stay_sessions, public.gd_stays CASCADE;
   ```

2. Exécuter le workflow n8n manuellement

3. Vérifier :
   - ✅ Fichier JSON créé avec timestamp du jour
   - ✅ ~30 stays dans `gd_stays`
   - ✅ N sessions dans `gd_stay_sessions` (N = total des sessions)
   - ✅ Aucun doublon

**Test 2 : Re-run (idempotence)**

1. **Sans modifier les données**, ré-exécuter le workflow immédiatement

2. Vérifier :
   - ✅ Fichier JSON mis à jour (nouveau timestamp)
   - ✅ Nombre de stays identique (upsert = merge, pas de nouveau insert)
   - ✅ Nombre de sessions identique
   - ✅ `import_batch_ts` mis à jour sur les lignes existantes

3. Requête de validation :
   ```sql
   SELECT
     'stays' as table_name,
     count(*) as total,
     count(DISTINCT import_batch_ts) as distinct_batch_ts
   FROM public.gd_stays
   UNION ALL
   SELECT
     'sessions',
     count(*),
     count(DISTINCT import_batch_ts)
   FROM public.gd_stay_sessions;
   ```
   **Attendu** : `distinct_batch_ts` = 1 (tous mis à jour au même moment lors du dernier run)

**Test 3 : Données incomplètes (filtre)**

1. Modifier manuellement 1 item dans le JSON export pour retirer `source_url`

2. Ré-exécuter le workflow

3. Vérifier :
   - ✅ L'item incomplet est filtré (n'apparaît pas en DB)
   - ✅ Les 29 autres items sont bien insérés/mis à jour
   - ✅ Aucune erreur dans les logs n8n

---

## 🎯 Definition of Done

### Checklist finale

- [ ] Le workflow produit `ufoval_seed_<date>.json` dans le dossier confirmé (chemin absolu vérifié)
- [ ] Le même run upsert ~30 stays dans `public.gd_stays`
- [ ] Le même run upsert toutes les sessions dans `public.gd_stay_sessions`
- [ ] Aucun doublon après 2 runs consécutifs (requêtes SQL de validation OK)
- [ ] `import_batch_ts` est identique pour tous les items d'un même run
- [ ] Les index UNIQUE sont actifs et empêchent les doublons manuels
- [ ] Si les 4 nouveaux nœuds sont désactivés, le workflow exporte le JSON exactement comme avant
- [ ] Documentation de rollback créée et testée
- [ ] Logs n8n ne montrent aucune erreur 5xx ou timeout Supabase

---

## 📚 Annexes

### A. Schéma des tables Supabase (référence)

```sql
-- Table gd_stays (simplifié)
CREATE TABLE IF NOT EXISTS public.gd_stays (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT UNIQUE NOT NULL,
  slug TEXT NOT NULL,
  title_pro TEXT NOT NULL,
  title_kids TEXT NOT NULL,
  description_pro TEXT,
  description_kids TEXT,
  sessions_json JSONB,
  import_batch_ts TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table gd_stay_sessions (simplifié)
CREATE TABLE IF NOT EXISTS public.gd_stay_sessions (
  id BIGSERIAL PRIMARY KEY,
  stay_slug TEXT NOT NULL REFERENCES public.gd_stays(slug) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  seats_left INTEGER,
  city_departure TEXT,
  price NUMERIC(10,2),
  age_min INTEGER,
  age_max INTEGER,
  import_batch_ts TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stay_slug, start_date, end_date)
);

-- Indexes (déjà créés à l'étape 1)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stays_source_url
ON public.gd_stays(source_url) WHERE source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
ON public.gd_stay_sessions(stay_slug, start_date, end_date);
```

### B. Mapping des champs JSON → DB

| JSON (scraped) | DB Column (stays) | Notes |
|----------------|-------------------|-------|
| `source_url` | `source_url` | UNIQUE, obligatoire |
| `slug` | `slug` | Généré si manquant |
| `pro.title_pro` | `title_pro` | Obligatoire |
| `kids.title_kids` | `title_kids` | Obligatoire |
| `pro.description_pro` | `description_pro` | Optionnel |
| `kids.description_kids` | `description_kids` | Optionnel |
| `sessions_json` | `sessions_json` | Stocké en JSONB |

| JSON (session) | DB Column (sessions) | Notes |
|----------------|----------------------|-------|
| `start_date` / `date_debut` | `start_date` | Partie de UNIQUE composite |
| `end_date` / `date_fin` | `end_date` | Partie de UNIQUE composite |
| `seats_left` / `places_restantes` | `seats_left` | Optionnel |
| `city_departure` / `ville_depart` | `city_departure` | Optionnel |
| `price` / `tarif` / `prix` | `price` | Optionnel |
| `age_min` | `age_min` | Optionnel |
| `age_max` | `age_max` | Optionnel |

### C. Variables n8n à adapter

Selon votre configuration de credentials n8n pour Supabase :

| Placeholder dans le doc | À remplacer par |
|-------------------------|-----------------|
| `{{ $credentials.supabase.host }}` | L'URL de votre projet Supabase OU le nom de votre credential |
| `{{ $credentials.supabase.serviceRoleKey }}` | Le nom exact du champ contenant la service role key |

**Exemple si credential nommé "Supabase Flooow" :**
```javascript
URL: {{ $credentials['Supabase Flooow'].url }}/rest/v1/gd_stays
Header: {{ $credentials['Supabase Flooow'].serviceKey }}
```

---

## ✅ Prochaines étapes

1. **Vérifier le chemin absolu** du JSON export (ÉTAPE 0)
2. **Créer les index UNIQUE** sur Supabase (ÉTAPE 1)
3. **Ajouter les 4 nouveaux nœuds** dans n8n (ÉTAPES 2-5)
4. **Tester** avec un run manuel (ÉTAPE 8)
5. **Valider** avec les requêtes SQL (ÉTAPE 6)
6. **Documenter** le rollback dans le workflow (ÉTAPE 7)

---

**Document généré le** : 30 janvier 2026
**Pour** : Projet Flooow – GED UFOVAL Scraper
**Mode** : No Regression – Safe to Deploy
