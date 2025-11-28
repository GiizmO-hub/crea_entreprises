-- ============================================================================
-- TEST FINAL - Vérification de la fonction create_complete_entreprise_automated
-- ============================================================================

-- 1. Vérifier que la fonction existe
SELECT 
  '✅ Fonction existe' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'create_complete_entreprise_automated'
    ) THEN 'OK'
    ELSE 'MANQUANTE'
  END as resultat;

-- 2. Vérifier la définition de la fonction (extrait)
SELECT 
  '✅ Vérification user_id intégrée' as test,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%auth.users WHERE id = v_user_id%' THEN 'OK'
    ELSE 'À VÉRIFIER'
  END as resultat
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated'
LIMIT 1;

-- 3. Lister les utilisateurs disponibles (premiers 5)
SELECT 
  '👤 Utilisateurs disponibles' as info,
  COUNT(*) as nombre_utilisateurs
FROM auth.users;

SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 4. Vérifier les plans d'abonnement
SELECT 
  '📋 Plans d''abonnement' as info,
  COUNT(*) as nombre_plans
FROM plans_abonnement
WHERE actif = true;

SELECT 
  id,
  nom,
  prix_mensuel,
  actif
FROM plans_abonnement
WHERE actif = true
ORDER BY ordre;

-- 5. Vérifier les entreprises existantes et leurs user_id
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

-- 6. Message final
SELECT 
  '📋 PROCHAINES ÉTAPES' as instruction,
  '1. Testez la création d''une entreprise via le frontend' as etape1,
  '2. Si user_id invalide, vous devriez voir un message clair' as etape2,
  '3. Si tout est OK, l''entreprise sera créée avec succès' as etape3;

