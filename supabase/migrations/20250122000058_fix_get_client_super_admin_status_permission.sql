/*
  # Fix: Correction permission get_client_super_admin_status
  
  Le problème : La fonction get_client_super_admin_status utilise une vérification
  manuelle au lieu d'utiliser is_platform_super_admin, ce qui cause des erreurs
  "Accès non autorisé - Super admin plateforme requis".
  
  Solution : Utiliser is_platform_super_admin() qui existe déjà et qui est
  la fonction officielle pour vérifier si un utilisateur est super_admin
  de la plateforme (pas un client).
*/

-- Mettre à jour get_client_super_admin_status pour utiliser is_platform_super_admin
CREATE OR REPLACE FUNCTION get_client_super_admin_status(p_entreprise_id uuid)
RETURNS TABLE (
  client_id uuid,
  is_super_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- ✅ Utiliser is_platform_super_admin() au lieu d'une vérification manuelle
  -- Cette fonction vérifie correctement si l'utilisateur est super_admin
  -- de la plateforme (et pas un client)
  IF NOT is_platform_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Retourner le statut client_super_admin de tous les clients de l'entreprise
  RETURN QUERY
  SELECT 
    emc.client_id,
    COALESCE(u.role = 'client_super_admin', false) as is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.entreprise_id = p_entreprise_id;
END;
$$;

COMMENT ON FUNCTION get_client_super_admin_status IS 'Récupère le statut client_super_admin de tous les clients d''une entreprise. Utilise is_platform_super_admin() pour vérifier les permissions.';




