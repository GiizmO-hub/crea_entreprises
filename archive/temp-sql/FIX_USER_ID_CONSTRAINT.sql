-- ============================================================================
-- CORRECTION DU PROBLÈME user_id CONSTRAINT
-- ============================================================================
--
-- PROBLÈME:
-- L'erreur "entreprises_user_id_fkey" indique que le user_id utilisé
-- n'existe pas dans auth.users.
--
-- CAUSE:
-- La fonction create_complete_entreprise_automated utilise auth.uid()
-- qui peut retourner un ID qui n'existe pas ou NULL
--
-- SOLUTION:
-- 1. Vérifier que user_id peut être NULL (si nécessaire)
-- 2. Ou s'assurer que auth.uid() retourne toujours un ID valide
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: Vérifier la contrainte actuelle
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
-- ÉTAPE 2: Vérifier si user_id peut être NULL
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
-- ÉTAPE 3: Option 1 - Permettre user_id NULL temporairement
-- ============================================================================
-- Si user_id peut être NULL, la contrainte doit le permettre
-- Sinon, il faut modifier la fonction pour vérifier que auth.uid() existe

-- ============================================================================
-- ÉTAPE 4: Option 2 - Modifier la fonction pour mieux gérer auth.uid()
-- ============================================================================

-- Vérifier la fonction actuelle
SELECT 
  prosrc as function_body
FROM pg_proc
WHERE proname = 'create_complete_entreprise_automated'
LIMIT 1;

-- ============================================================================
-- SOLUTION RECOMMANDÉE:
-- La fonction doit vérifier que auth.uid() existe dans auth.users
-- avant de créer l'entreprise
-- ============================================================================

-- Créer une fonction améliorée qui vérifie l'existence du user_id
CREATE OR REPLACE FUNCTION verify_user_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id);
END;
$$;

-- Tester la fonction
SELECT verify_user_exists(auth.uid()) as current_user_exists;

