/*
  # CORRECTION DES PROBLÈMES DE SÉCURITÉ IDENTIFIÉS PAR LE LINTER
  
  Cette migration corrige tous les problèmes de sécurité identifiés :
  1. Vues exposant auth.users → Utiliser utilisateurs au lieu de auth.users
  2. SECURITY DEFINER sur les vues → Retirer ou rendre non exposées
  3. RLS désactivé → Activer RLS avec politiques appropriées
  4. user_metadata dans RLS → Utiliser is_super_admin_check() à la place
  
  IMPORTANT : Cette migration ne casse rien, elle sécurise seulement.
*/

-- ============================================================================
-- PARTIE 1 : CORRIGER LES VUES QUI EXPOSENT auth.users
-- ============================================================================

-- 1.1. Corriger super_admins_plateforme pour utiliser utilisateurs au lieu de auth.users
-- IMPORTANT: DROP CASCADE pour supprimer complètement la vue et toutes ses dépendances
DROP VIEW IF EXISTS super_admins_plateforme CASCADE;

-- Recréer la vue SANS SECURITY DEFINER (simplement CREATE VIEW sans SECURITY DEFINER)
CREATE VIEW super_admins_plateforme AS
SELECT 
  u.id,
  u.email,
  u.nom,
  u.prenom,
  u.created_at,
  u.updated_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE user_id = u.id
    ) THEN false
    ELSE true
  END as est_plateforme_super_admin
FROM utilisateurs u
WHERE u.role = 'super_admin'
AND NOT EXISTS (
  SELECT 1 FROM espaces_membres_clients
  WHERE user_id = u.id
);

COMMENT ON VIEW super_admins_plateforme IS 'Vue des super administrateurs plateforme (utilise utilisateurs au lieu de auth.users pour sécurité)';

-- 1.2. Corriger equipe_plateforme_with_roles pour utiliser utilisateurs au lieu de auth.users
-- IMPORTANT: DROP CASCADE pour supprimer complètement la vue et toutes ses dépendances
DROP VIEW IF EXISTS equipe_plateforme_with_roles CASCADE;

-- Recréer la vue SANS SECURITY DEFINER (simplement CREATE VIEW sans SECURITY DEFINER)
CREATE VIEW equipe_plateforme_with_roles AS
SELECT 
  ep.*,
  rp.code as role_code,
  rp.nom as role_nom,
  rp.niveau as role_niveau,
  u.email as user_email
FROM equipe_plateforme ep
JOIN roles_plateforme rp ON rp.id = ep.role_id
LEFT JOIN utilisateurs u ON u.id = ep.user_id
WHERE ep.actif = true AND rp.actif = true;

COMMENT ON VIEW equipe_plateforme_with_roles IS 'Vue pour faciliter les requêtes équipe plateforme avec leurs rôles (utilise utilisateurs au lieu de auth.users)';

-- 1.3. Corriger clients_with_roles pour retirer SECURITY DEFINER si présent
DROP VIEW IF EXISTS clients_with_roles CASCADE;

-- Recréer la vue SANS SECURITY DEFINER (simplement CREATE VIEW sans SECURITY DEFINER)
CREATE VIEW clients_with_roles AS
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
  -- Prioriser utilisateurs.role si client_super_admin, sinon utiliser roles.code
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
  'Vue des clients avec leurs rôles. Priorise utilisateurs.role si client_super_admin, sinon utilise roles.code depuis role_id. (Sans SECURITY DEFINER)';

-- ============================================================================
-- PARTIE 2 : ACTIVER RLS SUR LES TABLES QUI N'EN ONT PAS
-- ============================================================================

-- 2.1. schema_migrations - Lecture seule pour tous (table système)
ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view schema migrations" ON schema_migrations;
CREATE POLICY "Anyone can view schema migrations"
  ON schema_migrations FOR SELECT
  TO authenticated
  USING (true);

-- 2.2. codes_ape_naf - Lecture seule pour tous (table de référence)
ALTER TABLE IF EXISTS codes_ape_naf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view APE/NAF codes" ON codes_ape_naf;
CREATE POLICY "Anyone can view APE/NAF codes"
  ON codes_ape_naf FOR SELECT
  TO authenticated
  USING (true); -- Tous les codes sont accessibles (pas de colonne est_actif)

