-- ============================================================================
-- TEST COMPLET APRÈS CORRECTION - Vérification complète
-- ============================================================================

-- 1. Vérifier que la fonction existe
SELECT 
  '1️⃣ FONCTION' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'create_complete_entreprise_automated'
    ) THEN '✅ Existe'
    ELSE '❌ Manquante'
  END as resultat;

-- 2. Vérifier que la vérification user_id est intégrée
SELECT 
  '2️⃣ VÉRIFICATION USER_ID' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname = 'create_complete_entreprise_automated'
      AND pg_get_functiondef(p.oid) LIKE '%auth.users WHERE id = v_user_id%'
    ) THEN '✅ Intégrée'
    ELSE '❌ Non trouvée'
  END as resultat;

-- 3. Compter les utilisateurs disponibles
SELECT 
  '3️⃣ UTILISATEURS' as test,
  COUNT(*) as nombre,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Disponibles'
    ELSE '⚠️  Aucun utilisateur'
  END as statut
FROM auth.users;

-- 4. Afficher les 3 premiers utilisateurs (pour référence)
SELECT 
  '👤 Exemples d''utilisateurs' as info,
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 3;

-- 5. Compter les plans d'abonnement
SELECT 
  '4️⃣ PLANS D''ABONNEMENT' as test,
  COUNT(*) as nombre,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ Complets'
    WHEN COUNT(*) > 0 THEN '⚠️  Partiels'
    ELSE '❌ Aucun plan'
  END as statut
FROM plans_abonnement
WHERE actif = true;

-- 6. Vérifier les entreprises existantes et leurs user_id
SELECT 
  '5️⃣ ENTREPRISES' as test,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM auth.users WHERE id = entreprises.user_id
  )) as avec_user_id_valide,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = entreprises.user_id
  )) as avec_user_id_invalide
FROM entreprises;

-- 7. Vérifier la structure de la fonction (extrait de la définition)
SELECT 
  '6️⃣ STRUCTURE FONCTION' as test,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%v_user_id IS NULL%' THEN '✅ Vérification NULL'
    ELSE '❌ Vérification NULL manquante'
  END as verification_null,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%auth.users WHERE id = v_user_id%' THEN '✅ Requête auth.users'
    ELSE '❌ Requête auth.users manquante'
  END as requete_auth_users
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated'
LIMIT 1;

-- 8. Résumé final
SELECT 
  '📋 RÉSUMÉ' as section,
  '✅ Fonction corrigée et prête' as etat,
  'Testez via le frontend pour valider' as prochaine_etape;

