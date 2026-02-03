-- ============================================================================
-- FLOOOW - UFOVAL GED : Configuration Supabase pour import n8n
-- ============================================================================
-- Date: 2026-01-30
-- Tables: gd_stays, gd_stay_sessions
-- Purpose: Créer les index UNIQUE pour éviter les doublons lors des upserts
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ÉTAPE 1 : Vérification préalable des tables existantes
-- ----------------------------------------------------------------------------

-- Lister les tables et leurs colonnes
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('gd_stays', 'gd_stay_sessions')
ORDER BY table_name, ordinal_position;

-- Résultat attendu : colonnes confirmées pour les deux tables


-- ----------------------------------------------------------------------------
-- ÉTAPE 2 : Création des index UNIQUE (idempotent - safe à ré-exécuter)
-- ----------------------------------------------------------------------------

-- Index UNIQUE sur source_url pour gd_stays
-- Empêche l'insertion de doublons de stays depuis la même URL source
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stays_source_url
ON public.gd_stays(source_url)
WHERE source_url IS NOT NULL;

-- Commentaire pour documentation
COMMENT ON INDEX public.uniq_gd_stays_source_url IS
'Empêche les doublons de stays importés depuis la même source_url (scraper UFOVAL)';


-- Index UNIQUE composite pour gd_stay_sessions
-- Empêche l'insertion de doublons : même séjour + mêmes dates = 1 seule ligne
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gd_stay_sessions_slug_dates
ON public.gd_stay_sessions(stay_slug, start_date, end_date);

-- Commentaire pour documentation
COMMENT ON INDEX public.uniq_gd_stay_sessions_slug_dates IS
'Empêche les doublons de sessions : combinaison unique stay_slug + start_date + end_date';


-- ----------------------------------------------------------------------------
-- ÉTAPE 3 : Vérification de la création des index
-- ----------------------------------------------------------------------------

-- Lister tous les index créés sur les tables concernées
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('gd_stays', 'gd_stay_sessions')
  AND indexname LIKE 'uniq_%'
ORDER BY tablename, indexname;

-- Résultat attendu :
-- | schemaname | tablename            | indexname                          |
-- |------------|----------------------|------------------------------------|
-- | public     | gd_stays             | uniq_gd_stays_source_url           |
-- | public     | gd_stay_sessions     | uniq_gd_stay_sessions_slug_dates   |


-- ----------------------------------------------------------------------------
-- ÉTAPE 4 : Vérification RLS (Row Level Security)
-- ----------------------------------------------------------------------------

-- Vérifier si RLS est activé sur les tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('gd_stays', 'gd_stay_sessions');

-- Note: Le service role key utilisé dans n8n BYPASS automatiquement RLS
-- Aucune action supplémentaire n'est nécessaire si rowsecurity = true


-- ----------------------------------------------------------------------------
-- ÉTAPE 5 : Test de contrainte UNIQUE (optionnel, pour validation)
-- ----------------------------------------------------------------------------

-- Test 1 : Insérer un stay de test
INSERT INTO public.gd_stays (source_url, slug, title_pro, title_kids, import_batch_ts)
VALUES (
  'https://test.example.com/sejour-test-unique',
  'sejour-test-unique',
  'Titre Pro Test',
  'Titre Kids Test',
  now()
)
ON CONFLICT (source_url) DO UPDATE
  SET import_batch_ts = EXCLUDED.import_batch_ts
RETURNING id, source_url, import_batch_ts;

-- Résultat attendu : 1 ligne insérée avec un ID


-- Test 2 : Tenter de ré-insérer le même stay (doit faire un UPDATE, pas un INSERT)
INSERT INTO public.gd_stays (source_url, slug, title_pro, title_kids, import_batch_ts)
VALUES (
  'https://test.example.com/sejour-test-unique',
  'sejour-test-unique-v2', -- slug différent, mais source_url identique
  'Titre Pro Test v2',
  'Titre Kids Test v2',
  now()
)
ON CONFLICT (source_url) DO UPDATE
  SET
    slug = EXCLUDED.slug,
    title_pro = EXCLUDED.title_pro,
    title_kids = EXCLUDED.title_kids,
    import_batch_ts = EXCLUDED.import_batch_ts
RETURNING id, source_url, slug, import_batch_ts;

-- Résultat attendu : même ID que test 1 (UPDATE, pas nouveau INSERT)


-- Test 3 : Vérifier qu'il n'y a qu'une seule ligne
SELECT count(*) as total, count(DISTINCT source_url) as unique_urls
FROM public.gd_stays
WHERE source_url = 'https://test.example.com/sejour-test-unique';

-- Résultat attendu : total = 1, unique_urls = 1


-- Test 4 : Nettoyer les données de test
DELETE FROM public.gd_stays
WHERE source_url = 'https://test.example.com/sejour-test-unique';

-- Résultat attendu : 1 ligne supprimée


-- ----------------------------------------------------------------------------
-- ÉTAPE 6 : Requêtes de validation post-import (à exécuter après run n8n)
-- ----------------------------------------------------------------------------

