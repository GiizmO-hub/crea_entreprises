/*
  # Module Gestion de Projets
  
  Ce module permet de gérer les projets avec :
  - Création et suivi de projets
  - Jalons et deadlines
  - Planning et calendrier
  - Ressources allouées (équipes, collaborateurs)
  - Budget et coûts réels
  
  RÉUTILISE :
  - Gestion d'Équipe (pour assigner des équipes aux projets)
  - Collaborateurs (pour assigner des collaborateurs aux tâches)
  - Documents (optionnel, pour stocker les fichiers liés aux projets)
*/

-- 1. Supprimer les tables si elles existent déjà (pour permettre la recréation)
DROP TABLE IF EXISTS projets_documents CASCADE;
DROP TABLE IF EXISTS projets_taches CASCADE;
DROP TABLE IF EXISTS projets_jalons CASCADE;
DROP TABLE IF EXISTS projets CASCADE;

-- 2. Table des projets
CREATE TABLE projets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL, -- Réutilise la table clients existante
  responsable_id uuid REFERENCES collaborateurs(id) ON DELETE SET NULL, -- Réutilise collaborateurs
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL, -- Réutilise la table equipes existante
  date_debut date,
  date_fin_prevue date,
  date_fin_reelle date,
  budget_previstoire numeric(12, 2) DEFAULT 0,
  budget_reel numeric(12, 2) DEFAULT 0,
  statut text NOT NULL DEFAULT 'planifie' CHECK (statut IN (
    'planifie',
    'en_cours',
    'en_pause',
    'termine',
    'annule'
  )),
  priorite text DEFAULT 'moyenne' CHECK (priorite IN ('basse', 'moyenne', 'haute', 'urgente')),
  couleur text DEFAULT '#3B82F6', -- Couleur pour l'affichage
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_projets_entreprise_id ON projets(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_projets_client_id ON projets(client_id);
CREATE INDEX IF NOT EXISTS idx_projets_responsable_id ON projets(responsable_id);
CREATE INDEX IF NOT EXISTS idx_projets_equipe_id ON projets(equipe_id);
CREATE INDEX IF NOT EXISTS idx_projets_statut ON projets(statut);
CREATE INDEX IF NOT EXISTS idx_projets_date_debut ON projets(date_debut);
CREATE INDEX IF NOT EXISTS idx_projets_date_fin_prevue ON projets(date_fin_prevue);

-- 3. Table des jalons (milestones)
CREATE TABLE projets_jalons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id uuid NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  date_prevue date NOT NULL,
  date_reelle date,
  statut text NOT NULL DEFAULT 'a_venir' CHECK (statut IN ('a_venir', 'en_cours', 'termine', 'retarde', 'annule')),
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projets_jalons_projet_id ON projets_jalons(projet_id);
CREATE INDEX IF NOT EXISTS idx_projets_jalons_date_prevue ON projets_jalons(date_prevue);
CREATE INDEX IF NOT EXISTS idx_projets_jalons_statut ON projets_jalons(statut);

-- 4. Table des tâches
CREATE TABLE projets_taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id uuid NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  jalon_id uuid REFERENCES projets_jalons(id) ON DELETE SET NULL,
  nom text NOT NULL,
  description text,
  collaborateur_id uuid REFERENCES collaborateurs(id) ON DELETE SET NULL, -- Réutilise collaborateurs
  equipe_id uuid REFERENCES equipes(id) ON DELETE SET NULL, -- Réutilise equipes
  date_debut_prevue date,
  date_fin_prevue date NOT NULL,
  date_debut_reelle date,
  date_fin_reelle date,
  duree_estimee_heures numeric(8, 2) DEFAULT 0,
  duree_reelle_heures numeric(8, 2) DEFAULT 0,
  statut text NOT NULL DEFAULT 'a_faire' CHECK (statut IN (
    'a_faire',
    'en_cours',
    'en_revision',
    'termine',
    'bloque',
    'annule'
  )),
  priorite text DEFAULT 'moyenne' CHECK (priorite IN ('basse', 'moyenne', 'haute', 'urgente')),
  ordre integer DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projets_taches_projet_id ON projets_taches(projet_id);
CREATE INDEX IF NOT EXISTS idx_projets_taches_jalon_id ON projets_taches(jalon_id);
CREATE INDEX IF NOT EXISTS idx_projets_taches_collaborateur_id ON projets_taches(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_projets_taches_equipe_id ON projets_taches(equipe_id);
CREATE INDEX IF NOT EXISTS idx_projets_taches_statut ON projets_taches(statut);
CREATE INDEX IF NOT EXISTS idx_projets_taches_date_fin_prevue ON projets_taches(date_fin_prevue);

-- 5. Table de liaison projets-documents (réutilise la table documents existante)
CREATE TABLE projets_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id uuid NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE, -- Réutilise documents
  type_lien text DEFAULT 'general' CHECK (type_lien IN ('general', 'specification', 'rapport', 'contrat', 'autre')),
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(projet_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_projets_documents_projet_id ON projets_documents(projet_id);
CREATE INDEX IF NOT EXISTS idx_projets_documents_document_id ON projets_documents(document_id);

-- 5. Activer RLS sur toutes les tables
ALTER TABLE projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets_jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets_taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets_documents ENABLE ROW LEVEL SECURITY;

-- RLS pour projets : Les utilisateurs voient les projets de leur entreprise
CREATE POLICY "Utilisateurs voient les projets de leur entreprise"
  ON projets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent créer des projets pour leur entreprise"
  ON projets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent modifier les projets de leur entreprise"
  ON projets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent supprimer les projets de leur entreprise"
  ON projets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = projets.entreprise_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- RLS pour projets_jalons (même logique que projets)
CREATE POLICY "Utilisateurs voient les jalons des projets de leur entreprise"
  ON projets_jalons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_jalons.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent gérer les jalons des projets de leur entreprise"
  ON projets_jalons FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_jalons.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- RLS pour projets_taches (même logique)
CREATE POLICY "Utilisateurs voient les tâches des projets de leur entreprise"
  ON projets_taches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_taches.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
        )
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.id = projets_taches.collaborateur_id
          AND collaborateurs.user_id = auth.uid()
        ) -- Le collaborateur assigné peut voir sa tâche
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent gérer les tâches des projets de leur entreprise"
  ON projets_taches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_taches.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.id = projets_taches.collaborateur_id
          AND collaborateurs.user_id = auth.uid()
        ) -- Le collaborateur peut modifier sa tâche
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- RLS pour projets_documents (même logique)
CREATE POLICY "Utilisateurs voient les documents des projets de leur entreprise"
  ON projets_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_documents.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent gérer les documents des projets de leur entreprise"
  ON projets_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projets
      JOIN entreprises ON entreprises.id = projets.entreprise_id
      WHERE projets.id = projets_documents.projet_id
      AND (
        entreprises.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collaborateurs
          WHERE collaborateurs.user_id = auth.uid()
          AND collaborateurs.entreprise_id = entreprises.id
          AND collaborateurs.role IN ('admin', 'manager')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 6. Triggers pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_projets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projets_updated_at
  BEFORE UPDATE ON projets
  FOR EACH ROW
  EXECUTE FUNCTION update_projets_updated_at();

CREATE TRIGGER update_projets_jalons_updated_at
  BEFORE UPDATE ON projets_jalons
  FOR EACH ROW
  EXECUTE FUNCTION update_projets_updated_at();

CREATE TRIGGER update_projets_taches_updated_at
  BEFORE UPDATE ON projets_taches
  FOR EACH ROW
  EXECUTE FUNCTION update_projets_updated_at();

-- 7. Fonction pour obtenir les statistiques d'un projet
CREATE OR REPLACE FUNCTION get_projet_stats(p_projet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_taches', COUNT(*) FILTER (WHERE statut IS NOT NULL),
    'taches_terminees', COUNT(*) FILTER (WHERE statut = 'termine'),
    'taches_en_cours', COUNT(*) FILTER (WHERE statut = 'en_cours'),
    'taches_a_faire', COUNT(*) FILTER (WHERE statut = 'a_faire'),
    'total_heures_estimees', COALESCE(SUM(duree_estimee_heures), 0),
    'total_heures_reelles', COALESCE(SUM(duree_reelle_heures), 0),
    'total_jalons', (
      SELECT COUNT(*) FROM projets_jalons WHERE projet_id = p_projet_id
    ),
    'jalons_termines', (
      SELECT COUNT(*) FROM projets_jalons 
      WHERE projet_id = p_projet_id AND statut = 'termine'
    ),
    'avancement_pct', CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE statut = 'termine')::numeric / COUNT(*)::numeric * 100)
      ELSE 0
    END
  ) INTO v_result
  FROM projets_taches
  WHERE projet_id = p_projet_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 8. Commentaires pour documentation
