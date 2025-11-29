/*
  # Module CRM Avancé
  
  Ce module permet de gérer le pipeline commercial et les opportunités :
  - Pipeline commercial avec étapes personnalisables
  - Opportunités (deals) liées aux clients
  - Activités (appels, emails, réunions, tâches)
  - Email marketing et campagnes
  - Suivi des interactions avec les clients
  - Statistiques et reporting
  
  RÉUTILISE :
  - Clients (existant) - Les opportunités sont liées aux clients
  - Documents (optionnel, pour stocker les documents commerciaux)
  - Factures (optionnel, pour lier les opportunités gagnées aux factures)
*/

-- 1. Supprimer les tables si elles existent déjà (pour permettre la recréation)
DROP TABLE IF EXISTS crm_activites CASCADE;
DROP TABLE IF EXISTS crm_opportunites CASCADE;
DROP TABLE IF EXISTS crm_pipeline_etapes CASCADE;
DROP TABLE IF EXISTS crm_campagnes_email CASCADE;
DROP TABLE IF EXISTS crm_contacts_email CASCADE;

-- 2. Table des étapes du pipeline commercial
CREATE TABLE crm_pipeline_etapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  couleur text DEFAULT '#3B82F6',
  ordre integer NOT NULL DEFAULT 0,
  probabilite integer DEFAULT 0 CHECK (probabilite >= 0 AND probabilite <= 100), -- Probabilité de succès en %
  est_etape_finale boolean DEFAULT false, -- Si true, c'est une étape de clôture (gagné/perdu)
  type_etape text DEFAULT 'en_cours' CHECK (type_etape IN ('en_cours', 'gagne', 'perdu')),
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, nom)
);

