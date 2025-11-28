/*
  # Système de Dépendances entre Modules
  
  Ce système permet de définir quels modules réutilisent d'autres modules existants.
  Par exemple :
  - Gestion de Projets → utilise Gestion d'Équipe (existant)
  - Gestion de Stock → utilise Gestion de Documents (existant)
  - CRM Avancé → utilise Gestion des Clients (existant)
  - Time Tracking → utilise Collaborateurs (existant)
  
  Cela évite de recréer des fonctionnalités déjà existantes.
*/

-- 1. Créer table pour les dépendances entre modules
CREATE TABLE IF NOT EXISTS modules_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL REFERENCES modules_activation(module_code) ON DELETE CASCADE,
  module_depend_de text NOT NULL REFERENCES modules_activation(module_code) ON DELETE CASCADE,
  type_dependance text NOT NULL CHECK (type_dependance IN (
    'requis', -- Module requis (obligatoire)
    'optionnel', -- Module optionnel (peut être désactivé)
    'reutilise' -- Module réutilise les fonctionnalités
  )),
  description text,
  configuration jsonb DEFAULT '{}'::jsonb, -- Configuration spécifique de la réutilisation
  created_at timestamptz DEFAULT now(),
  UNIQUE(module_code, module_depend_de)
);

-- Index pour améliorer les recherches
CREATE INDEX IF NOT EXISTS idx_modules_dependencies_module ON modules_dependencies(module_code);
CREATE INDEX IF NOT EXISTS idx_modules_dependencies_depend_de ON modules_dependencies(module_depend_de);
CREATE INDEX IF NOT EXISTS idx_modules_dependencies_type ON modules_dependencies(type_dependance);

-- 2. Activer RLS
ALTER TABLE modules_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS : Lecture pour tous, modification pour super admin
CREATE POLICY "Tous peuvent voir les dépendances"
  ON modules_dependencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin peut gérer les dépendances"
  ON modules_dependencies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 3. Fonction pour obtenir les dépendances d'un module
