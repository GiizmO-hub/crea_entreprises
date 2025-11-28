/*
  # CORRECTION : clients_with_roles doit utiliser utilisateurs.role
  
  Problème :
  - La vue clients_with_roles utilise uniquement clients.role_id → roles.code
  - Elle ignore le rôle depuis utilisateurs.role qui est 'client_super_admin'
  - Le frontend compte les super admins depuis role_code qui reste 'client'
  
  Solution :
  - Modifier la vue clients_with_roles pour prioriser utilisateurs.role
  - Si utilisateurs.role = 'client_super_admin', utiliser ce rôle
  - Sinon, utiliser roles.code comme avant
*/

-- ========================================
-- Recréer la vue clients_with_roles avec utilisateurs.role
-- ========================================

DROP VIEW IF EXISTS clients_with_roles CASCADE;

CREATE OR REPLACE VIEW clients_with_roles AS
SELECT 
  c.id,
  c.entreprise_id,
  c.nom,
  c.prenom,
  c.entreprise_nom,
  c.email,
  c.telephone,
  c.portable,
  c.adresse,
  c.code_postal,
  c.ville,
  c.pays,
  c.siret,
  c.tva_intracommunautaire,
  c.statut,
  c.notes,
  c.tags,
  c.created_at,
  c.updated_at,
  c.role_id,
  -- ✅ PRIORITÉ 1 : utiliser utilisateurs.role si = 'client_super_admin'
  -- ✅ PRIORITÉ 2 : utiliser roles.code depuis role_id
  -- ✅ PRIORITÉ 3 : default 'client'
  CASE 
    WHEN u.role = 'client_super_admin' THEN 'client_super_admin'
    WHEN r.code IS NOT NULL THEN r.code
    ELSE 'client'
  END AS role_code,
  CASE 
    WHEN u.role = 'client_super_admin' THEN 'Super Administrateur Client'
    WHEN r.nom IS NOT NULL THEN r.nom
    ELSE 'Client'
  END AS role_nom,
  CASE 
    WHEN u.role = 'client_super_admin' THEN 100
    WHEN r.niveau IS NOT NULL THEN r.niveau
    ELSE 0
  END AS role_niveau
FROM clients c
LEFT JOIN utilisateurs u ON u.email = c.email
LEFT JOIN roles r ON r.id = c.role_id;

COMMENT ON VIEW clients_with_roles IS 
  'Vue des clients avec leurs rôles. Priorise utilisateurs.role si client_super_admin, sinon utilise roles.code depuis role_id.';

GRANT SELECT ON clients_with_roles TO authenticated;

-- ========================================
-- Vérification
-- ========================================

DO $$
DECLARE
  v_test_count integer;
BEGIN
  SELECT COUNT(*) INTO v_test_count
  FROM clients_with_roles cwr
  INNER JOIN clients c ON c.id = cwr.id
  LEFT JOIN utilisateurs u ON u.email = c.email
  WHERE u.role = 'client_super_admin' AND cwr.role_code = 'client_super_admin';
  
  RAISE NOTICE '✅ Migration 20250129000032 appliquée';
  RAISE NOTICE '📋 Vue clients_with_roles recréée avec priorité utilisateurs.role';
  RAISE NOTICE '📊 % client(s) avec role_code = client_super_admin détecté(s)', v_test_count;
END $$;