-- Index pour pipeline_etapes
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_etapes_entreprise_id ON crm_pipeline_etapes(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipeline_etapes_ordre ON crm_pipeline_etapes(entreprise_id, ordre);

-- 3. Table des opportunités (deals)
CREATE TABLE crm_opportunites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL, -- Client associé
  nom text NOT NULL,
  description text,
  montant_estime numeric(12, 2) DEFAULT 0,
  devise text DEFAULT 'EUR',
  etape_id uuid REFERENCES crm_pipeline_etapes(id) ON DELETE SET NULL,
  probabilite integer DEFAULT 50 CHECK (probabilite >= 0 AND probabilite <= 100),
  date_fermeture_prevue date,
  date_fermeture_reelle date,
  statut text DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'gagnee', 'perdue', 'annulee')),
  source text, -- Comment l'opportunité a été obtenue (site web, recommandation, etc.)
  responsable_id uuid, -- ID de l'utilisateur responsable (peut être un collaborateur)
  notes text,
  tags text[],
  custom_fields jsonb, -- Champs personnalisés selon les besoins
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour opportunités
CREATE INDEX IF NOT EXISTS idx_crm_opportunites_entreprise_id ON crm_opportunites(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunites_client_id ON crm_opportunites(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunites_etape_id ON crm_opportunites(etape_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunites_statut ON crm_opportunites(entreprise_id, statut);
CREATE INDEX IF NOT EXISTS idx_crm_opportunites_date_fermeture ON crm_opportunites(date_fermeture_prevue);

-- 4. Table des activités (appels, emails, réunions, tâches)
CREATE TABLE crm_activites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  opportunite_id uuid REFERENCES crm_opportunites(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  type_activite text NOT NULL CHECK (type_activite IN ('appel', 'email', 'reunion', 'tache', 'note', 'autre')),
  sujet text NOT NULL,
  description text,
  date_activite timestamptz NOT NULL,
  duree_minutes integer, -- Durée en minutes (pour appels, réunions)
  statut text DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'en_cours', 'terminee', 'annulee')),
  priorite text DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
  responsable_id uuid, -- ID de l'utilisateur responsable
  resultat text, -- Résultat de l'activité (pour appels, réunions)
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour activités
CREATE INDEX IF NOT EXISTS idx_crm_activites_entreprise_id ON crm_activites(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_crm_activites_opportunite_id ON crm_activites(opportunite_id);
CREATE INDEX IF NOT EXISTS idx_crm_activites_client_id ON crm_activites(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_activites_date_activite ON crm_activites(date_activite);
CREATE INDEX IF NOT EXISTS idx_crm_activites_statut ON crm_activites(entreprise_id, statut);

-- 5. Table des campagnes email
CREATE TABLE crm_campagnes_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  objet_email text NOT NULL,
  contenu_email text NOT NULL, -- HTML ou texte
  type_contenu text DEFAULT 'html' CHECK (type_contenu IN ('html', 'texte')),
  statut text DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'planifiee', 'en_cours', 'terminee', 'annulee')),
  date_envoi_prevue timestamptz,
  date_envoi_reelle timestamptz,
  nombre_destinataires integer DEFAULT 0,
  nombre_envoyes integer DEFAULT 0,
  nombre_ouverts integer DEFAULT 0,
  nombre_clics integer DEFAULT 0,
  nombre_reponses integer DEFAULT 0,
  taux_ouverture numeric(5, 2) DEFAULT 0, -- En %
  taux_clic numeric(5, 2) DEFAULT 0, -- En %
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour campagnes email
CREATE INDEX IF NOT EXISTS idx_crm_campagnes_email_entreprise_id ON crm_campagnes_email(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_crm_campagnes_email_statut ON crm_campagnes_email(entreprise_id, statut);

-- 6. Table des contacts email (destinataires des campagnes)
CREATE TABLE crm_contacts_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  campagne_id uuid NOT NULL REFERENCES crm_campagnes_email(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  email text NOT NULL,
  nom text,
  prenom text,
  statut_envoi text DEFAULT 'en_attente' CHECK (statut_envoi IN ('en_attente', 'envoye', 'ouvert', 'clique', 'erreur', 'desinscrit')),
  date_envoi timestamptz,
  date_ouverture timestamptz,
  date_clic timestamptz,
  nombre_ouvertures integer DEFAULT 0,
  nombre_clics integer DEFAULT 0,
  erreur_envoi text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campagne_id, email)
);

-- Index pour contacts email
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_entreprise_id ON crm_contacts_email(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_campagne_id ON crm_contacts_email(campagne_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_client_id ON crm_contacts_email(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_statut ON crm_contacts_email(statut_envoi);

-- 7. Activer RLS sur toutes les tables
ALTER TABLE crm_pipeline_etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activites ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campagnes_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts_email ENABLE ROW LEVEL SECURITY;

-- 8. Politiques RLS pour crm_pipeline_etapes
CREATE POLICY "Utilisateurs peuvent voir les étapes de leur entreprise"
  ON crm_pipeline_etapes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent créer des étapes pour leur entreprise"
  ON crm_pipeline_etapes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent modifier les étapes de leur entreprise"
  ON crm_pipeline_etapes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent supprimer les étapes de leur entreprise"
  ON crm_pipeline_etapes FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 9. Politiques RLS pour crm_opportunites
CREATE POLICY "Utilisateurs peuvent voir les opportunités de leur entreprise"
  ON crm_opportunites FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent créer des opportunités pour leur entreprise"
  ON crm_opportunites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent modifier les opportunités de leur entreprise"
  ON crm_opportunites FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent supprimer les opportunités de leur entreprise"
  ON crm_opportunites FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 10. Politiques RLS pour crm_activites
CREATE POLICY "Utilisateurs peuvent voir les activités de leur entreprise"
  ON crm_activites FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent créer des activités pour leur entreprise"
  ON crm_activites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent modifier les activités de leur entreprise"
  ON crm_activites FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent supprimer les activités de leur entreprise"
  ON crm_activites FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 11. Politiques RLS pour crm_campagnes_email
CREATE POLICY "Utilisateurs peuvent voir les campagnes de leur entreprise"
  ON crm_campagnes_email FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent créer des campagnes pour leur entreprise"
  ON crm_campagnes_email FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent modifier les campagnes de leur entreprise"
  ON crm_campagnes_email FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent supprimer les campagnes de leur entreprise"
  ON crm_campagnes_email FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 12. Politiques RLS pour crm_contacts_email
CREATE POLICY "Utilisateurs peuvent voir les contacts email de leur entreprise"
  ON crm_contacts_email FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent créer des contacts email pour leur entreprise"
  ON crm_contacts_email FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent modifier les contacts email de leur entreprise"
  ON crm_contacts_email FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Utilisateurs peuvent supprimer les contacts email de leur entreprise"
  ON crm_contacts_email FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 13. Fonction RPC pour obtenir les statistiques du pipeline
CREATE OR REPLACE FUNCTION get_crm_pipeline_stats(
  p_entreprise_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_opportunites', COUNT(*) FILTER (WHERE statut = 'ouverte'),
    'opportunites_gagnees', COUNT(*) FILTER (WHERE statut = 'gagnee'),
    'opportunites_perdues', COUNT(*) FILTER (WHERE statut = 'perdue'),
    'montant_total_ouvert', COALESCE(SUM(montant_estime) FILTER (WHERE statut = 'ouverte'), 0),
    'montant_total_gagne', COALESCE(SUM(montant_estime) FILTER (WHERE statut = 'gagnee'), 0),
    'taux_reussite', CASE 
      WHEN COUNT(*) FILTER (WHERE statut IN ('gagnee', 'perdue')) > 0 
      THEN ROUND(
        100.0 * COUNT(*) FILTER (WHERE statut = 'gagnee')::numeric / 
        COUNT(*) FILTER (WHERE statut IN ('gagnee', 'perdue'))::numeric, 
        2
      )
      ELSE 0 
    END
  ) INTO v_stats
  FROM crm_opportunites
  WHERE entreprise_id = p_entreprise_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Fonction RPC pour obtenir les opportunités par étape
CREATE OR REPLACE FUNCTION get_crm_opportunites_by_etape(
  p_entreprise_id uuid,
  p_etape_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  nom text,
  client_id uuid,
  client_nom text,
  montant_estime numeric,
  probabilite integer,
  date_fermeture_prevue date,
  etape_id uuid,
  etape_nom text,
  statut text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.nom,
    o.client_id,
    COALESCE(c.nom || ' ' || c.prenom, c.entreprise_nom, 'Client inconnu') as client_nom,
    o.montant_estime,
    o.probabilite,
    o.date_fermeture_prevue,
    o.etape_id,
    e.nom as etape_nom,
    o.statut,
    o.created_at
  FROM crm_opportunites o
  LEFT JOIN clients c ON c.id = o.client_id
  LEFT JOIN crm_pipeline_etapes e ON e.id = o.etape_id
  WHERE o.entreprise_id = p_entreprise_id
    AND o.statut = 'ouverte'
    AND (p_etape_id IS NULL OR o.etape_id = p_etape_id)
  ORDER BY e.ordre, o.date_fermeture_prevue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Ajouter le module dans modules_activation
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  actif,
  est_cree,
  priorite,
  icone
) VALUES (
  'crm-avance',
  'CRM Avancé',
  'Pipeline commercial, opportunités, activités et email marketing',
  'premium',
  'transversal',
  true,
  true,
  3,
  'TrendingUp'
) ON CONFLICT (module_code) DO UPDATE SET
  est_cree = true,
  actif = true,
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  priorite = EXCLUDED.priorite;

-- 16. Activer le module dans les plans d'abonnement appropriés
DO $$
DECLARE
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  -- PLAN PROFESSIONAL : Ajouter crm-avance
  IF v_professional_plan_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_modules') THEN
      INSERT INTO plans_modules (plan_id, module_code, inclus, prix_mensuel, prix_annuel)
      VALUES (v_professional_plan_id, 'crm-avance', true, 0, 0)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        inclus = true,
        prix_mensuel = 0,
        prix_annuel = 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_modules') THEN
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      VALUES (v_professional_plan_id, 'crm-avance', 'CRM Avancé', true)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        activer = true,
        module_nom = EXCLUDED.module_nom;
    END IF;
  END IF;
  
  -- PLAN ENTERPRISE : Ajouter crm-avance
  IF v_enterprise_plan_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_modules') THEN
      INSERT INTO plans_modules (plan_id, module_code, inclus, prix_mensuel, prix_annuel)
      VALUES (v_enterprise_plan_id, 'crm-avance', true, 0, 0)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        inclus = true,
        prix_mensuel = 0,
        prix_annuel = 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_modules') THEN
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      VALUES (v_enterprise_plan_id, 'crm-avance', 'CRM Avancé', true)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        activer = true,
        module_nom = EXCLUDED.module_nom;
    END IF;
  END IF;
END $$;

-- 17. Synchroniser les modules pour les clients existants ayant les plans Professional ou Enterprise
DO $$
DECLARE
  v_abonnement_record RECORD;
  v_espace_record RECORD;
BEGIN
  FOR v_abonnement_record IN
    SELECT a.id, a.plan_id, a.entreprise_id, a.client_id
    FROM abonnements a
    JOIN plans_abonnement p ON a.plan_id = p.id
    WHERE p.nom IN ('Professional', 'Enterprise')
      AND a.statut = 'actif'
  LOOP
    FOR v_espace_record IN
      SELECT id, modules_actifs
      FROM espaces_membres_clients
      WHERE entreprise_id = v_abonnement_record.entreprise_id
        AND client_id = v_abonnement_record.client_id
    LOOP
      UPDATE espaces_membres_clients
      SET modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) 
        || jsonb_build_object('crm-avance', true)
        || jsonb_build_object('crm_avance', true),
        updated_at = NOW()
      WHERE id = v_espace_record.id;
    END LOOP;
  END LOOP;
END $$;

-- 18. Commentaires pour documentation
COMMENT ON TABLE crm_pipeline_etapes IS 'Étapes du pipeline commercial (prospection, négociation, etc.)';
COMMENT ON TABLE crm_opportunites IS 'Opportunités commerciales (deals) liées aux clients';
COMMENT ON TABLE crm_activites IS 'Activités commerciales (appels, emails, réunions, tâches)';
COMMENT ON TABLE crm_campagnes_email IS 'Campagnes email marketing';
COMMENT ON TABLE crm_contacts_email IS 'Destinataires des campagnes email';
COMMENT ON FUNCTION get_crm_pipeline_stats IS 'Retourne les statistiques du pipeline commercial';
COMMENT ON FUNCTION get_crm_opportunites_by_etape IS 'Retourne les opportunités filtrées par étape du pipeline';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration CRM Avancé appliquée avec succès !' as status;

