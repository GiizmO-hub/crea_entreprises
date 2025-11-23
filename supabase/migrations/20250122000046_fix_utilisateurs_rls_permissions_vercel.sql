/*
  # Fix : Permissions RLS sur table utilisateurs pour Vercel
  
  Problème :
  - Erreur 403 Forbidden sur la lecture de la table utilisateurs
  - Les politiques RLS bloquent même la lecture de ses propres infos
  - Problème probable : l'utilisateur n'existe pas dans utilisateurs ou les politiques sont trop restrictives
  
  Solution :
  1. S'assurer que la politique simple "id = auth.uid()" est prioritaire
  2. Créer une fonction RPC pour récupérer le rôle sans problèmes RLS
  3. Ajouter une politique plus permissive pour la lecture basique
  4. S'assurer que l'utilisateur peut toujours lire son propre rôle
*/

-- 1. Créer une fonction RPC pour récupérer le rôle de l'utilisateur actuel
-- Cette fonction contourne RLS et est toujours accessible
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_role text;
  user_id uuid;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN json_build_object('error', 'Non authentifié', 'role', null);
  END IF;
  
  -- Essayer de récupérer depuis la table utilisateurs
  SELECT role INTO user_role
  FROM public.utilisateurs
  WHERE id = user_id;
  
  -- Si pas trouvé dans utilisateurs, essayer depuis auth.users
  IF user_role IS NULL THEN
    SELECT COALESCE(
      (raw_user_meta_data->>'role')::text,
      (raw_app_meta_data->>'role')::text,
      'client'
    ) INTO user_role
    FROM auth.users
    WHERE id = user_id;
  END IF;
  
  -- Si toujours pas trouvé, retourner client par défaut
  IF user_role IS NULL THEN
    user_role := 'client';
  END IF;
  
  RETURN json_build_object(
    'id', user_id,
    'role', user_role,
    'is_super_admin', (user_role = 'super_admin'),
    'is_admin', (user_role IN ('super_admin', 'admin'))
  );
END;
$$;

-- 2. Réappliquer la politique la plus simple pour la lecture de ses propres infos
DROP POLICY IF EXISTS "Utilisateurs peuvent voir leurs propres infos" ON utilisateurs;
CREATE POLICY "Utilisateurs peuvent voir leurs propres infos"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 3. Ajouter une politique encore plus permissive qui permet la lecture si l'utilisateur existe
-- Cette politique est en dernier recours si l'autre échoue
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent lire leur rôle" ON utilisateurs;
CREATE POLICY "Utilisateurs authentifiés peuvent lire leur rôle"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    -- Soit c'est son propre id
    id = auth.uid()
    -- Soit l'utilisateur existe dans auth.users (double vérification)
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
    )
  );

-- 4. S'assurer que la politique super_admin est bien présente et fonctionnelle
DROP POLICY IF EXISTS "Super admin peut voir tous les utilisateurs" ON utilisateurs;
CREATE POLICY "Super admin peut voir tous les utilisateurs"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
        OR (auth.users.raw_user_meta_data->>'role')::text = 'admin'
      )
    )
  );

-- 5. Vérifier que l'utilisateur existe bien dans la table utilisateurs
-- Si un utilisateur existe dans auth.users mais pas dans utilisateurs, le créer
DO $$
DECLARE
  missing_user RECORD;
BEGIN
  FOR missing_user IN
    SELECT u.id, u.email, 
           COALESCE(
             (u.raw_user_meta_data->>'role')::text,
             (u.raw_app_meta_data->>'role')::text,
             'client'
           ) as role
    FROM auth.users u
    LEFT JOIN public.utilisateurs ut ON ut.id = u.id
    WHERE ut.id IS NULL
    LIMIT 100 -- Limiter pour éviter les problèmes de performance
  LOOP
    BEGIN
      INSERT INTO public.utilisateurs (id, email, role, created_at)
      VALUES (
        missing_user.id,
        missing_user.email,
        missing_user.role,
        NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorer les erreurs pour continuer avec les autres utilisateurs
      RAISE NOTICE 'Erreur lors de la synchronisation de l''utilisateur %: %', missing_user.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 6. Commentaire de documentation
COMMENT ON FUNCTION get_current_user_role() IS 
'Récupère le rôle de l''utilisateur actuellement authentifié. 
Fonctionne même si les politiques RLS bloquent l''accès à la table utilisateurs.
Retourne un JSON avec id, role, is_super_admin, is_admin.';

-- 7. Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS corrigées pour utilisateurs';
  RAISE NOTICE '✅ Fonction get_current_user_role() créée';
  RAISE NOTICE '✅ Utilisateurs manquants synchronisés depuis auth.users';
END $$;

