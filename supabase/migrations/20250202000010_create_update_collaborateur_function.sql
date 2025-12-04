/*
  # Fonction RPC pour mettre à jour un collaborateur dans collaborateurs_entreprise
  
  Cette fonction permet de mettre à jour les informations d'un collaborateur
  avec vérification des permissions et gestion des erreurs.
*/

-- Supprimer toutes les variantes de la fonction update_collaborateur
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT oid::regprocedure AS func_name
    FROM pg_proc
    WHERE proname = 'update_collaborateur'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
  END LOOP;
END $$;

-- Créer la nouvelle fonction update_collaborateur
CREATE OR REPLACE FUNCTION update_collaborateur(
  p_collaborateur_id uuid,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_entreprise_id uuid DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_poste text DEFAULT NULL,
  p_date_embauche date DEFAULT NULL,
  p_salaire numeric DEFAULT NULL,
  p_numero_securite_sociale text DEFAULT NULL,
  p_code_urssaf text DEFAULT NULL,
  p_emploi text DEFAULT NULL,
  p_statut_professionnel text DEFAULT NULL,
  p_echelon text DEFAULT NULL,
  p_date_entree date DEFAULT NULL,
  p_anciennete_annees integer DEFAULT NULL,
  p_convention_collective_numero text DEFAULT NULL,
  p_convention_collective_nom text DEFAULT NULL,
  p_matricule text DEFAULT NULL,
  p_coefficient text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_collaborateur RECORD;
  v_has_permission boolean := false;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non authentifié');
  END IF;
  
  -- Vérifier que le collaborateur existe dans collaborateurs_entreprise
  SELECT * INTO v_collaborateur 
  FROM collaborateurs_entreprise 
  WHERE id = p_collaborateur_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Collaborateur non trouvé');
  END IF;
  
  -- Vérifier les permissions
  -- Super admin plateforme
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs 
    WHERE id = v_user_id AND role = 'super_admin'
  ) INTO v_has_permission;
  
  -- Propriétaire de l'entreprise
  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM entreprises e
      WHERE e.id = v_collaborateur.entreprise_id
        AND e.user_id = v_user_id
    ) INTO v_has_permission;
  END IF;
  
  -- Client via espace membre
  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM espaces_membres_clients emc
      WHERE emc.entreprise_id = v_collaborateur.entreprise_id
        AND emc.user_id = v_user_id
        AND emc.actif = true
    ) INTO v_has_permission;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;
  
  -- Mettre à jour le collaborateur
  UPDATE collaborateurs_entreprise
  SET
    nom = COALESCE(p_nom, nom),
    prenom = COALESCE(p_prenom, prenom),
    telephone = COALESCE(p_telephone, telephone),
    role = COALESCE(p_role, role),
    entreprise_id = COALESCE(p_entreprise_id, entreprise_id),
    departement = COALESCE(p_departement, departement),
    poste = COALESCE(p_poste, poste),
    date_entree = COALESCE(p_date_entree, date_entree),
    numero_securite_sociale = COALESCE(p_numero_securite_sociale, numero_securite_sociale),
    code_urssaf = COALESCE(p_code_urssaf, code_urssaf),
    emploi = COALESCE(p_emploi, emploi),
    statut_professionnel = COALESCE(p_statut_professionnel, statut_professionnel),
    echelon = COALESCE(p_echelon, echelon),
    anciennete_annees = COALESCE(p_anciennete_annees, anciennete_annees),
    convention_collective_numero = COALESCE(p_convention_collective_numero, convention_collective_numero),
    convention_collective_nom = COALESCE(p_convention_collective_nom, convention_collective_nom),
    matricule = COALESCE(p_matricule, matricule),
    coefficient = COALESCE(p_coefficient, coefficient),
    updated_at = now()
  WHERE id = p_collaborateur_id;
  
  -- Si un salaire est fourni, mettre à jour ou créer l'entrée dans salaries
  IF p_salaire IS NOT NULL THEN
    INSERT INTO salaries (collaborateur_id, salaire_brut, date_debut, actif)
    VALUES (p_collaborateur_id, p_salaire, COALESCE(p_date_entree, now()::date), true)
    ON CONFLICT (collaborateur_id) 
    DO UPDATE SET 
      salaire_brut = p_salaire,
      updated_at = now();
  END IF;
  
  RETURN jsonb_build_object('success', true);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION update_collaborateur IS 'Met à jour les informations d''un collaborateur dans collaborateurs_entreprise';

