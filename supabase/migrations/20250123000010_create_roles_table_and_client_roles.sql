/*
  # CRÉATION TABLE ROLES ET SYSTÈME DE RÔLES CLIENTS
  
  SOLUTION SIMPLE ET PROPRE:
  - Créer une table "roles" avec tous les rôles clients possibles
  - Ajouter une colonne "role_id" dans la table "clients" 
  - Faire correspondre ces deux tables avec une foreign key
  - Utiliser cette table pour tous les scripts et fonctions
  
  AVANTAGES:
  - Structure normalisée et maintenable
  - Facile d'ajouter de nouveaux rôles
  - Plus simple à interroger et à gérer
  - Pas besoin de synchroniser plusieurs tables
*/

-- ✅ 1. Créer la table "roles"
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- 'client_super_admin', 'client_admin', 'client_comptable', 'client_manager', 'client'
  nom text NOT NULL, -- 'Super Administrateur Client', 'Administrateur Client', 'Comptable Client', 'Manager Client', 'Client'
  description text,
  niveau integer DEFAULT 0, -- Niveau de permission (0 = client basique, 10 = super admin)
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Commentaires
COMMENT ON TABLE roles IS 'Table des rôles clients disponibles dans le système';
COMMENT ON COLUMN roles.code IS 'Code unique du rôle (ex: client_super_admin)';
COMMENT ON COLUMN roles.nom IS 'Nom affiché du rôle (ex: Super Administrateur Client)';
COMMENT ON COLUMN roles.niveau IS 'Niveau de permission (0 = client basique, 10 = super admin)';

-- ✅ 2. Insérer les rôles clients de base
INSERT INTO roles (code, nom, description, niveau, actif) VALUES
  ('client', 'Client', 'Client standard sans permissions spéciales', 0, true),
  ('client_manager', 'Manager Client', 'Manager avec permissions de gestion d''équipe', 5, true),
  ('client_comptable', 'Comptable Client', 'Comptable avec accès aux modules financiers', 6, true),
  ('client_admin', 'Administrateur Client', 'Administrateur avec permissions étendues', 8, true),
  ('client_super_admin', 'Super Administrateur Client', 'Super administrateur avec toutes les permissions dans son espace client', 10, true)
ON CONFLICT (code) DO NOTHING;

-- ✅ 3. Ajouter la colonne role_id dans la table clients
-- D'abord vérifier si elle existe déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'role_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN role_id uuid REFERENCES roles(id) ON DELETE SET NULL;
    
    -- Créer un index pour les performances
    CREATE INDEX IF NOT EXISTS idx_clients_role_id ON clients(role_id);
    
    -- Commentaire
    COMMENT ON COLUMN clients.role_id IS 'Rôle du client (référence vers la table roles). NULL = client par défaut.';
  END IF;
END $$;

-- ✅ 4. Migrer les rôles existants depuis utilisateurs vers clients.role_id
DO $$
DECLARE
  v_role_client_id uuid;
  v_role_super_admin_id uuid;
  v_count integer;
BEGIN
  -- Récupérer les IDs des rôles
  SELECT id INTO v_role_client_id FROM roles WHERE code = 'client' LIMIT 1;
  SELECT id INTO v_role_super_admin_id FROM roles WHERE code = 'client_super_admin' LIMIT 1;
  
  -- Mettre à jour les clients qui ont un espace membre avec un rôle client_super_admin
  UPDATE clients c
  SET role_id = v_role_super_admin_id
  FROM espaces_membres_clients emc
  JOIN utilisateurs u ON u.id = emc.user_id
  WHERE c.id = emc.client_id
    AND u.role = 'client_super_admin'
    AND c.role_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '✅ Migrés % clients vers client_super_admin', v_count;
  
  -- Pour les autres clients sans rôle spécifique, mettre 'client' par défaut (ou laisser NULL)
  -- On ne fait rien car NULL peut être considéré comme 'client' par défaut
  
END $$;

