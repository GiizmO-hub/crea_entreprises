-- ============================================================================
-- TEST APRÈS CORRECTION - Vérification user_id
-- ============================================================================

-- Ce script teste que la fonction vérifie bien le user_id avant création

-- 1. Vérifier que la fonction existe
SELECT 
  '✅ Fonction existe' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'create_complete_entreprise_automated'
    ) THEN '✅ OK'
    ELSE '❌ MANQUANTE'
  END as resultat;

-- 2. Vérifier que la fonction a bien la vérification
SELECT 
  '✅ Fonction vérifie user_id' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_language l ON p.prolang = l.oid
      WHERE p.proname = 'create_complete_entreprise_automated'
      AND pg_get_functiondef(p.oid) LIKE '%EXISTS(SELECT 1 FROM auth.users WHERE id = v_user_id)%'
    ) THEN '✅ OK - Vérification présente'
    ELSE '⚠️  À vérifier manuellement'
  END as resultat;

-- 3. Lister les utilisateurs existants pour référence
SELECT 
  '👤 Utilisateurs disponibles' as info,
  COUNT(*) as nombre_utilisateurs
FROM auth.users;

-- 4. Vérifier les entreprises existantes et leurs user_id
SELECT 
  '🏢 Entreprises avec user_id valide' as info,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM auth.users WHERE id = entreprises.user_id
  )) as entreprises_valides,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = entreprises.user_id
  )) as entreprises_invalides,
  COUNT(*) as total
FROM entreprises;

-- 5. Message final
SELECT 
  '📋 PROCHAINES ÉTAPES' as instruction,
  '1. Testez la création d''une entreprise via le frontend' as etape1,
  '2. Vérifiez que le message d''erreur est clair si user_id invalide' as etape2,
  '3. Si erreur, partagez le message exact' as etape3;

