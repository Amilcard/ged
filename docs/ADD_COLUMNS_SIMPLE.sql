-- ============================================================================
-- Ajout des colonnes pour l'app GED - Version simple (sans accents)
-- ============================================================================

ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS season TEXT,
ADD COLUMN IF NOT EXISTS location_region TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- Commentaires
COMMENT ON COLUMN public.gd_stays.season IS 'Saison de vacances (Ete, Hiver, Printemps, Automne)';
COMMENT ON COLUMN public.gd_stays.location_region IS 'Region geographique (Alpes, Mediterranee, Paris, etc.)';
COMMENT ON COLUMN public.gd_stays.location_city IS 'Ville ou lieu precis (Courchevel, Berlin, etc.)';
COMMENT ON COLUMN public.gd_stays.duration_days IS 'Duree du sejour en jours (calculee depuis sessions)';

ALTER TABLE public.gd_stays
ADD COLUMN IF NOT EXISTS programme_json JSONB,
ADD COLUMN IF NOT EXISTS inclusions_json JSONB,
ADD COLUMN IF NOT EXISTS logistics_json JSONB;

COMMENT ON COLUMN public.gd_stays.programme_json IS 'Programme detaille des activites';
COMMENT ON COLUMN public.gd_stays.inclusions_json IS 'Ce qui est inclus (hebergement, repas, etc.)';
COMMENT ON COLUMN public.gd_stays.logistics_json IS 'Informations logistiques: lieu, hebergement, encadrement';