-- V1 : Compter les stays importés dans les dernières 24h
SELECT
  count(*) as total_stays,
  max(import_batch_ts) as derniere_import,
  min(import_batch_ts) as premiere_import
FROM public.gd_stays
WHERE import_batch_ts >= (now() - interval '24 hours');

-- Attendu : ~30 stays après un run


-- V2 : Compter les sessions importées dans les dernières 24h
SELECT
  count(*) as total_sessions,
  max(import_batch_ts) as derniere_import
FROM public.gd_stay_sessions
WHERE import_batch_ts >= (now() - interval '24 hours');

-- Attendu : total cohérent avec la somme des sessions du JSON


-- V3 : Détecter les doublons de stays (ne devrait JAMAIS retourner de lignes)
SELECT
  source_url,
  count(*) as nb_doublons,
  array_agg(id) as ids_en_doublon
FROM public.gd_stays
GROUP BY source_url
HAVING count(*) > 1;

-- Attendu : 0 lignes


-- V4 : Détecter les doublons de sessions (ne devrait JAMAIS retourner de lignes)
SELECT
  stay_slug,
  start_date,
  end_date,
  count(*) as nb_doublons,
  array_agg(id) as ids_en_doublon
FROM public.gd_stay_sessions
GROUP BY stay_slug, start_date, end_date
HAVING count(*) > 1;

-- Attendu : 0 lignes


-- V5 : Vérifier la cohérence stays ↔ sessions
SELECT
  s.slug,
  s.title_pro,
  s.source_url,
  count(ss.id) as nb_sessions
FROM public.gd_stays s
LEFT JOIN public.gd_stay_sessions ss ON ss.stay_slug = s.slug
WHERE s.import_batch_ts >= (now() - interval '24 hours')
GROUP BY s.slug, s.title_pro, s.source_url
ORDER BY nb_sessions DESC;

-- Vérifier : chaque stay doit avoir au moins 1 session


-- V6 : Détecter les sessions orphelines (sans stay parent)
SELECT
  ss.stay_slug,
  count(*) as nb_sessions_orphelines,
  min(ss.start_date) as premiere_date,
  max(ss.end_date) as derniere_date
FROM public.gd_stay_sessions ss
LEFT JOIN public.gd_stays s ON s.slug = ss.stay_slug
WHERE s.id IS NULL
  AND ss.import_batch_ts >= (now() - interval '24 hours')
GROUP BY ss.stay_slug;

-- Attendu : 0 lignes (aucune session orpheline)


-- V7 : Vérifier la distribution des imports par batch
SELECT
  date_trunc('day', import_batch_ts) as jour_import,
  count(*) as nb_stays
FROM public.gd_stays
WHERE import_batch_ts >= (now() - interval '7 days')
GROUP BY jour_import
ORDER BY jour_import DESC;

-- Permet de voir l'historique des imports quotidiens


-- V8 : Top 10 des stays avec le plus de sessions
SELECT
  s.slug,
  s.title_kids,
  count(ss.id) as nb_sessions,
  min(ss.start_date) as premiere_session,
  max(ss.end_date) as derniere_session
FROM public.gd_stays s
INNER JOIN public.gd_stay_sessions ss ON ss.stay_slug = s.slug
GROUP BY s.slug, s.title_kids
ORDER BY nb_sessions DESC
LIMIT 10;


-- V9 : Détecter les incohérences de dates (end_date < start_date)
SELECT
  stay_slug,
  start_date,
  end_date,
  (end_date - start_date) as duree_jours
FROM public.gd_stay_sessions
WHERE end_date < start_date
  OR (end_date - start_date) > 365; -- Plus d'un an = suspect

-- Attendu : 0 lignes (ou analyser les anomalies)


-- V10 : Statistiques globales
SELECT
  'gd_stays' as table_name,
  count(*) as total_lignes,
  count(DISTINCT import_batch_ts) as nb_batchs_distincts,
  min(import_batch_ts) as premier_import,
  max(import_batch_ts) as dernier_import
FROM public.gd_stays
UNION ALL
SELECT
  'gd_stay_sessions',
  count(*),
  count(DISTINCT import_batch_ts),
  min(import_batch_ts),
  max(import_batch_ts)
FROM public.gd_stay_sessions;


-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

-- Notes d'utilisation :
-- 1. Exécuter ÉTAPES 1-3 AVANT de configurer n8n
-- 2. Exécuter ÉTAPE 4 (tests optionnels) pour valider les contraintes
-- 3. Exécuter ÉTAPE 6 (requêtes de validation) APRÈS chaque run n8n
-- 4. Conserver ce fichier comme référence pour le monitoring quotidien

-- En cas de problème :
-- - Vérifier les logs n8n pour les erreurs 409 (conflict) ou 5xx
-- - Si doublons détectés : analyser avec V3/V4 et corriger manuellement
-- - Si sessions orphelines : vérifier la génération des slugs dans n8n
