/*
  # Fonction pour mettre à jour toutes les informations d'un client
  
  Crée une fonction RPC pour mettre à jour toutes les informations modifiables d'un client
  avec vérification des permissions
*/

-- ========================================
-- Fonction update_client_complete
-- ========================================

CREATE OR REPLACE FUNCTION update_client_complete(
  p_client_id uuid,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_entreprise_nom text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_portable text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_pays text DEFAULT NULL,
  p_siret text DEFAULT NULL,
  p_tva_intracommunautaire text DEFAULT NULL,
  p_statut text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_client RECORD;
  v_has_permission boolean := false;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié');
  END IF;
  
  -- Vérifier que le client existe
  SELECT * INTO v_client FROM clients WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client non trouvé');
  END IF;
  
  -- Vérifier les permissions
  -- 1. Super admin plateforme a toujours accès
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs 
    WHERE id = v_user_id AND role = 'super_admin'
  ) INTO v_has_permission;
  
  -- 2. Si pas super admin, vérifier si l'utilisateur a accès à l'entreprise du client
  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM entreprises e
      WHERE e.id = v_client.entreprise_id
        AND (
          e.user_id = v_user_id
          OR EXISTS (
            SELECT 1 FROM espaces_membres_clients emc
            WHERE emc.entreprise_id = e.id
              AND emc.user_id = v_user_id
              AND emc.statut_compte = 'actif'
          )
        )
    ) INTO v_has_permission;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée : accès aux paramètres clients requis');
  END IF;
  
  -- Mettre à jour le client
  UPDATE clients
  SET
    nom = COALESCE(p_nom, nom),
    prenom = COALESCE(p_prenom, prenom),
    entreprise_nom = COALESCE(p_entreprise_nom, entreprise_nom),
    email = COALESCE(p_email, email),
    telephone = COALESCE(p_telephone, telephone),
    portable = COALESCE(p_portable, portable),
    adresse = COALESCE(p_adresse, adresse),
    code_postal = COALESCE(p_code_postal, code_postal),
    ville = COALESCE(p_ville, ville),
    pays = COALESCE(p_pays, pays),
    siret = COALESCE(p_siret, siret),
    tva_intracommunautaire = COALESCE(p_tva_intracommunautaire, tva_intracommunautaire),
    statut = COALESCE(p_statut, statut),
    notes = COALESCE(p_notes, notes),
    tags = COALESCE(p_tags, tags),
    updated_at = now()
  WHERE id = p_client_id;
  
  -- Si l'email a changé, mettre à jour aussi dans auth.users et utilisateurs
  IF p_email IS NOT NULL AND p_email != v_client.email THEN
    -- Mettre à jour auth.users
    UPDATE auth.users
    SET email = p_email, updated_at = now()
    WHERE email = v_client.email;
    
    -- Mettre à jour utilisateurs
    UPDATE utilisateurs
    SET email = p_email, updated_at = now()
    WHERE email = v_client.email;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Client mis à jour avec succès',
    'client_id', p_client_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION update_client_complete IS 
  'Met à jour toutes les informations modifiables d''un client avec vérification des permissions.';

GRANT EXECUTE ON FUNCTION update_client_complete TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000034 appliquée';
  RAISE NOTICE '📋 Fonction update_client_complete créée';
END $$;

