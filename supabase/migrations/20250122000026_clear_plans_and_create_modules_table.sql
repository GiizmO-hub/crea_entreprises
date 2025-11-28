/*
  # Supprimer les plans et créer un système simple de gestion des modules
  
  1. Supprimer toutes les données des plans d'abonnement
  2. Créer une table modules_activation pour gérer l'activation/désactivation des modules
  3. Permettre au super admin d'activer/désactiver les modules indépendamment des plans
*/

-- 1. Supprimer toutes les fonctionnalités des plans existants
UPDATE plans_abonnement 
SET fonctionnalites = '{}'::jsonb;

-- 2. Créer une table pour gérer l'activation des modules (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS modules_activation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL UNIQUE,
  module_nom text NOT NULL,
  module_description text,
  categorie text NOT NULL CHECK (categorie IN ('core', 'premium', 'option', 'admin')),
  actif boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE modules_activation ENABLE ROW LEVEL SECURITY;

-- RLS : Super admin peut tout faire, autres utilisateurs peuvent seulement lire
CREATE POLICY "Super admin peut gérer tous les modules"
  ON modules_activation FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE utilisateurs.id = auth.uid()
      AND utilisateurs.role = 'super_admin'
    )
  );

CREATE POLICY "Utilisateurs peuvent voir les modules actifs"
  ON modules_activation FOR SELECT
  TO authenticated
  USING (actif = true);

-- Fonction pour activer/désactiver un module
CREATE OR REPLACE FUNCTION toggle_module_activation(
  p_module_code text,
  p_activer boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur est super admin
  SELECT role INTO v_user_role
  FROM utilisateurs
  WHERE id = auth.uid();

  IF v_user_role != 'super_admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé. Seul le super admin peut gérer les modules.'
    );
  END IF;

  -- Insérer ou mettre à jour le module
  INSERT INTO modules_activation (module_code, module_nom, module_description, categorie, actif)
  VALUES (
    p_module_code,
    COALESCE((SELECT nom FROM modules_activation WHERE module_code = p_module_code), p_module_code),
    COALESCE((SELECT module_description FROM modules_activation WHERE module_code = p_module_code), ''),
    COALESCE((SELECT categorie FROM modules_activation WHERE module_code = p_module_code), 'core'),
    p_activer
  )
  ON CONFLICT (module_code) 
  DO UPDATE SET 
    actif = p_activer,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'module_code', p_module_code,
    'actif', p_activer
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION toggle_module_activation IS 'Activer/désactiver un module (super admin uniquement)';

-- Fonction pour obtenir tous les modules et leur statut
CREATE OR REPLACE FUNCTION get_all_modules_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', module_code,
      'nom', module_nom,
      'description', module_description,
      'categorie', categorie,
      'actif', actif
    )
  ) INTO v_result
  FROM modules_activation;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_all_modules_status IS 'Obtenir le statut de tous les modules';




