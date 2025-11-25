/*
  # SÉPARATION COMPLÈTE PLATEFORME / CLIENTS AVEC TABLES ROLES
  
  OBJECTIF:
  - Séparer complètement les rôles plateforme des rôles clients
  - Créer roles_plateforme pour la plateforme (super_admin, admin, etc.)
  - Créer equipe_plateforme pour lier utilisateurs plateforme à leurs rôles
  - Utiliser roles pour les clients (déjà créé)
  - Analyser et intégrer les modules dans ce système
  
  STRUCTURE:
  - roles_plateforme: rôles de la plateforme (super_admin, admin, support, etc.)
  - equipe_plateforme: liaison utilisateurs plateforme → roles_plateforme
  - roles: rôles clients (déjà créé)
  - clients.role_id: liaison clients → roles (déjà créé)
  - modules_roles: liaison modules → rôles (pour permissions)
*/

-- ✅ 1. Créer la table roles_plateforme
CREATE TABLE IF NOT EXISTS roles_plateforme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, -- 'super_admin', 'admin', 'support', 'moderateur'
  nom text NOT NULL, -- 'Super Administrateur', 'Administrateur', 'Support', 'Modérateur'
  description text,
  niveau integer DEFAULT 0, -- Niveau de permission (0 = basique, 10 = super admin)
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE roles_plateforme IS 'Rôles disponibles pour les utilisateurs de la plateforme (non-clients)';
COMMENT ON COLUMN roles_plateforme.code IS 'Code unique du rôle (ex: super_admin)';
COMMENT ON COLUMN roles_plateforme.niveau IS 'Niveau de permission (0 = basique, 10 = super admin)';

-- Insérer les rôles plateforme de base
INSERT INTO roles_plateforme (code, nom, description, niveau, actif) VALUES
  ('support', 'Support', 'Support client avec accès limité', 2, true),
  ('moderateur', 'Modérateur', 'Modérateur avec permissions de modération', 4, true),
  ('admin', 'Administrateur', 'Administrateur avec permissions étendues', 8, true),
  ('super_admin', 'Super Administrateur', 'Super administrateur avec toutes les permissions plateforme', 10, true)
ON CONFLICT (code) DO NOTHING;

-- ✅ 2. Créer la table equipe_plateforme pour lier utilisateurs → roles_plateforme
CREATE TABLE IF NOT EXISTS equipe_plateforme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles_plateforme(id) ON DELETE RESTRICT,
  email text,
  nom text,
  prenom text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id) -- Un utilisateur ne peut avoir qu'un seul rôle plateforme
);

COMMENT ON TABLE equipe_plateforme IS 'Liaison entre utilisateurs plateforme et leurs rôles';
COMMENT ON COLUMN equipe_plateforme.user_id IS 'ID de l''utilisateur dans auth.users (doit être un utilisateur plateforme, pas un client)';

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_equipe_plateforme_user_id ON equipe_plateforme(user_id);
CREATE INDEX IF NOT EXISTS idx_equipe_plateforme_role_id ON equipe_plateforme(role_id);
CREATE INDEX IF NOT EXISTS idx_equipe_plateforme_actif ON equipe_plateforme(actif);

-- ✅ 3. Migrer les super_admin existants vers equipe_plateforme
DO $$
DECLARE
  v_super_admin_role_id uuid;
  v_admin_role_id uuid;
  v_count integer;
  v_user_record RECORD;
