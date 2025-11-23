/*
  # Fonction RPC pour récupérer l'ID du super admin
  
  Cette fonction permet de récupérer l'ID du super admin depuis auth.users
  Utile pour les scripts de test et les opérations administratives.
*/

-- Fonction pour récupérer l'ID du super admin
CREATE OR REPLACE FUNCTION get_super_admin_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Chercher dans auth.users un utilisateur avec role = super_admin dans metadata
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE (
    raw_user_meta_data->>'role' = 'super_admin' OR
    raw_app_meta_data->>'role' = 'super_admin' OR
    email = 'meddecyril@icloud.com'
  )
  LIMIT 1;

  -- Si pas trouvé, chercher dans la table utilisateurs
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id
    FROM utilisateurs
    WHERE role = 'super_admin'
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION get_super_admin_user_id IS 'Retourne l''ID (UUID) du super admin depuis auth.users ou utilisateurs';

