/*
  # Système complet de gestion Plans d'Abonnements avec Modules
  
  1. Modifier plans_abonnement pour inclure plus d'infos
  2. Lier plans_abonnement aux modules via plans_modules (au lieu d'abonnements_modules directement)
  3. Fonction pour synchroniser modules d'un plan vers les espaces clients
  4. Fonction pour créer/modifier un plan avec ses modules
*/

-- 1. Table pour lier plans et modules (avec prix personnalisés)
CREATE TABLE IF NOT EXISTS plans_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans_abonnement(id) ON DELETE CASCADE,
  module_code text NOT NULL REFERENCES modules_activation(module_code) ON DELETE CASCADE,
  inclus boolean DEFAULT true, -- Si le module est inclus dans ce plan
  prix_mensuel numeric(10, 2) DEFAULT 0, -- Prix spécifique de ce module pour ce plan
  prix_annuel numeric(10, 2) DEFAULT 0, -- Prix annuel si différent
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, module_code)
);

CREATE INDEX IF NOT EXISTS idx_plans_modules_plan_id ON plans_modules(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_modules_module_code ON plans_modules(module_code);

-- Activer RLS
ALTER TABLE plans_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir plans_modules"
  ON plans_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin peut gérer plans_modules"
  ON plans_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

-- 2. Fonction pour synchroniser les modules d'un plan vers les espaces clients
CREATE OR REPLACE FUNCTION sync_plan_modules_to_client_spaces(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_abonnement_record record;
  v_module_record record;
  v_modules_json jsonb := '{}'::jsonb;
BEGIN
  -- Construire le JSON des modules actifs pour ce plan
  FOR v_module_record IN
    SELECT 
      pm.module_code,
      pm.inclus,
      ma.module_nom
    FROM plans_modules pm
    JOIN modules_activation ma ON ma.module_code = pm.module_code
    WHERE pm.plan_id = p_plan_id
      AND pm.inclus = true
      AND ma.est_cree = true
      AND ma.actif = true
  LOOP
    v_modules_json := jsonb_set(
      v_modules_json,
      ARRAY[v_module_record.module_code],
      'true'::jsonb
    );
  END LOOP;

  -- Mettre à jour tous les espaces clients liés à ce plan
  UPDATE espaces_membres_clients emc
  SET modules_actifs = v_modules_json,
      updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM abonnements a
    WHERE a.id = emc.abonnement_id
      AND a.plan_id = p_plan_id
      AND a.statut = 'actif'
  );

  RAISE NOTICE 'Modules synchronisés pour le plan % vers % espaces clients', 
    p_plan_id, 
    (SELECT COUNT(*) FROM espaces_membres_clients emc
     WHERE EXISTS (
       SELECT 1 FROM abonnements a
       WHERE a.id = emc.abonnement_id
         AND a.plan_id = p_plan_id
         AND a.statut = 'actif'
     ));
END;
$$;

-- 3. Fonction pour créer/modifier un plan avec ses modules
CREATE OR REPLACE FUNCTION upsert_plan_with_modules(
  p_nom text,
  p_description text DEFAULT NULL,
  p_prix_mensuel numeric DEFAULT 0,
  p_prix_annuel numeric DEFAULT 0,
  p_actif boolean DEFAULT true,
  p_ordre integer DEFAULT 0,
  p_modules jsonb DEFAULT '[]'::jsonb, -- Format: [{"module_code": "xxx", "inclus": true, "prix_mensuel": 0, "prix_annuel": 0}]
  p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_plan_id uuid;
  v_module_item jsonb;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur est super admin
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé. Seul le super admin peut gérer les plans.'
    );
  END IF;

  -- Créer ou mettre à jour le plan
  IF p_plan_id IS NULL THEN
    -- Création
    INSERT INTO plans_abonnement (nom, description, prix_mensuel, prix_annuel, actif, ordre)
    VALUES (p_nom, p_description, p_prix_mensuel, p_prix_annuel, p_actif, p_ordre)
    RETURNING id INTO v_new_plan_id;
  ELSE
    -- Mise à jour
    v_new_plan_id := p_plan_id;
    UPDATE plans_abonnement
    SET nom = p_nom,
        description = p_description,
        prix_mensuel = p_prix_mensuel,
        prix_annuel = p_prix_annuel,
        actif = p_actif,
        ordre = p_ordre
    WHERE id = p_plan_id;
  END IF;

  -- Supprimer les anciennes associations de modules
  DELETE FROM plans_modules WHERE plan_id = v_new_plan_id;

  -- Ajouter les nouveaux modules
  FOR v_module_item IN SELECT * FROM jsonb_array_elements(p_modules)
  LOOP
    INSERT INTO plans_modules (plan_id, module_code, inclus, prix_mensuel, prix_annuel)
    VALUES (
      v_new_plan_id,
      v_module_item->>'module_code',
      COALESCE((v_module_item->>'inclus')::boolean, true),
      COALESCE((v_module_item->>'prix_mensuel')::numeric, 0),
      COALESCE((v_module_item->>'prix_annuel')::numeric, 0)
    )
    ON CONFLICT (plan_id, module_code) DO UPDATE SET
      inclus = EXCLUDED.inclus,
      prix_mensuel = EXCLUDED.prix_mensuel,
      prix_annuel = EXCLUDED.prix_annuel,
      updated_at = NOW();
  END LOOP;

  -- Synchroniser les modules vers les espaces clients
  PERFORM sync_plan_modules_to_client_spaces(v_new_plan_id);

  RETURN jsonb_build_object(
    'success', true,
    'plan_id', v_new_plan_id,
    'message', 'Plan créé/modifié avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. Trigger pour synchroniser automatiquement lors de la création/modification d'un abonnement
CREATE OR REPLACE FUNCTION sync_abonnement_to_client_space()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
BEGIN
  -- Si l'abonnement est actif, synchroniser les modules
  IF NEW.statut = 'actif' THEN
    -- Construire le JSON des modules actifs pour ce plan
    FOR v_module_record IN
      SELECT pm.module_code
      FROM plans_modules pm
      JOIN modules_activation ma ON ma.module_code = pm.module_code
      WHERE pm.plan_id = NEW.plan_id
        AND pm.inclus = true
        AND ma.est_cree = true
        AND ma.actif = true
    LOOP
      v_modules_json := jsonb_set(
        v_modules_json,
        ARRAY[v_module_record.module_code],
        'true'::jsonb
      );
    END LOOP;

    -- Mettre à jour l'espace client lié
    UPDATE espaces_membres_clients
    SET modules_actifs = v_modules_json,
        abonnement_id = NEW.id,
        updated_at = NOW()
    WHERE entreprise_id = NEW.entreprise_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_abonnement_update_sync_modules ON abonnements;
CREATE TRIGGER on_abonnement_update_sync_modules
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  EXECUTE FUNCTION sync_abonnement_to_client_space();

-- 5. Fonction pour obtenir les modules d'un plan avec leurs prix
CREATE OR REPLACE FUNCTION get_plan_modules(p_plan_id uuid)
RETURNS TABLE (
  module_code text,
  module_nom text,
  module_description text,
  categorie text,
  inclus boolean,
  prix_mensuel numeric,
  prix_annuel numeric,
  est_cree boolean,
  actif boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.module_code,
    ma.module_nom,
    ma.module_description,
    ma.categorie,
    COALESCE(pm.inclus, false) as inclus,
    COALESCE(pm.prix_mensuel, ma.prix_optionnel, 0) as prix_mensuel,
    COALESCE(pm.prix_annuel, 0) as prix_annuel,
    ma.est_cree,
    ma.actif
  FROM modules_activation ma
  LEFT JOIN plans_modules pm ON pm.module_code = ma.module_code AND pm.plan_id = p_plan_id
  WHERE ma.est_cree = true
  ORDER BY ma.categorie, ma.module_nom;
END;
$$;

-- Commentaires
COMMENT ON TABLE plans_modules IS 'Liaison entre plans d''abonnement et modules avec prix personnalisés';
COMMENT ON FUNCTION sync_plan_modules_to_client_spaces IS 'Synchronise les modules d''un plan vers tous les espaces clients liés';
COMMENT ON FUNCTION upsert_plan_with_modules IS 'Crée ou met à jour un plan avec ses modules et prix personnalisés';
COMMENT ON FUNCTION get_plan_modules IS 'Récupère tous les modules avec leur statut dans un plan';

