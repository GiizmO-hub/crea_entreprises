/*
  # Table Collaborateurs avec rôles multiples
  
  1. Nouvelle table
    - `collaborateurs` : Table dédiée pour gérer les collaborateurs avec différents rôles
    - Rôles possibles : 'collaborateur', 'admin', 'manager', 'comptable', 'commercial'
  
  2. Fonction automatique
    - `create_collaborateur()` : Crée automatiquement dans auth.users, utilisateurs et collaborateurs
*/

-- Activer l'extension pgcrypto si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Créer la table collaborateurs
CREATE TABLE IF NOT EXISTS collaborateurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  nom text,
  prenom text,
  telephone text,
  role text NOT NULL CHECK (role IN ('collaborateur', 'admin', 'manager', 'comptable', 'commercial', 'super_admin')) DEFAULT 'collaborateur',
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  departement text,
  poste text,
  statut text DEFAULT 'active' CHECK (statut IN ('active', 'suspendue', 'inactif')),
  date_embauche date,
  salaire numeric(10, 2),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_collaborateurs_user_id ON collaborateurs(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_email ON collaborateurs(email);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_role ON collaborateurs(role);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_entreprise_id ON collaborateurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_statut ON collaborateurs(statut);

-- 3. Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_collaborateurs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_collaborateurs_updated_at ON collaborateurs;
CREATE TRIGGER trigger_update_collaborateurs_updated_at
  BEFORE UPDATE ON collaborateurs
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborateurs_updated_at();

-- 4. RLS pour collaborateurs
ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour collaborateurs
-- Super admin peut voir tous les collaborateurs
DROP POLICY IF EXISTS "Super admin peut voir tous les collaborateurs" ON collaborateurs;
CREATE POLICY "Super admin peut voir tous les collaborateurs"
  ON collaborateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- Les collaborateurs peuvent voir leurs propres infos
DROP POLICY IF EXISTS "Collaborateurs peuvent voir leurs propres infos" ON collaborateurs;
CREATE POLICY "Collaborateurs peuvent voir leurs propres infos"
  ON collaborateurs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Les admins peuvent voir les collaborateurs de leur entreprise
DROP POLICY IF EXISTS "Admins peuvent voir collaborateurs de leur entreprise" ON collaborateurs;
CREATE POLICY "Admins peuvent voir collaborateurs de leur entreprise"
  ON collaborateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
      AND (
        u.entreprise_id = collaborateurs.entreprise_id
        OR u.role = 'super_admin'
      )
    )
  );

-- Super admin peut insérer des collaborateurs
DROP POLICY IF EXISTS "Super admin peut créer collaborateurs" ON collaborateurs;
CREATE POLICY "Super admin peut créer collaborateurs"
  ON collaborateurs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- Super admin peut modifier les collaborateurs
DROP POLICY IF EXISTS "Super admin peut modifier collaborateurs" ON collaborateurs;
CREATE POLICY "Super admin peut modifier collaborateurs"
  ON collaborateurs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- Super admin peut supprimer les collaborateurs
DROP POLICY IF EXISTS "Super admin peut supprimer collaborateurs" ON collaborateurs;
CREATE POLICY "Super admin peut supprimer collaborateurs"
  ON collaborateurs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 5. Fonction pour créer automatiquement un collaborateur
-- Cette fonction crée dans auth.users, utilisateurs et collaborateurs en une seule fois
CREATE OR REPLACE FUNCTION create_collaborateur(
  p_email text,
  p_password text,
  p_nom text DEFAULT NULL,
  p_prenom text DEFAULT NULL,
  p_telephone text DEFAULT NULL,
  p_role text DEFAULT 'collaborateur',
  p_entreprise_id uuid DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_poste text DEFAULT NULL,
  p_date_embauche date DEFAULT NULL,
  p_salaire numeric(10, 2) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_collaborateur_id uuid;
  v_instance_id uuid;
BEGIN
  -- Vérifier que seul super_admin peut créer des collaborateurs
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seuls les super_admin peuvent créer des collaborateurs'
    );
  END IF;

  -- Valider le rôle
  IF p_role NOT IN ('collaborateur', 'admin', 'manager', 'comptable', 'commercial', 'super_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle invalide. Rôles autorisés: collaborateur, admin, manager, comptable, commercial, super_admin'
    );
  END IF;

  -- Vérifier que l'email n'existe pas déjà
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cet email est déjà utilisé'
    );
  END IF;

  -- Récupérer l'instance_id (nécessaire pour auth.users)
  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- 1. Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    v_instance_id,
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('role', p_role),
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- 2. Créer l'entrée dans utilisateurs
  INSERT INTO utilisateurs (
    id,
    email,
    role,
    entreprise_id,
    nom,
    prenom,
    telephone,
    statut,
    created_by
  ) VALUES (
    v_user_id,
    p_email,
    p_role,
    p_entreprise_id,
    p_nom,
    p_prenom,
    p_telephone,
    'active',
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    entreprise_id = EXCLUDED.entreprise_id,
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    telephone = EXCLUDED.telephone,
    updated_at = now();

  -- 3. Créer l'entrée dans collaborateurs
  INSERT INTO collaborateurs (
    user_id,
    email,
    nom,
    prenom,
    telephone,
    role,
    entreprise_id,
    departement,
    poste,
    date_embauche,
    salaire,
    statut,
    created_by
  ) VALUES (
    v_user_id,
    p_email,
    p_nom,
    p_prenom,
    p_telephone,
    p_role,
    p_entreprise_id,
    p_departement,
    p_poste,
    p_date_embauche,
    p_salaire,
    'active',
    auth.uid()
  )
  RETURNING id INTO v_collaborateur_id;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur créé avec succès',
    'user_id', v_user_id,
    'collaborateur_id', v_collaborateur_id,
    'email', p_email,
    'role', p_role
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Si l'utilisateur existe déjà, supprimer ce qui a été créé
    IF v_user_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = v_user_id;
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cet email est déjà utilisé'
    );
  WHEN OTHERS THEN
    -- En cas d'erreur, nettoyer ce qui a été créé
    IF v_user_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = v_user_id;
      DELETE FROM utilisateurs WHERE id = v_user_id;
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 6. Fonction pour supprimer complètement un collaborateur
CREATE OR REPLACE FUNCTION delete_collaborateur_complete(p_collaborateur_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Vérifier que seul super_admin peut supprimer
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seuls les super_admin peuvent supprimer des collaborateurs'
    );
  END IF;

  -- Récupérer le user_id
  SELECT user_id INTO v_user_id FROM collaborateurs WHERE id = p_collaborateur_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Collaborateur non trouvé'
    );
  END IF;

  -- Supprimer dans l'ordre (les CASCADE s'occuperont du reste)
  DELETE FROM collaborateurs WHERE id = p_collaborateur_id;
  DELETE FROM utilisateurs WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur supprimé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 7. Commentaires pour documentation
COMMENT ON TABLE collaborateurs IS 'Table dédiée pour gérer les collaborateurs avec différents rôles';
COMMENT ON COLUMN collaborateurs.role IS 'Rôles possibles: collaborateur, admin, manager, comptable, commercial, super_admin';
COMMENT ON FUNCTION create_collaborateur IS 'Crée automatiquement un collaborateur dans auth.users, utilisateurs et collaborateurs';
COMMENT ON FUNCTION delete_collaborateur_complete IS 'Supprime complètement un collaborateur (auth.users, utilisateurs, collaborateurs)';

