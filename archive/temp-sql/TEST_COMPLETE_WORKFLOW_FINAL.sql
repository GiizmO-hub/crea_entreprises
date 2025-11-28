-- ============================================================================
-- TEST COMPLET DU WORKFLOW APRÈS CORRECTIONS
-- ============================================================================

-- 1. Vérifier que la fonction existe et est à jour
SELECT 
  proname,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated';

-- 2. Vérifier la contrainte user_id
SELECT 
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'entreprises'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- 3. Vérifier les plans disponibles
SELECT 
  id,
  nom,
  prix_mensuel,
  actif
FROM plans_abonnement
WHERE actif = true
ORDER BY ordre;

-- 4. Compter les utilisateurs
SELECT COUNT(*) as nb_users FROM auth.users;

-- 5. Vérifier les entreprises existantes et leurs user_id
SELECT 
  e.id,
  e.nom,
  e.user_id,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = e.user_id) THEN '✅ Valide'
    ELSE '❌ Invalide'
  END as user_id_status
FROM entreprises e
ORDER BY e.created_at DESC
LIMIT 10;

