-- ============================================================================
-- Ajout des colonnes manquantes pour l'app GED - Version 2
-- ============================================================================
-- Date: 30 janvier 2026
-- Focus: Données critiques pour l'affichage (MVP ÉTÉ)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes pour gd_stays (MVP - Saison Été uniquement)
-- ----------------------------------------------------------------------------

ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS season TEXT CHECK (season IN ('Été', 'Hiver', 'Printemps', 'Automne', 'Fin d''année', 'Toutes saisons', 'Année complète')),
ADD COLUMN IF NOT EXISTS location_region TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- Commentaires
COMMENT ON COLUMN public.gd_stays.season IS 'Saison de vacances (Été, Hiver, Printemps, Automne, Fin d''année)';
COMMENT ON COLUMN public.gd_stays.location_region IS 'Région géographique (Alpes, Méditerranée, Paris, etc.)';
COMMENT ON COLUMN public.gd_stays.location_city IS 'Ville ou lieu précis (Courchevel, Berlin, etc.)';
COMMENT ON COLUMN public.gd_stays.duration_days IS 'Durée du séjour en jours (calculée depuis sessions)';

-- ----------------------------------------------------------------------------
-- 2. Colonnes pour gd_stays (Données enrichies - Phase 2)
-- ----------------------------------------------------------------------------

ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS programme_json JSONB,
ADD COLUMN IF NOT EXISTS inclusions_json JSONB,
ADD COLUMN IF NOT EXISTS logistics_json JSONB;

COMMENT ON COLUMN public.gd_stays.programme_json IS 'Programme détaillé des activités (liste ou objet structuré)';
COMMENT ON COLUMN public.gd_stays.inclusions_json IS 'Ce qui est inclus (hébergement, repas, transports, etc.)';
COMMENT ON COLUMN public.gd_stays.logistics_json IS 'Informations logistiques: lieu, hébergement type, encadrement';

-- ----------------------------------------------------------------------------
-- 3. Index pour les nouveaux champs (optimisation recherche)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 4. Validation post-migration
-- ----------------------------------------------------------------------------

-- Vérifier les nouvelles colonnes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gd_stays'
  AND column_name IN ('season', 'location_region', 'location_city', 'duration_days',
                       'programme_json', 'inclusions_json', 'logistics_json')
ORDER BY column_name;

-- Vérifier les index créés
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'gd_stays'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
-- Instructions :
-- 1. Copier ce script dans le SQL Editor Supabase
-- 2. Exécuter (Run)
-- 3. Vérifier que les colonnes sont créées (requête de validation)
-- 4. Mettre à jour le workflow n8n pour extraire ces données
-- ============================================================================
