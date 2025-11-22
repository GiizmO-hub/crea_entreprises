/*
  # Script de création d'un Super Admin
  
  Ce script permet de créer ou promouvoir un utilisateur en Super Admin.
  Le rôle super_admin donne accès à toutes les données de toutes les entreprises.
  
  ## Utilisation
  
  1. Créez d'abord un compte utilisateur dans l'application (via l'interface d'inscription)
  2. Notez l'email de l'utilisateur : meddecyril@icloud.com
  3. Exécutez ce script dans le SQL Editor de Supabase
  4. Remplacez l'email dans le script par l'email de l'utilisateur
  
  ## Sécurité
  
  - Seuls les utilisateurs avec le rôle 'super_admin' peuvent créer/modifier d'autres super admins
  - Le rôle est stocké dans raw_user_meta_data->>'role'
  - Les fonctions is_super_admin() et is_admin() vérifient ce rôle
*/

-- Fonction pour créer ou promouvoir un utilisateur en super_admin
CREATE OR REPLACE FUNCTION create_super_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Trouver l'ID de l'utilisateur par son email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  -- Vérifier que l'utilisateur existe
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur avec l''email % n''existe pas. Veuillez d''abord créer le compte dans l''application.', user_email;
  END IF;
  
  -- Mettre à jour le rôle dans raw_user_meta_data
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', 'super_admin')
  WHERE id = target_user_id;
  
  RAISE NOTICE 'Utilisateur % promu Super Admin avec succès!', user_email;
END;
$$;

-- Exécuter la fonction pour créer le super admin
-- Remplacez 'meddecyril@icloud.com' par l'email de l'utilisateur à promouvoir
SELECT create_super_admin('meddecyril@icloud.com');

-- Vérifier que le rôle a été attribué
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'meddecyril@icloud.com';