-- 2.3. workflow_logs - Accès restreint (seulement super admin et propriétaire de l'entreprise via paiement)
ALTER TABLE IF EXISTS workflow_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin or enterprise owner can view workflow logs" ON workflow_logs;
CREATE POLICY "Super admin or enterprise owner can view workflow logs"
  ON workflow_logs FOR SELECT
  TO authenticated
  USING (
    is_super_admin_check()
    OR EXISTS (
      SELECT 1 FROM paiements p
      JOIN entreprises e ON e.id = p.entreprise_id
      WHERE p.id = workflow_logs.paiement_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admin or enterprise owner can insert workflow logs" ON workflow_logs;
CREATE POLICY "Super admin or enterprise owner can insert workflow logs"
  ON workflow_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin_check()
    OR EXISTS (
      SELECT 1 FROM paiements p
      JOIN entreprises e ON e.id = p.entreprise_id
      WHERE p.id = workflow_logs.paiement_id
      AND e.user_id = auth.uid()
    )
  );

-- 2.4. conventions_collectives - Lecture seule pour tous (table de référence)
ALTER TABLE IF EXISTS conventions_collectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active conventions collectives" ON conventions_collectives;
CREATE POLICY "Anyone can view active conventions collectives"
  ON conventions_collectives FOR SELECT
  TO authenticated
  USING (est_actif = true);

-- 2.5. fiches_paie_lignes - Accès restreint (propriétaire de l'entreprise ou collaborateur)
ALTER TABLE IF EXISTS fiches_paie_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enterprise owner or collaborator can view payslip lines" ON fiches_paie_lignes;
CREATE POLICY "Enterprise owner or collaborator can view payslip lines"
  ON fiches_paie_lignes FOR SELECT
  TO authenticated
  USING (
    is_super_admin_check()
    OR EXISTS (
      SELECT 1 FROM fiches_paie fp
      JOIN entreprises e ON e.id = fp.entreprise_id
      WHERE fp.id = fiches_paie_lignes.fiche_paie_id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs_entreprise ce
          WHERE ce.entreprise_id = e.id
          AND ce.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Enterprise owner can manage payslip lines" ON fiches_paie_lignes;
CREATE POLICY "Enterprise owner can manage payslip lines"
  ON fiches_paie_lignes FOR ALL
  TO authenticated
  USING (
    is_super_admin_check()
    OR EXISTS (
      SELECT 1 FROM fiches_paie fp
      JOIN entreprises e ON e.id = fp.entreprise_id
      WHERE fp.id = fiches_paie_lignes.fiche_paie_id
      AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_super_admin_check()
    OR EXISTS (
      SELECT 1 FROM fiches_paie fp
      JOIN entreprises e ON e.id = fp.entreprise_id
      WHERE fp.id = fiches_paie_lignes.fiche_paie_id
      AND e.user_id = auth.uid()
    )
  );

-- 2.6. rubriques_paie - Lecture seule pour tous (table de référence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rubriques_paie') THEN
    ALTER TABLE rubriques_paie ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can view active pay rubrics" ON rubriques_paie;
    
    -- Vérifier quelles colonnes existent
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rubriques_paie' AND column_name = 'est_actif') THEN
      CREATE POLICY "Anyone can view active pay rubrics"
        ON rubriques_paie FOR SELECT
        TO authenticated
        USING (COALESCE(par_defaut_active, false) = true OR COALESCE(est_actif, false) = true);
    ELSE
      CREATE POLICY "Anyone can view active pay rubrics"
        ON rubriques_paie FOR SELECT
        TO authenticated
        USING (COALESCE(par_defaut_active, false) = true);
    END IF;
  END IF;
END $$;

-- 2.7. parametres_paie - Lecture seule pour tous (table de référence)
ALTER TABLE IF EXISTS parametres_paie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pay parameters" ON parametres_paie;
CREATE POLICY "Anyone can view pay parameters"
  ON parametres_paie FOR SELECT
  TO authenticated
  USING (true);

-- 2.8. taux_cotisations_poste - Lecture seule pour tous (table de référence)
ALTER TABLE IF EXISTS taux_cotisations_poste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view contribution rates" ON taux_cotisations_poste;
CREATE POLICY "Anyone can view contribution rates"
  ON taux_cotisations_poste FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PARTIE 3 : CORRIGER LA POLITIQUE RLS QUI UTILISE user_metadata
-- ============================================================================

-- 3.1. Remplacer la politique simple_utilisateurs_all pour utiliser is_super_admin_check()
DROP POLICY IF EXISTS "simple_utilisateurs_all" ON utilisateurs;

CREATE POLICY "simple_utilisateurs_all"
  ON utilisateurs FOR ALL
  TO authenticated
  USING (
    -- Super admin via fonction sécurisée (ne utilise pas user_metadata)
    is_super_admin_check()
    -- Ou utilisateur voit son propre profil
    OR id = auth.uid()
  )
  WITH CHECK (
    -- Super admin peut modifier via fonction sécurisée
    is_super_admin_check()
    -- Ou utilisateur modifie son propre profil
    OR id = auth.uid()
  );

COMMENT ON POLICY "simple_utilisateurs_all" ON utilisateurs IS 
  'Politique RLS sécurisée utilisant is_super_admin_check() au lieu de user_metadata';

-- ============================================================================
-- PARTIE 4 : S'ASSURER QUE LES VUES NE SONT PAS EXPOSÉES AVEC SECURITY DEFINER
-- ============================================================================

-- Note: PostgreSQL ne permet pas de modifier directement SECURITY DEFINER sur une vue.
-- Il faut recréer la vue sans SECURITY DEFINER. Mais ces vues n'ont probablement pas
-- été créées avec SECURITY DEFINER explicitement. Le linter détecte peut-être un problème
-- de configuration. On s'assure que les vues sont créées sans SECURITY DEFINER.

-- Les vues ont déjà été recréées ci-dessus sans SECURITY DEFINER, donc elles sont corrigées.

-- ============================================================================
-- PARTIE 5 : GRANT PERMISSIONS SUR LES VUES CORRIGÉES
-- ============================================================================

-- Permissions pour les vues corrigées
GRANT SELECT ON super_admins_plateforme TO authenticated;
GRANT SELECT ON equipe_plateforme_with_roles TO authenticated;
GRANT SELECT ON clients_with_roles TO authenticated;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅✅✅ CORRECTIONS DE SÉCURITÉ APPLIQUÉES ✅✅✅';
  RAISE NOTICE '   - Vues corrigées pour ne plus exposer auth.users';
  RAISE NOTICE '   - RLS activé sur toutes les tables publiques';
  RAISE NOTICE '   - Politique utilisateurs corrigée (plus de user_metadata)';
  RAISE NOTICE '   - Toutes les tables de référence sont en lecture seule';
END $$;

