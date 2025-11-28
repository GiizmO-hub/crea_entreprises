/*
  # CORRECTION: Affichage des clients dans Paramètres
  
  PROBLÈME:
  - Les clients ne s'affichent pas dans Paramètres > Clients
  - La vue clients_with_roles pourrait ne pas exister ou avoir des problèmes RLS
  
  SOLUTION:
  - Vérifier/créer la vue clients_with_roles si elle n'existe pas
  - Améliorer les requêtes pour être plus fiables
  - Ajouter des logs pour debug
*/

-- ============================================================================
-- PARTIE 1 : Créer ou vérifier la vue clients_with_roles
-- ============================================================================

-- Vérifier si la vue existe, sinon la créer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'clients_with_roles'
  ) THEN
    -- Créer la vue clients_with_roles
    CREATE VIEW clients_with_roles AS
    SELECT 
      c.id,
      c.entreprise_id,
      c.nom,
      c.prenom,
      c.email,
      c.telephone,
      c.adresse,
      c.code_postal,
      c.ville,
      c.statut,
      c.entreprise_nom,
      c.created_at,
      c.updated_at,
      -- Rôle depuis la table roles (si role_id existe)
      COALESCE(r.code, 'client') as role_code,
      COALESCE(r.nom, 'Client') as role_nom,
      COALESCE(r.niveau, 0) as role_niveau,
      c.role_id
    FROM clients c
    LEFT JOIN roles r ON c.role_id = r.id;
    
    COMMENT ON VIEW clients_with_roles IS 'Vue combinant clients et leurs rôles';
  ELSE
    RAISE NOTICE 'La vue clients_with_roles existe déjà';
  END IF;
END $$;

-- RLS pour la vue clients_with_roles
ALTER VIEW clients_with_roles SET (security_invoker = true);

-- Grant permissions
GRANT SELECT ON clients_with_roles TO authenticated;

-- ============================================================================
-- PARTIE 2 : Si la table roles n'existe pas ou est vide, créer le rôle par défaut
-- ============================================================================

-- Créer le rôle 'client' par défaut s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM roles WHERE code = 'client'
  ) THEN
    INSERT INTO roles (code, nom, description, niveau)
    VALUES ('client', 'Client', 'Rôle client par défaut', 1)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3 : Fonction helper pour obtenir les clients avec rôles (fallback)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_clients_with_roles(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  entreprise_id uuid,
  nom text,
  prenom text,
  email text,
  role_code text,
  role_nom text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.entreprise_id,
    c.nom,
    c.prenom,
    c.email,
    COALESCE(r.code, 'client') as role_code,
    COALESCE(r.nom, 'Client') as role_nom,
    c.created_at
  FROM clients c
  INNER JOIN entreprises e ON e.id = c.entreprise_id
  LEFT JOIN roles r ON c.role_id = r.id
  WHERE (p_user_id IS NULL OR e.user_id = p_user_id)
  ORDER BY c.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_clients_with_roles IS 'Récupère les clients avec leurs rôles. Si p_user_id est NULL, retourne tous les clients (pour super admin).';

GRANT EXECUTE ON FUNCTION get_clients_with_roles TO authenticated;

