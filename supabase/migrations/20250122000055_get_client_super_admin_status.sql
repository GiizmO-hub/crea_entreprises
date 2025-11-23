/*
  # Fonction RPC pour récupérer le statut super_admin des clients
  
  Permet de récupérer le statut super_admin de tous les clients d'une entreprise
  sans avoir besoin d'accéder directement à la table utilisateurs (contourne RLS).
*/

-- Fonction pour récupérer le statut super_admin de tous les clients d'une entreprise
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
  -- Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND NOT EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé - Super admin plateforme requis';
  END IF;

  -- Retourner le statut super_admin de tous les clients de l'entreprise
  RETURN QUERY
  SELECT 
    emc.client_id,
    COALESCE(u.role = 'super_admin', false) as is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.entreprise_id = p_entreprise_id;
END;
$$;

COMMENT ON FUNCTION get_client_super_admin_status IS 'Récupère le statut super_admin de tous les clients d''une entreprise. Utilise SECURITY DEFINER pour contourner RLS.';

-- Fonction alternative pour récupérer le statut d'un client spécifique
CREATE OR REPLACE FUNCTION get_single_client_super_admin_status(p_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_super_admin boolean := false;
BEGIN
  -- Cette fonction peut être appelée par n'importe quel utilisateur authentifié
  -- pour vérifier son propre statut ou par un super_admin pour vérifier un autre client
  
  -- Récupérer le statut super_admin du client
  SELECT COALESCE(u.role = 'super_admin', false)
  INTO v_is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.client_id = p_client_id
  LIMIT 1;

  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

COMMENT ON FUNCTION get_single_client_super_admin_status IS 'Récupère le statut super_admin d''un client spécifique. Peut être appelée par n''importe quel utilisateur authentifié. Utilise SECURITY DEFINER pour contourner RLS.';

-- Fonction pour que le client vérifie son propre statut super_admin
CREATE OR REPLACE FUNCTION check_my_super_admin_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_super_admin boolean := false;
BEGIN
  -- Cette fonction permet à un utilisateur de vérifier son propre statut super_admin
  -- en tant que client (pas super_admin de la plateforme)
  
  -- Récupérer le statut super_admin de l'utilisateur actuel
  SELECT COALESCE(u.role = 'super_admin', false)
  INTO v_is_super_admin
  FROM espaces_membres_clients emc
  LEFT JOIN utilisateurs u ON u.id = emc.user_id
  WHERE emc.user_id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

COMMENT ON FUNCTION check_my_super_admin_status IS 'Permet à un client de vérifier s''il est super_admin de son espace. Utilise SECURITY DEFINER pour contourner RLS.';

