/*
  # Fix: Erreur "query returned more than one row" dans upsert_plan_with_modules
  
  PROBLÈME:
  - La vérification du super admin dans upsert_plan_with_modules peut retourner plusieurs lignes
  - Cela cause l'erreur "query returned more than one row"
  
  SOLUTION:
  - Utiliser LIMIT 1 dans la requête de vérification
  - Utiliser une variable pour stocker le résultat
*/

-- Recréer upsert_plan_with_modules avec correction de la vérification super admin
CREATE OR REPLACE FUNCTION upsert_plan_with_modules(
  p_nom text,
  p_description text DEFAULT NULL,
  p_prix_mensuel numeric DEFAULT 0,
  p_prix_annuel numeric DEFAULT 0,
  p_actif boolean DEFAULT true,
  p_ordre integer DEFAULT 0,
  p_modules jsonb DEFAULT '[]'::jsonb,
  p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_new_plan_id uuid;
  v_module_item jsonb;
  v_user_role text;
  v_existing_plan_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est super admin (utiliser LIMIT 1 pour éviter "more than one row")
  SELECT role INTO v_user_role
  FROM utilisateurs
  WHERE id = auth.uid()
  LIMIT 1;
  
  -- Vérifier aussi dans auth.users.raw_user_meta_data si pas trouvé dans utilisateurs
  IF v_user_role IS NULL THEN
    SELECT (raw_user_meta_data->>'role')::text INTO v_user_role
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;
  
  IF v_user_role IS NULL OR v_user_role != 'super_admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Accès refusé. Seul le super admin peut gérer les plans.'
    );
  END IF;

  -- Créer ou mettre à jour le plan
  IF p_plan_id IS NULL THEN
    -- Création - Vérifier d'abord si un plan avec le même nom existe
    SELECT id INTO v_new_plan_id
    FROM plans_abonnement
    WHERE nom = p_nom
    LIMIT 1;
    
    IF v_new_plan_id IS NOT NULL THEN
      -- Un plan avec ce nom existe déjà, retourner une erreur claire
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Un plan avec le nom "%s" existe déjà. Veuillez utiliser un nom différent ou modifier le plan existant.', p_nom)
      );
    END IF;
    
    -- Création du nouveau plan
    INSERT INTO plans_abonnement (nom, description, prix_mensuel, prix_annuel, actif, ordre)
    VALUES (p_nom, p_description, p_prix_mensuel, p_prix_annuel, p_actif, p_ordre)
    RETURNING id INTO v_new_plan_id;
  ELSE
    -- Mise à jour - Vérifier si le nouveau nom n'est pas déjà utilisé par un autre plan
    SELECT id INTO v_existing_plan_id
    FROM plans_abonnement
    WHERE nom = p_nom
      AND id != p_plan_id
    LIMIT 1;
    
    IF v_existing_plan_id IS NOT NULL THEN
      -- Un autre plan avec ce nom existe déjà
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Un autre plan avec le nom "%s" existe déjà. Veuillez utiliser un nom différent.', p_nom)
      );
    END IF;
    
    -- Mise à jour du plan
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

  -- Synchroniser les modules vers les espaces clients (appeler la fonction même si elle retourne jsonb)
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
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION upsert_plan_with_modules IS 'Crée ou met à jour un plan avec ses modules et prix personnalisés - CORRIGÉ pour éviter "more than one row"';

GRANT EXECUTE ON FUNCTION upsert_plan_with_modules TO authenticated;