BEGIN
  -- Récupérer les IDs des rôles
  SELECT id INTO v_super_admin_role_id FROM roles_plateforme WHERE code = 'super_admin' LIMIT 1;
  SELECT id INTO v_admin_role_id FROM roles_plateforme WHERE code = 'admin' LIMIT 1;
  
  -- Migrer les super_admin plateforme (ceux qui n'ont PAS d'espace membre client)
  FOR v_user_record IN
    SELECT 
      au.id,
      au.email,
      COALESCE(u.nom, '') as nom,
      COALESCE(u.prenom, '') as prenom,
      COALESCE((au.raw_user_meta_data->>'role')::text, u.role) as role
    FROM auth.users au
    LEFT JOIN utilisateurs u ON u.id = au.id
    WHERE (
      (au.raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
      OR u.role IN ('super_admin', 'admin')
    )
    AND NOT EXISTS (
      SELECT 1 FROM espaces_membres_clients emc WHERE emc.user_id = au.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM equipe_plateforme ep WHERE ep.user_id = au.id
    )
  LOOP
    INSERT INTO equipe_plateforme (user_id, role_id, email, nom, prenom, actif)
    VALUES (
      v_user_record.id,
      CASE 
        WHEN v_user_record.role = 'super_admin' THEN v_super_admin_role_id
        ELSE v_admin_role_id
      END,
      v_user_record.email,
      v_user_record.nom,
      v_user_record.prenom,
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Migrés % utilisateurs plateforme vers equipe_plateforme', v_count;
END $$;

-- ✅ 4. Créer une table modules_roles pour lier modules → rôles (permissions)
CREATE TABLE IF NOT EXISTS modules_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL, -- Code du module (ex: 'gestion-projets', 'facturation')
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE, -- Rôle client
  role_plateforme_id uuid REFERENCES roles_plateforme(id) ON DELETE CASCADE, -- Rôle plateforme
  acces boolean DEFAULT true, -- true = accès autorisé, false = accès refusé
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Un module ne peut être lié qu'à un rôle client OU un rôle plateforme, pas les deux
  CONSTRAINT check_role_type CHECK (
    (role_id IS NULL AND role_plateforme_id IS NOT NULL) OR
    (role_id IS NOT NULL AND role_plateforme_id IS NULL)
  )
);

COMMENT ON TABLE modules_roles IS 'Liaison entre modules et rôles (clients ou plateforme) pour gérer les permissions d''accès';
COMMENT ON COLUMN modules_roles.module_code IS 'Code du module (doit correspondre à modules_activation.module_code)';
COMMENT ON COLUMN modules_roles.role_id IS 'Rôle client (si NULL, alors role_plateforme_id doit être défini)';
COMMENT ON COLUMN modules_roles.role_plateforme_id IS 'Rôle plateforme (si NULL, alors role_id doit être défini)';

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_modules_roles_module_code ON modules_roles(module_code);
CREATE INDEX IF NOT EXISTS idx_modules_roles_role_id ON modules_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_modules_roles_role_plateforme_id ON modules_roles(role_plateforme_id);

-- ✅ 5. Fonction helper pour vérifier si un utilisateur plateforme a un rôle
CREATE OR REPLACE FUNCTION is_platform_user_with_role(
  p_user_id uuid,
  p_role_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_platform_user boolean;
  v_role_code text;
BEGIN
  -- Vérifier que l'utilisateur est un utilisateur plateforme (pas un client)
  SELECT EXISTS (
    SELECT 1 FROM equipe_plateforme ep
    WHERE ep.user_id = p_user_id
      AND ep.actif = true
  ) INTO v_is_platform_user;
  
  IF NOT v_is_platform_user THEN
    RETURN false;
  END IF;
  
  -- Si un rôle spécifique est demandé, vérifier
  IF p_role_code IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM equipe_plateforme ep
      JOIN roles_plateforme rp ON rp.id = ep.role_id
      WHERE ep.user_id = p_user_id
        AND ep.actif = true
        AND rp.code = p_role_code
        AND rp.actif = true
    ) INTO v_is_platform_user;
  END IF;
  
  RETURN v_is_platform_user;
END;
$$;

COMMENT ON FUNCTION is_platform_user_with_role IS 'Vérifie si un utilisateur est un utilisateur plateforme avec un rôle spécifique (ou n''importe quel rôle si p_role_code est NULL)';

-- ✅ 6. Fonction helper pour vérifier si un client a un rôle
CREATE OR REPLACE FUNCTION is_client_with_role(
  p_client_id uuid,
  p_role_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_role boolean;
BEGIN
  IF p_role_code IS NULL THEN
    -- Vérifier juste si le client a un rôle (pas client par défaut)
    SELECT EXISTS (
      SELECT 1 FROM clients c
      JOIN roles r ON r.id = c.role_id
      WHERE c.id = p_client_id
        AND r.actif = true
    ) INTO v_has_role;
  ELSE
    -- Vérifier si le client a un rôle spécifique
    SELECT EXISTS (
      SELECT 1 FROM clients c
      JOIN roles r ON r.id = c.role_id
      WHERE c.id = p_client_id
        AND r.code = p_role_code
        AND r.actif = true
    ) INTO v_has_role;
  END IF;
  
  RETURN COALESCE(v_has_role, false);
END;
$$;

COMMENT ON FUNCTION is_client_with_role IS 'Vérifie si un client a un rôle spécifique (ou n''importe quel rôle si p_role_code est NULL)';

-- ✅ 7. Fonction helper pour obtenir le rôle d'un utilisateur plateforme
CREATE OR REPLACE FUNCTION get_platform_user_role(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role_code text;
BEGIN
  SELECT rp.code
  INTO v_role_code
  FROM equipe_plateforme ep
  JOIN roles_plateforme rp ON rp.id = ep.role_id
  WHERE ep.user_id = p_user_id
    AND ep.actif = true
    AND rp.actif = true
  LIMIT 1;
  
  RETURN COALESCE(v_role_code, NULL);
END;
$$;

COMMENT ON FUNCTION get_platform_user_role IS 'Retourne le code du rôle plateforme d''un utilisateur';

-- ✅ 8. Fonction helper pour obtenir le rôle d'un client
CREATE OR REPLACE FUNCTION get_client_role_code(p_client_id uuid)
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

COMMENT ON FUNCTION get_client_role_code IS 'Retourne le code du rôle d''un client depuis la table roles';

-- ✅ 9. Fonction pour vérifier l'accès à un module selon le rôle
CREATE OR REPLACE FUNCTION has_module_access(
  p_user_id uuid,
  p_module_code text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_platform_user boolean;
  v_is_client boolean;
  v_role_code text;
  v_has_access boolean;
BEGIN
  -- Vérifier si c'est un utilisateur plateforme
  SELECT is_platform_user_with_role(p_user_id) INTO v_is_platform_user;
  
  IF v_is_platform_user THEN
    -- Récupérer le rôle plateforme
    SELECT get_platform_user_role(p_user_id) INTO v_role_code;
    
    -- Vérifier l'accès dans modules_roles
    SELECT EXISTS (
      SELECT 1 FROM modules_roles mr
      JOIN roles_plateforme rp ON rp.id = mr.role_plateforme_id
      WHERE mr.module_code = p_module_code
        AND rp.code = v_role_code
        AND mr.acces = true
    ) INTO v_has_access;
    
    -- Si pas de restriction spécifique, accès par défaut pour plateforme
    IF NOT FOUND OR v_has_access IS NULL THEN
      RETURN true; -- Par défaut, les utilisateurs plateforme ont accès à tout
    END IF;
    
    RETURN v_has_access;
  END IF;
  
  -- Vérifier si c'est un client
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients emc
    WHERE emc.user_id = p_user_id
  ) INTO v_is_client;
  
  IF v_is_client THEN
    -- Récupérer le rôle client
    SELECT get_client_role_code(c.id)
    INTO v_role_code
    FROM clients c
    JOIN espaces_membres_clients emc ON emc.client_id = c.id
    WHERE emc.user_id = p_user_id
    LIMIT 1;
    
    -- Vérifier l'accès dans modules_roles
    SELECT EXISTS (
      SELECT 1 FROM modules_roles mr
      JOIN roles r ON r.id = mr.role_id
      WHERE mr.module_code = p_module_code
        AND r.code = v_role_code
        AND mr.acces = true
    ) INTO v_has_access;
    
    -- Si pas de restriction spécifique, vérifier dans modules_actifs de l'espace
    IF NOT FOUND OR v_has_access IS NULL THEN
      SELECT COALESCE(
        (modules_actifs->>p_module_code)::boolean,
        false
      )
      INTO v_has_access
      FROM espaces_membres_clients
      WHERE user_id = p_user_id
      LIMIT 1;
    END IF;
    
    RETURN COALESCE(v_has_access, false);
  END IF;
  
  -- Par défaut, pas d'accès
  RETURN false;
END;
$$;

COMMENT ON FUNCTION has_module_access IS 'Vérifie si un utilisateur (plateforme ou client) a accès à un module selon son rôle';

-- ✅ 10. Mettre à jour is_platform_super_admin pour utiliser equipe_plateforme
CREATE OR REPLACE FUNCTION is_platform_super_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_is_super_admin boolean;
BEGIN
  -- Utiliser auth.uid() si p_user_id n'est pas fourni
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier dans equipe_plateforme
  SELECT EXISTS (
    SELECT 1 
    FROM equipe_plateforme ep
    JOIN roles_plateforme rp ON rp.id = ep.role_id
    WHERE ep.user_id = v_user_id
      AND ep.actif = true
      AND rp.code = 'super_admin'
      AND rp.actif = true
  ) INTO v_is_super_admin;
  
  RETURN COALESCE(v_is_super_admin, false);
END;
$$;

COMMENT ON FUNCTION is_platform_super_admin IS 'Vérifie si un utilisateur est super_admin plateforme en utilisant equipe_plateforme';

-- ✅ 11. RLS pour les nouvelles tables
ALTER TABLE roles_plateforme ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_plateforme ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules_roles ENABLE ROW LEVEL SECURITY;

-- RLS pour roles_plateforme (lecture publique des rôles actifs)
DROP POLICY IF EXISTS "Anyone can view active platform roles" ON roles_plateforme;
CREATE POLICY "Anyone can view active platform roles"
  ON roles_plateforme FOR SELECT
  TO authenticated
  USING (actif = true);

-- RLS pour equipe_plateforme (lecture de sa propre entrée ou si super_admin)
DROP POLICY IF EXISTS "Users can view own platform team entry" ON equipe_plateforme;
CREATE POLICY "Users can view own platform team entry"
  ON equipe_plateforme FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    is_platform_super_admin()
  );

-- RLS pour modules_roles (lecture publique)
DROP POLICY IF EXISTS "Anyone can view module roles" ON modules_roles;
CREATE POLICY "Anyone can view module roles"
  ON modules_roles FOR SELECT
  TO authenticated
  USING (true);

-- ✅ 12. Vues pour faciliter les requêtes
CREATE OR REPLACE VIEW equipe_plateforme_with_roles AS
SELECT 
  ep.*,
  rp.code as role_code,
  rp.nom as role_nom,
  rp.niveau as role_niveau,
  au.email as user_email
FROM equipe_plateforme ep
JOIN roles_plateforme rp ON rp.id = ep.role_id
LEFT JOIN auth.users au ON au.id = ep.user_id
WHERE ep.actif = true AND rp.actif = true;

COMMENT ON VIEW equipe_plateforme_with_roles IS 'Vue pour faciliter les requêtes équipe plateforme avec leurs rôles';

-- ✅ 13. Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ SÉPARATION PLATEFORME/CLIENTS CRÉÉE ! ✅✅✅';
  RAISE NOTICE '   - Table roles_plateforme créée';
  RAISE NOTICE '   - Table equipe_plateforme créée';
  RAISE NOTICE '   - Table modules_roles créée pour permissions modules';
  RAISE NOTICE '   - Fonctions helpers créées';
  RAISE NOTICE '   - Migration des données effectuée';
  RAISE NOTICE '   - RLS configuré';
END $$;

