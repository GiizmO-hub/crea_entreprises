-- ============================================================================
-- DIAGNOSTIC COMPLET DU PROBLÈME user_id
-- ============================================================================

-- 1. Vérifier la contrainte exacte
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'entreprises'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- 2. Vérifier si user_id peut être NULL
SELECT 
  column_name,
  is_nullable,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_name = 'entreprises'
  AND column_name = 'user_id';

-- 3. Lister les utilisateurs existants (premiers 10)
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'role' as role
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 4. Vérifier les entreprises existantes et leurs user_id
SELECT 
  e.id as entreprise_id,
  e.nom,
  e.user_id,
  e.statut,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = e.user_id) THEN '✅ Valide'
    ELSE '❌ Invalide'
  END as user_id_status,
  (SELECT email FROM auth.users WHERE id = e.user_id) as user_email
FROM entreprises e
ORDER BY e.created_at DESC
LIMIT 10;

-- 5. Vérifier la fonction actuelle
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated'
LIMIT 1;

-- 6. Test de la fonction verify_user_exists si elle existe
SELECT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'verify_user_exists'
) as verify_function_exists;

