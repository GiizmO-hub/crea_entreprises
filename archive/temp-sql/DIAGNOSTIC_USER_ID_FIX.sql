-- ============================================================================
-- DIAGNOSTIC ET CORRECTION DU PROBLÈME user_id
-- ============================================================================

-- PROBLÈME IDENTIFIÉ:
-- L'erreur "entreprises_user_id_fkey" indique que le user_id utilisé
-- pour créer l'entreprise n'existe pas dans auth.users
--
-- CAUSE PROBABLE:
-- La fonction create_complete_entreprise_automated utilise auth.uid()
-- qui peut être NULL si l'utilisateur n'est pas authentifié correctement

-- ============================================================================
-- ÉTAPE 1: Vérifier la contrainte
-- ============================================================================

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

-- ============================================================================
-- ÉTAPE 2: Vérifier les utilisateurs existants
-- ============================================================================

SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'role' as role
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- ÉTAPE 3: Vérifier la fonction create_complete_entreprise_automated
-- ============================================================================

-- Afficher comment la fonction récupère le user_id
SELECT 
  prosrc as function_body
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated'
LIMIT 1;

-- ============================================================================
-- ÉTAPE 4: Vérifier si user_id peut être NULL dans entreprises
-- ============================================================================

SELECT 
  column_name,
  is_nullable,
  column_default,
  data_type
FROM information_schema.columns
WHERE table_name = 'entreprises'
  AND column_name = 'user_id';

-- ============================================================================
-- SOLUTION PROPOSÉE
-- ============================================================================
-- Si user_id peut être NULL, permettre NULL temporairement
-- Sinon, s'assurer que auth.uid() retourne toujours une valeur valide