-- ✅ 5. Créer une fonction helper pour obtenir le rôle d'un client
CREATE OR REPLACE FUNCTION get_client_role(p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_role_code text;
BEGIN
  SELECT COALESCE(r.code, 'client')
  INTO v_role_code
  FROM clients c
  LEFT JOIN roles r ON r.id = c.role_id
  WHERE c.id = p_client_id
  LIMIT 1;
  
  RETURN COALESCE(v_role_code, 'client');
END;
$$;

COMMENT ON FUNCTION get_client_role(uuid) IS 'Retourne le code du rôle d''un client depuis la table roles';

-- ✅ 6. Recréer la fonction toggle_client_super_admin pour utiliser la table roles
CREATE OR REPLACE FUNCTION toggle_client_super_admin(
  p_client_id uuid,
  p_is_super_admin boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_client_email text;
  v_client_nom text;
  v_client_prenom text;
  v_user_id uuid;
  v_new_role_id uuid;
  v_new_role_code text;
  v_old_role_code text;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est super_admin de la plateforme
  IF NOT COALESCE(is_platform_super_admin(), false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès non autorisé - Super admin plateforme requis'
    );
  END IF;

  -- Récupérer les informations du client
  SELECT 
    c.email,
    c.nom,
    c.prenom,
    emc.user_id,
    COALESCE(r.code, 'client') as current_role
  INTO 
    v_client_email,
    v_client_nom,
    v_client_prenom,
    v_user_id,
    v_old_role_code
  FROM clients c
  LEFT JOIN espaces_membres_clients emc ON emc.client_id = c.id
  LEFT JOIN roles r ON r.id = c.role_id
  WHERE c.id = p_client_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucun espace membre trouvé pour ce client. Créez d''abord un espace membre.'
    );
  END IF;

  -- Déterminer le nouveau rôle
  IF p_is_super_admin THEN
    v_new_role_code := 'client_super_admin';
  ELSE
    v_new_role_code := 'client';
  END IF;

  -- Récupérer l'ID du rôle
  SELECT id INTO v_new_role_id
  FROM roles
  WHERE code = v_new_role_code
    AND actif = true
  LIMIT 1;

  IF v_new_role_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle non trouvé: ' || v_new_role_code
    );
  END IF;

  -- ✅ Mettre à jour le rôle dans la table clients
  UPDATE clients
  SET role_id = v_new_role_id,
      updated_at = NOW()
  WHERE id = p_client_id;

  -- ✅ Synchroniser dans utilisateurs (pour compatibilité)
  INSERT INTO utilisateurs (
    id, email, nom, prenom, role, created_at, updated_at
  )
  VALUES (
    v_user_id,
    COALESCE(v_client_email, ''),
    COALESCE(v_client_nom, ''),
    COALESCE(v_client_prenom, ''),
    v_new_role_code,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    role = v_new_role_code,
    email = COALESCE(v_client_email, utilisateurs.email),
    nom = COALESCE(v_client_nom, utilisateurs.nom),
    prenom = COALESCE(v_client_prenom, utilisateurs.prenom),
    updated_at = NOW();

  -- ✅ Synchroniser dans auth.users.raw_user_meta_data (pour persistance JWT)
  UPDATE auth.users
  SET 
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_new_role_code)
    ),
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_is_super_admin THEN 'Client défini comme super admin. Le rôle est maintenant permanent dans la table clients.role_id.'
      ELSE 'Statut super admin retiré du client. Le rôle est maintenant permanent dans la table clients.role_id.'
    END,
    'is_super_admin', p_is_super_admin,
    'role', v_new_role_code,
    'role_id', v_new_role_id,
    'old_role', v_old_role_code,
    'user_id', v_user_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION toggle_client_super_admin IS 'Active ou désactive le statut client_super_admin d''un client. Utilise la table roles et met à jour clients.role_id. Synchronise également utilisateurs et auth.users pour compatibilité.';

GRANT EXECUTE ON FUNCTION toggle_client_super_admin(uuid, boolean) TO authenticated;

-- ✅ 7. Créer une vue pour faciliter les requêtes clients avec leurs rôles
CREATE OR REPLACE VIEW clients_with_roles AS
SELECT 
  c.*,
  COALESCE(r.code, 'client') as role_code,
  COALESCE(r.nom, 'Client') as role_nom,
  COALESCE(r.niveau, 0) as role_niveau
FROM clients c
LEFT JOIN roles r ON r.id = c.role_id;

COMMENT ON VIEW clients_with_roles IS 'Vue pour faciliter les requêtes clients avec leurs rôles depuis la table roles';

-- ✅ 8. RLS pour la table roles (lecture publique pour les rôles actifs)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active roles" ON roles;
CREATE POLICY "Anyone can view active roles"
  ON roles FOR SELECT
  TO authenticated
  USING (actif = true);

-- ✅ 9. Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ SYSTÈME DE RÔLES CRÉÉ AVEC SUCCÈS ! ✅✅✅';
  RAISE NOTICE '   - Table roles créée avec les rôles clients';
  RAISE NOTICE '   - Colonne role_id ajoutée à clients';
  RAISE NOTICE '   - Fonction toggle_client_super_admin mise à jour';
  RAISE NOTICE '   - Migration des données existantes effectuée';
  RAISE NOTICE '   - Vue clients_with_roles créée';
END $$;




