/*
  # Module de gestion d'équipe avec permissions d'accès aux dossiers
  Ce module permet de créer des équipes, d'associer des collaborateurs
  et de définir des permissions d'accès aux dossiers selon les rôles
*/

-- 1. Table des équipes
CREATE TABLE IF NOT EXISTS equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  responsable_id uuid REFERENCES collaborateurs(id) ON DELETE SET NULL,
  couleur text DEFAULT '#3B82F6',
  actif boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, nom)
);

-- 2. Table de liaison collaborateurs-équipes (many-to-many)
CREATE TABLE IF NOT EXISTS collaborateurs_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collaborateur_id uuid NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,
  equipe_id uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  role_equipe text NOT NULL DEFAULT 'membre' CHECK (role_equipe IN ('membre', 'chef', 'adjoint')),
  date_entree date DEFAULT CURRENT_DATE,
  date_sortie date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collaborateur_id, equipe_id)
);

-- 3. Table des permissions d'accès aux dossiers par rôle
CREATE TABLE IF NOT EXISTS permissions_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('collaborateur', 'admin', 'manager', 'comptable', 'commercial', 'super_admin')),
  niveau_acces text NOT NULL DEFAULT 'lecture' CHECK (niveau_acces IN ('aucun', 'lecture', 'ecriture', 'administration')),
  can_create boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_share boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, folder_id, role)
);

-- 4. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_equipes_entreprise_id ON equipes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_equipes_responsable_id ON equipes(responsable_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_equipes_collaborateur_id ON collaborateurs_equipes(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_equipes_equipe_id ON collaborateurs_equipes(equipe_id);
CREATE INDEX IF NOT EXISTS idx_permissions_dossiers_entreprise_id ON permissions_dossiers(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_permissions_dossiers_folder_id ON permissions_dossiers(folder_id);
CREATE INDEX IF NOT EXISTS idx_permissions_dossiers_role ON permissions_dossiers(role);

-- 5. Activer RLS
ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborateurs_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions_dossiers ENABLE ROW LEVEL SECURITY;

-- 6. Politiques RLS pour equipes
CREATE POLICY "Users can view equipes of their entreprises"
  ON equipes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = equipes.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage equipes"
  ON equipes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = equipes.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 7. Politiques RLS pour collaborateurs_equipes
CREATE POLICY "Users can view collaborateurs_equipes of their entreprises"
  ON collaborateurs_equipes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM equipes
      JOIN entreprises ON entreprises.id = equipes.entreprise_id
      WHERE equipes.id = collaborateurs_equipes.equipe_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage collaborateurs_equipes"
  ON collaborateurs_equipes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM equipes
      JOIN entreprises ON entreprises.id = equipes.entreprise_id
      WHERE equipes.id = collaborateurs_equipes.equipe_id
      AND entreprises.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 8. Politiques RLS pour permissions_dossiers
CREATE POLICY "Users can view permissions_dossiers of their entreprises"
  ON permissions_dossiers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = permissions_dossiers.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage permissions_dossiers"
  ON permissions_dossiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = permissions_dossiers.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 9. Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_equipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_permissions_dossiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Triggers pour updated_at
CREATE TRIGGER update_equipes_updated_at
  BEFORE UPDATE ON equipes
  FOR EACH ROW
  EXECUTE FUNCTION update_equipes_updated_at();

CREATE TRIGGER update_permissions_dossiers_updated_at
  BEFORE UPDATE ON permissions_dossiers
  FOR EACH ROW
  EXECUTE FUNCTION update_permissions_dossiers_updated_at();

-- 11. Fonction pour vérifier les permissions d'accès à un dossier
CREATE OR REPLACE FUNCTION can_access_folder(
  p_folder_id uuid,
  p_user_id uuid,
  p_action text DEFAULT 'lecture'
)
RETURNS boolean AS $$
DECLARE
  v_user_role text;
  v_niveau_acces text;
  v_can_action boolean;
BEGIN
  -- Récupérer le rôle de l'utilisateur
  SELECT role INTO v_user_role
  FROM utilisateurs
  WHERE id = p_user_id;

  -- Super admin a toujours accès
  IF v_user_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Vérifier les permissions spécifiques au dossier
  SELECT 
    niveau_acces,
    CASE 
      WHEN p_action = 'create' THEN can_create
      WHEN p_action = 'update' THEN can_update
      WHEN p_action = 'delete' THEN can_delete
      WHEN p_action = 'share' THEN can_share
      ELSE true
    END
  INTO v_niveau_acces, v_can_action
  FROM permissions_dossiers
  WHERE folder_id = p_folder_id
  AND role = v_user_role
  LIMIT 1;

  -- Si aucune permission spécifique, vérifier le niveau d'accès par défaut
  IF v_niveau_acces IS NULL THEN
    -- Par défaut, aucun accès si pas de permission explicite
    RETURN false;
  END IF;

  -- Vérifier le niveau d'accès
  IF v_niveau_acces = 'aucun' THEN
    RETURN false;
  END IF;

  IF p_action = 'lecture' AND v_niveau_acces IN ('lecture', 'ecriture', 'administration') THEN
    RETURN true;
  END IF;

  IF p_action IN ('update', 'delete') AND v_niveau_acces IN ('ecriture', 'administration') THEN
    RETURN v_can_action;
  END IF;

  IF p_action IN ('create', 'share') AND v_niveau_acces = 'administration' THEN
    RETURN v_can_action;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Fonction pour obtenir tous les dossiers accessibles pour un utilisateur
CREATE OR REPLACE FUNCTION get_accessible_folders(
  p_user_id uuid,
  p_entreprise_id uuid
)
RETURNS TABLE(folder_id uuid, niveau_acces text) AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Récupérer le rôle de l'utilisateur
  SELECT role INTO v_user_role
  FROM utilisateurs
  WHERE id = p_user_id;

  -- Super admin voit tous les dossiers
  IF v_user_role = 'super_admin' THEN
    RETURN QUERY
    SELECT df.id, 'administration'::text
    FROM document_folders df
    WHERE df.entreprise_id = p_entreprise_id;
    RETURN;
  END IF;

  -- Sinon, retourner uniquement les dossiers avec permissions
  RETURN QUERY
  SELECT 
    pd.folder_id,
    pd.niveau_acces
  FROM permissions_dossiers pd
  WHERE pd.entreprise_id = p_entreprise_id
  AND pd.role = v_user_role
  AND pd.niveau_acces != 'aucun';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE equipes IS 'Équipes de travail dans l''entreprise';
COMMENT ON TABLE collaborateurs_equipes IS 'Liaison many-to-many entre collaborateurs et équipes';
COMMENT ON TABLE permissions_dossiers IS 'Permissions d''accès aux dossiers par rôle';

