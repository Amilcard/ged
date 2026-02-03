-- ============================================================================
-- URGENT : Ajout des colonnes manquantes pour l'import UFOVAL
-- ============================================================================
-- Date: 2026-01-30
-- Action: ALTER TABLE pour ajouter les colonnes nécessaires à l'import n8n
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ÉTAPE 1 : Ajouter les colonnes manquantes à gd_stays
-- ----------------------------------------------------------------------------

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
COMMENT ON COLUMN public.gd_stays.sessions_json IS 'Archive JSON brute des sessions scrapées depuis UFOVAL';
COMMENT ON COLUMN public.gd_stays.import_batch_ts IS 'Timestamp du dernier import n8n (permet de tracer les updates)';


-- ----------------------------------------------------------------------------
-- ÉTAPE 2 : Ajouter les colonnes manquantes à gd_stay_sessions
-- ----------------------------------------------------------------------------

-- Colonne pour la ville de départ
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS city_departure TEXT;

-- Colonne pour le prix
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- Colonnes pour les tranches d'âge
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER;

-- Colonne pour tracer les imports
ALTER TABLE public.gd_stay_sessions
ADD COLUMN IF NOT EXISTS import_batch_ts TIMESTAMPTZ DEFAULT now();

-- Commentaires pour documentation
COMMENT ON COLUMN public.gd_stay_sessions.city_departure IS 'Ville de départ du séjour';
COMMENT ON COLUMN public.gd_stay_sessions.price IS 'Prix du séjour pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.age_min IS 'Âge minimum pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.age_max IS 'Âge maximum pour cette session';
COMMENT ON COLUMN public.gd_stay_sessions.import_batch_ts IS 'Timestamp du dernier import n8n';


-- ----------------------------------------------------------------------------
-- ÉTAPE 3 : Créer les index UNIQUE pour éviter les doublons
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- ÉTAPE 4 : Vérification post-migration
-- ----------------------------------------------------------------------------

-- Vérifier les nouvelles colonnes de gd_stays
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stays'
  AND column_name IN ('title_pro', 'title_kids', 'description_pro', 'description_kids', 'sessions_json', 'import_batch_ts')
ORDER BY column_name;

-- Résultat attendu : 6 lignes

-- Vérifier les nouvelles colonnes de gd_stay_sessions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stay_sessions'
  AND column_name IN ('city_departure', 'price', 'age_min', 'age_max', 'import_batch_ts')
ORDER BY column_name;

-- Résultat attendu : 5 lignes

-- Vérifier les index créés
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('gd_stays', 'gd_stay_sessions')
  AND indexname LIKE 'uniq_%'
ORDER BY tablename, indexname;

-- Résultat attendu : 2 lignes (uniq_gd_stays_source_url, uniq_gd_stay_sessions_slug_dates)


-- ----------------------------------------------------------------------------
-- ÉTAPE 5 : (Optionnel) Migration des données existantes
-- ----------------------------------------------------------------------------

-- Si vous avez déjà des données dans 'title', vous pouvez les copier vers title_pro et title_kids
-- UPDATE public.gd_stays
-- SET
--   title_pro = title,
--   title_kids = title
-- WHERE title_pro IS NULL AND title IS NOT NULL;


-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

-- Instructions d'exécution :
-- 1. Copier tout ce script
-- 2. Coller dans le SQL Editor de Supabase
-- 3. Cliquer sur "Run" (Courir)
-- 4. Vérifier que les requêtes de l'ÉTAPE 4 retournent les résultats attendus
-- 5. Une fois validé, revenir vers Claude pour continuer la config n8n

-- Note importante :
-- Les colonnes existantes (title, slug, source_url, etc.) ne sont PAS modifiées.
-- Seules les nouvelles colonnes sont ajoutées.
-- Aucune donnée existante n'est perdue.
