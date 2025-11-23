/*
  # Phase 1 : Modules Transversaux
  
  Insertion des 5 modules transversaux selon la priorisation :
  1. Gestion de Projets (priorité 1)
  2. Gestion de Stock Générique (priorité 2)
  3. CRM Avancé (priorité 3)
  4. Time Tracking / Pointage (priorité 4)
  5. Gestion de Budget (priorité 5)
  
  Ces modules sont utiles pour TOUS les secteurs et seront créés en premier.
*/

-- 1. Gestion de Projets (priorité 1)
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  priorite,
  actif,
  est_cree,
  icone,
  route
) VALUES (
  'gestion-projets',
  'Gestion de Projets',
  'Création et suivi de projets, jalons, planning, ressources, budget et coûts réels',
  'option',
  'transversal',
  1,
  false, -- Inactif par défaut (sera activé par le super admin)
  false, -- Pas encore créé dans le code
  'Briefcase',
  'gestion-projets'
) ON CONFLICT (module_code) DO UPDATE SET
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  secteur_activite = EXCLUDED.secteur_activite,
  priorite = EXCLUDED.priorite,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route;

-- Lier à la table modules_metier
INSERT INTO modules_metier (
  module_code,
  secteur_activite,
  priorite,
  est_essentiel
) VALUES (
  'gestion-projets',
  'transversal',
  1,
  false
) ON CONFLICT (module_code, secteur_activite) DO UPDATE SET
  priorite = EXCLUDED.priorite;

-- 2. Gestion de Stock Générique (priorité 2)
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  priorite,
  actif,
  est_cree,
  icone,
  route
) VALUES (
  'gestion-stock',
  'Gestion de Stock Générique',
  'Catalogue, stock multi-entrepôts, inventaire, mouvements, réapprovisionnement automatique, valeur de stock',
  'option',
  'transversal',
  2,
  false,
  false,
  'Package',
  'gestion-stock'
) ON CONFLICT (module_code) DO UPDATE SET
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  secteur_activite = EXCLUDED.secteur_activite,
  priorite = EXCLUDED.priorite,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route;

INSERT INTO modules_metier (
  module_code,
  secteur_activite,
  priorite,
  est_essentiel
) VALUES (
  'gestion-stock',
  'transversal',
  2,
  false
) ON CONFLICT (module_code, secteur_activite) DO UPDATE SET
  priorite = EXCLUDED.priorite;

-- 3. CRM Avancé (priorité 3)
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  priorite,
  actif,
  est_cree,
  icone,
  route
) VALUES (
  'crm-avance',
  'CRM Avancé',
  'Pipeline commercial, opportunités, activités, email marketing, statistiques, segmentation clients',
  'option',
  'transversal',
  3,
  false,
  false,
  'TrendingUp',
  'crm-avance'
) ON CONFLICT (module_code) DO UPDATE SET
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  secteur_activite = EXCLUDED.secteur_activite,
  priorite = EXCLUDED.priorite,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route;

INSERT INTO modules_metier (
  module_code,
  secteur_activite,
  priorite,
  est_essentiel
) VALUES (
  'crm-avance',
  'transversal',
  3,
  false
) ON CONFLICT (module_code, secteur_activite) DO UPDATE SET
  priorite = EXCLUDED.priorite;

-- 4. Time Tracking / Pointage (priorité 4)
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  priorite,
  actif,
  est_cree,
  icone,
  route
) VALUES (
  'time-tracking',
  'Time Tracking / Pointage',
  'Saisie des heures, validation hiérarchique, export pour facturation, tableaux de bord temps, suivi des performances',
  'option',
  'transversal',
  4,
  false,
  false,
  'Clock',
  'time-tracking'
) ON CONFLICT (module_code) DO UPDATE SET
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  secteur_activite = EXCLUDED.secteur_activite,
  priorite = EXCLUDED.priorite,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route;

INSERT INTO modules_metier (
  module_code,
  secteur_activite,
  priorite,
  est_essentiel
) VALUES (
  'time-tracking',
  'transversal',
  4,
  false
) ON CONFLICT (module_code, secteur_activite) DO UPDATE SET
  priorite = EXCLUDED.priorite;

-- 5. Gestion de Budget (priorité 5)
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  priorite,
  actif,
  est_cree,
  icone,
  route
) VALUES (
  'gestion-budget',
  'Gestion de Budget',
  'Budgets prévisionnels, suivi des écarts, reporting, analyse financière, tableaux de bord budgétaires',
  'option',
  'transversal',
  5,
  false,
  false,
  'DollarSign',
  'gestion-budget'
) ON CONFLICT (module_code) DO UPDATE SET
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  secteur_activite = EXCLUDED.secteur_activite,
  priorite = EXCLUDED.priorite,
  icone = EXCLUDED.icone,
  route = EXCLUDED.route;

INSERT INTO modules_metier (
  module_code,
  secteur_activite,
  priorite,
  est_essentiel
) VALUES (
  'gestion-budget',
  'transversal',
  5,
  false
) ON CONFLICT (module_code, secteur_activite) DO UPDATE SET
  priorite = EXCLUDED.priorite;

-- Mettre à jour les modules core existants pour qu'ils soient dans le secteur transversal
UPDATE modules_activation
SET secteur_activite = 'transversal', priorite = 0
WHERE module_code IN ('dashboard', 'clients', 'facturation', 'documents')
AND (secteur_activite IS NULL OR secteur_activite != 'transversal');

-- Mettre à jour les modules admin existants
UPDATE modules_activation
SET secteur_activite = 'transversal', priorite = 0
WHERE module_code IN ('collaborateurs', 'gestion-equipe')
AND (secteur_activite IS NULL OR secteur_activite != 'transversal');

-- Insérer les modules core dans modules_metier s'ils n'y sont pas déjà
INSERT INTO modules_metier (module_code, secteur_activite, priorite, est_essentiel)
SELECT module_code, 'transversal', 0, true
FROM modules_activation
WHERE module_code IN ('dashboard', 'clients', 'facturation', 'documents', 'collaborateurs', 'gestion-equipe')
AND NOT EXISTS (
  SELECT 1 FROM modules_metier 
  WHERE modules_metier.module_code = modules_activation.module_code 
  AND modules_metier.secteur_activite = 'transversal'
)
ON CONFLICT (module_code, secteur_activite) DO NOTHING;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 - Modules Transversaux insérés :';
  RAISE NOTICE '   1. Gestion de Projets (priorité 1)';
  RAISE NOTICE '   2. Gestion de Stock Générique (priorité 2)';
  RAISE NOTICE '   3. CRM Avancé (priorité 3)';
  RAISE NOTICE '   4. Time Tracking / Pointage (priorité 4)';
  RAISE NOTICE '   5. Gestion de Budget (priorité 5)';
  RAISE NOTICE '✅ Modules core mis à jour avec secteur transversal';
END $$;