CREATE OR REPLACE FUNCTION get_module_dependencies(
  p_module_code text
)
RETURNS TABLE (
  module_depend_de text,
  module_nom text,
  type_dependance text,
  description text,
  actif boolean,
  est_cree boolean,
  configuration jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.module_depend_de,
    m.module_nom,
    md.type_dependance,
    md.description,
    m.actif,
    m.est_cree,
    md.configuration
  FROM modules_dependencies md
  JOIN modules_activation m ON m.module_code = md.module_depend_de
  WHERE md.module_code = p_module_code
  ORDER BY 
    CASE md.type_dependance 
      WHEN 'requis' THEN 1
      WHEN 'reutilise' THEN 2
      WHEN 'optionnel' THEN 3
    END,
    m.module_nom;
END;
$$;

-- 4. Fonction pour vérifier si un module peut être activé (vérifie les dépendances requises)
CREATE OR REPLACE FUNCTION can_activate_module(
  p_module_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_deps_missing text[];
  v_deps_inactive text[];
  v_dep RECORD;
BEGIN
  -- Récupérer les dépendances requises
  FOR v_dep IN
    SELECT module_depend_de, module_nom, actif, est_cree
    FROM modules_dependencies md
    JOIN modules_activation m ON m.module_code = md.module_depend_de
    WHERE md.module_code = p_module_code
    AND md.type_dependance = 'requis'
  LOOP
    -- Vérifier si la dépendance existe et est créée
    IF v_dep.est_cree = false THEN
      v_deps_missing := array_append(v_deps_missing, v_dep.module_nom || ' (non créé)');
    ELSIF v_dep.actif = false THEN
      v_deps_inactive := array_append(v_deps_inactive, v_dep.module_nom || ' (inactif)');
    END IF;
  END LOOP;

  -- Construire la réponse
  IF array_length(v_deps_missing, 1) IS NULL AND array_length(v_deps_inactive, 1) IS NULL THEN
    v_result := jsonb_build_object(
      'can_activate', true,
      'message', 'Module peut être activé'
    );
  ELSE
    v_result := jsonb_build_object(
      'can_activate', false,
      'message', 'Module ne peut pas être activé : dépendances manquantes ou inactives',
      'missing', v_deps_missing,
      'inactive', v_deps_inactive
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 5. Insérer les dépendances pour les modules de Phase 1

-- Gestion de Projets → utilise Gestion d'Équipe (réutilise)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-projets',
  'gestion-equipe',
  'reutilise',
  'Utilise le module Gestion d''Équipe pour assigner des équipes aux projets',
  '{"use_teams": true, "assign_teams_to_projects": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Gestion de Projets → utilise Collaborateurs (réutilise)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-projets',
  'collaborateurs',
  'reutilise',
  'Utilise le module Collaborateurs pour assigner des collaborateurs aux projets',
  '{"use_collaborators": true, "assign_to_tasks": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Gestion de Projets → utilise Documents (optionnel)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-projets',
  'documents',
  'optionnel',
  'Peut utiliser le module Documents pour stocker les fichiers liés aux projets',
  '{"link_documents": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Gestion de Stock → utilise Documents (réutilise)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-stock',
  'documents',
  'reutilise',
  'Utilise le module Documents pour stocker les fiches produits, images, etc.',
  '{"store_product_sheets": true, "product_images": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Gestion de Stock → utilise Facturation (optionnel)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-stock',
  'facturation',
  'optionnel',
  'Peut utiliser le module Facturation pour facturer les mouvements de stock',
  '{"auto_invoice": false}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- CRM Avancé → utilise Clients (réutilise)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'crm-avance',
  'clients',
  'reutilise',
  'Utilise le module Clients existant comme base pour le CRM avancé',
  '{"extends_clients": true, "add_pipeline": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- CRM Avancé → utilise Documents (optionnel)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'crm-avance',
  'documents',
  'optionnel',
  'Peut utiliser le module Documents pour stocker les documents commerciaux',
  '{"store_commercial_docs": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Time Tracking → utilise Collaborateurs (requis)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'time-tracking',
  'collaborateurs',
  'requis',
  'Le module Time Tracking nécessite le module Collaborateurs pour fonctionner',
  '{"require_collaborators": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Time Tracking → utilise Facturation (optionnel)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'time-tracking',
  'facturation',
  'optionnel',
  'Peut utiliser le module Facturation pour facturer automatiquement les heures',
  '{"auto_invoice_hours": false}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Gestion de Budget → utilise Facturation (requis)
INSERT INTO modules_dependencies (module_code, module_depend_de, type_dependance, description, configuration)
VALUES (
  'gestion-budget',
  'facturation',
  'requis',
  'Le module Gestion de Budget nécessite le module Facturation pour analyser les revenus',
  '{"require_invoicing": true, "analyze_revenues": true}'::jsonb
) ON CONFLICT (module_code, module_depend_de) DO UPDATE SET
  type_dependance = EXCLUDED.type_dependance,
  description = EXCLUDED.description,
  configuration = EXCLUDED.configuration;

-- Commentaires pour documentation
COMMENT ON TABLE modules_dependencies IS 'Dépendances entre modules - définit quels modules réutilisent d''autres modules existants';
COMMENT ON COLUMN modules_dependencies.type_dependance IS 'Type de dépendance: requis (obligatoire), optionnel, ou reutilise (réutilise les fonctionnalités)';
COMMENT ON COLUMN modules_dependencies.configuration IS 'Configuration JSON spécifique de la réutilisation (ex: quelles fonctionnalités utiliser)';
COMMENT ON FUNCTION get_module_dependencies IS 'Retourne toutes les dépendances d''un module';
COMMENT ON FUNCTION can_activate_module IS 'Vérifie si un module peut être activé en fonction de ses dépendances requises';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Système de dépendances entre modules créé';
  RAISE NOTICE '✅ Dépendances Phase 1 configurées :';
  RAISE NOTICE '   - Gestion de Projets → Gestion d''Équipe, Collaborateurs, Documents';
  RAISE NOTICE '   - Gestion de Stock → Documents, Facturation';
  RAISE NOTICE '   - CRM Avancé → Clients, Documents';
  RAISE NOTICE '   - Time Tracking → Collaborateurs (requis), Facturation';
  RAISE NOTICE '   - Gestion de Budget → Facturation (requis)';
END $$;




