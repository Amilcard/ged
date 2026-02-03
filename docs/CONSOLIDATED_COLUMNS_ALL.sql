-- ============================================================================
-- SCRIPT CONSOLIDÉ : Toutes les colonnes pour l'intégration UFOVAL + App GED
-- ============================================================================
-- Date: 30 janvier 2026
-- Ce script regroupe tous les ALTER TABLE nécessaires pour:
--   1. L'import n8n UFOVAL (colonnes source)
--   2. L'app Colonies de Vacances (colonnes affichage)
--
-- À exécuter une seule fois dans le SQL Editor Supabase
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : Colonnes pour l'import UFOVAL (workflow n8n)
-- ============================================================================

-- Colonnes pour les titres différenciés (pro et kids)
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS title_pro TEXT,
ADD COLUMN IF NOT EXISTS title_kids TEXT;

-- Colonnes pour les descriptions
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS description_pro TEXT,
ADD COLUMN IF NOT EXISTS description_kids TEXT;

-- Colonne pour stocker les sessions en JSON brut (archive)
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS sessions_json JSONB;

-- Colonne pour tracer les imports (timestamp du batch d'import)
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS import_batch_ts TIMESTAMPTZ DEFAULT now();

-- Commentaires pour documentation
COMMENT ON COLUMN public.gd_stays.title_pro IS 'Titre du séjour destiné aux organisateurs/pros';
COMMENT ON COLUMN public.gd_stays.title_kids IS 'Titre du séjour destiné aux enfants/familles';
COMMENT ON COLUMN public.gd_stays.description_pro IS 'Description destinée aux organisateurs/pros';
COMMENT ON COLUMN public.gd_stays.description_kids IS 'Description destinée aux enfants/familles';
COMMENT ON COLUMN public.gd_stays.sessions_json IS 'Archive JSON brute des sessions scrapées depuis UFOVAL';
COMMENT ON COLUMN public.gd_stays.import_batch_ts IS 'Timestamp du dernier import n8n (permet de tracer les updates)';

-- Colonnes pour gd_stay_sessions (import UFOVAL)
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS city_departure TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER,
ADD COLUMN IF NOT EXISTS import_batch_ts TIMESTAMPTZ DEFAULT now();

-- Commentaires pour gd_stay_sessions
COMMENT ON COLUMN public.gd_stay_sessions.city_departure IS 'Ville de départ du séjour';
COMMENT ON COLUMN public.gd_stay_sessions.price IS 'Prix du séjour pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.age_min IS 'Âge minimum pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.age_max IS 'Âge maximum pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.import_batch_ts IS 'Timestamp du dernier import n8n';


-- ============================================================================
-- PARTIE 2 : Colonnes pour l'app Colonies de Vacances (affichage)
-- ============================================================================

-- Colonnes MVP pour le listing (Page d'accueil)
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS season TEXT CHECK (season IN ('Été', 'Hiver', 'Printemps', 'Automne', 'Fin d''année', 'Toutes saisons', 'Année complète')),
ADD COLUMN IF NOT EXISTS location_region TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- Commentaires MVP
COMMENT ON COLUMN public.gd_stays.season IS 'Saison de vacances (Été, Hiver, Printemps, Automne, Fin d''année)';
COMMENT ON COLUMN public.gd_stays.location_region IS 'Région géographique (Alpes, Méditerranée, Paris, etc.)';
COMMENT ON COLUMN public.gd_stays.location_city IS 'Ville ou lieu précis (Courchevel, Berlin, etc.)';
COMMENT ON COLUMN public.gd_stays.duration_days IS 'Durée du séjour en jours (calculée depuis sessions)';

-- Colonnes enrichies pour la page détail (Phase 2)
ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS programme_json JSONB,
ADD COLUMN IF NOT EXISTS inclusions_json JSONB,
ADD COLUMN IF NOT EXISTS logistics_json JSONB;

-- Commentaires Phase 2
COMMENT ON COLUMN public.gd_stays.programme_json IS 'Programme détaillé des activités (liste ou objet structuré)';
COMMENT ON COLUMN public.gd_stays.inclusions_json IS 'Ce qui est inclus (hébergement, repas, transports, etc.)';
COMMENT ON COLUMN public.gd_stays.logistics_json IS 'Informations logistiques: lieu, hébergement type, encadrement';


-- ============================================================================
-- PARTIE 3 : Index UNIQUE pour éviter les doublons (import n8n)
-- ============================================================================

-- Index UNIQUE sur source_url (clé de déduplication des stays)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stays_source_url
ON public.gd_stays(source_url)
WHERE source_url IS NOT NULL;

COMMENT ON INDEX public.uniq_gd_stays_source_url IS
'Empêche les doublons de stays : même source_url = upsert au lieu de insert';

-- Index UNIQUE composite sur stay_slug + dates (clé de déduplication des sessions)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
ON public.gd_stay_sessions(stay_slug, start_date, end_date);

COMMENT ON INDEX public.uniq_gd_stay_sessions_slug_dates IS
'Empêche les doublons de sessions : même stay + mêmes dates = upsert au lieu de insert';


-- ============================================================================
-- PARTIE 4 : Index pour optimiser les filtres de l'app
-- ============================================================================

-- Index sur season (pour filtrer par saison)
CREATE INDEX IF NOT EXISTS idx_gd_stays_season
ON public.gd_stays(season)
WHERE season IS NOT NULL;

-- Index sur location_region (pour filtrer par région)
CREATE INDEX IF NOT EXISTS idx_gd_stays_location_region
ON public.gd_stays(location_region)
WHERE location_region IS NOT NULL;

-- Index composite pour multi-filtres (saison + région)
CREATE INDEX IF NOT EXISTS idx_gd_stays_season_region
ON public.gd_stays(season, location_region)
WHERE season IS NOT NULL AND location_region IS NOT NULL;


-- ============================================================================
-- PARTIE 5 : Validation post-migration
-- ============================================================================

-- Vérifier toutes les nouvelles colonnes de gd_stays
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stays'
  AND column_name IN (
    'title_pro', 'title_kids', 'description_pro', 'description_kids',
    'sessions_json', 'import_batch_ts',
    'season', 'location_region', 'location_city', 'duration_days',
    'programme_json', 'inclusions_json', 'logistics_json'
  )
ORDER BY column_name;

-- Résultat attendu : 13 lignes

-- Vérifier toutes les nouvelles colonnes de gd_stay_sessions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stay_sessions'
  AND column_name IN ('city_departure', 'price', 'age_min', 'age_max', 'import_batch_ts')
ORDER BY column_name;

-- Résultat attendu : 5 lignes

-- Vérifier tous les index créés
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('gd_stays', 'gd_stay_sessions')
  AND (indexname LIKE 'uniq_%' OR indexname LIKE 'idx_%')
ORDER BY tablename, indexname;

-- Résultat attendu : 5 lignes (2 uniq + 3 idx)


-- ============================================================================
-- RÉSUMÉ DES COLONNES AJOUTÉES
-- ============================================================================
-- Table gd_stays : 13 nouvelles colonnes
--   - Import UFOVAL : title_pro, title_kids, description_pro, description_kids, sessions_json, import_batch_ts (6)
--   - App MVP : season, location_region, location_city, duration_days (4)
--   - App Phase 2 : programme_json, inclusions_json, logistics_json (3)
--
-- Table gd_stay_sessions : 5 nouvelles colonnes
--   - Import UFOVAL : city_departure, price, age_min, age_max, import_batch_ts (5)
--
-- Index créés : 5 index
--   - Dédoublonnage : uniq_gd_stays_source_url, uniq_gd_stay_sessions_slug_dates (2)
--   - Filtres app : idx_gd_stays_season, idx_gd_stays_location_region, idx_gd_stays_season_region (3)
-- ============================================================================

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
-- Instructions d'exécution :
-- 1. Copier tout ce script
-- 2. Coller dans le SQL Editor de Supabase
-- 3. Cliquer sur "Run"
-- 4. Vérifier que les requêtes de validation retournent les résultats attendus
-- 5. Une fois validé, revenir vers Claude pour continuer la config n8n
--
-- Note importante :
-- - Les colonnes existantes ne sont PAS modifiées
-- - Aucune donnée existante n'est perdue
-- - IF NOT EXISTS permet de relancer le script sans erreur
-- ============================================================================
