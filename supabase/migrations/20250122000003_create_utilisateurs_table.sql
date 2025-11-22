/*
  # Table Utilisateurs - Gestion des utilisateurs de l'application
  
  Cette table permet de gérer les utilisateurs de l'application avec leurs rôles :
  - super_admin : Administrateur avec tous les droits
  - admin : Administrateur d'une entreprise
  - collaborateur : Employé d'une entreprise
  - client : Client utilisant l'application
  
  ## Colonnes
  - id : UUID (référence auth.users)
  - role : Rôle de l'utilisateur
  - entreprise_id : Entreprise à laquelle il appartient (NULL pour super_admin)
  - statut : active, suspendue
  - created_by : Qui a créé cet utilisateur (NULL si auto-créé)
  - created_at, updated_at : Horodatage
*/

-- ============================================
-- TABLE UTILISATEURS
-- ============================================
CREATE TABLE IF NOT EXISTS utilisateurs (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'collaborateur', 'client')) DEFAULT 'client',
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE SET NULL,
  nom text,
  prenom text,
  telephone text,
  statut text DEFAULT 'active' CHECK (statut IN ('active', 'suspendue')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);
CREATE INDEX idx_utilisateurs_entreprise_id ON utilisateurs(entreprise_id);
CREATE INDEX idx_utilisateurs_statut ON utilisateurs(statut);
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);

-- RLS pour utilisateurs
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;

-- Super admin peut tout voir
CREATE POLICY "Super admin peut voir tous les utilisateurs"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- Utilisateurs peuvent voir leurs propres infos
CREATE POLICY "Utilisateurs peuvent voir leurs propres infos"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Utilisateurs peuvent voir les collaborateurs de leur entreprise (si admin ou collaborateur)
CREATE POLICY "Utilisateurs peuvent voir collaborateurs de leur entreprise"
  ON utilisateurs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs u
      WHERE u.id = auth.uid()
      AND u.entreprise_id = utilisateurs.entreprise_id
      AND u.role IN ('admin', 'collaborateur')
    )
  );

-- Super admin peut créer des utilisateurs
CREATE POLICY "Super admin peut créer des utilisateurs"
  ON utilisateurs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- Super admin peut modifier tous les utilisateurs
CREATE POLICY "Super admin peut modifier tous les utilisateurs"
  ON utilisateurs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- Utilisateurs peuvent modifier leurs propres infos (sauf rôle)
CREATE POLICY "Utilisateurs peuvent modifier leurs propres infos"
  ON utilisateurs FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      -- Ne peut pas modifier le rôle
      role = (SELECT role FROM utilisateurs WHERE id = auth.uid())
      OR
      -- Super admin peut modifier le rôle
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
      )
    )
  );

-- Super admin peut supprimer des utilisateurs
CREATE POLICY "Super admin peut supprimer des utilisateurs"
  ON utilisateurs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role')::text = 'super_admin'
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_utilisateurs_updated_at BEFORE UPDATE ON utilisateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour synchroniser automatiquement un utilisateur auth.users vers utilisateurs
CREATE OR REPLACE FUNCTION sync_user_to_utilisateurs()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer ou mettre à jour dans la table utilisateurs
  INSERT INTO public.utilisateurs (
    id,
    email,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'client'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = COALESCE(
      EXCLUDED.role,
      utilisateurs.role
    ),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour synchroniser automatiquement lors de la création d'un utilisateur auth
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_to_utilisateurs();

-- Note: La création d'utilisateurs dans auth.users nécessite l'utilisation de l'API Supabase Admin
-- Cette fonctionnalité sera implémentée via une Edge Function ou directement via l'API Admin
-- L'application utilisera l'API Supabase Admin pour créer les utilisateurs dans auth.users
-- Ensuite, le trigger sync_user_to_utilisateurs créera automatiquement l'entrée dans la table utilisateurs