COMMENT ON TABLE projets IS 'Table des projets - Réutilise clients, collaborateurs, equipes';
COMMENT ON TABLE projets_jalons IS 'Jalons/milestones des projets';
COMMENT ON TABLE projets_taches IS 'Tâches des projets - Réutilise collaborateurs et equipes';
COMMENT ON TABLE projets_documents IS 'Liaison projets-documents - Réutilise la table documents';
COMMENT ON FUNCTION get_projet_stats IS 'Retourne les statistiques d''un projet (tâches, jalons, heures, avancement)';

-- 9. Mettre à jour le statut est_cree du module
UPDATE modules_activation
SET est_cree = true
WHERE module_code = 'gestion-projets';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Module Gestion de Projets créé :';
  RAISE NOTICE '   - Table projets créée';
  RAISE NOTICE '   - Table projets_jalons créée';
  RAISE NOTICE '   - Table projets_taches créée';
  RAISE NOTICE '   - Table projets_documents créée (réutilise documents)';
  RAISE NOTICE '   - RLS configuré pour toutes les tables';
  RAISE NOTICE '   - Fonction get_projet_stats créée';
  RAISE NOTICE '   - Module marqué comme créé (est_cree = true)';
  RAISE NOTICE '   ✅ Réutilise : clients, collaborateurs, equipes, documents';
END $$;

