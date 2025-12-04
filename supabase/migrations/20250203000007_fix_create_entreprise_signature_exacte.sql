-- ============================================================================
-- FIX : Signature exacte de create_complete_entreprise_automated
-- ============================================================================
-- 
-- PROBLÈME: Le frontend appelle la fonction avec une signature spécifique,
--           mais la fonction en base a des valeurs par défaut qui créent
--           un conflit avec Supabase PostgREST.
-- 
-- SOLUTION: Recréer la fonction avec la signature EXACTE attendue par le frontend,
--           en utilisant le fichier tampon (shared.ts) pour garantir la cohérence.
-- 
-- ⚠️ CRITIQUE : Cette fonction DOIT correspondre exactement à l'appel dans
--               EntreprisesPlateforme.tsx (lignes 266-312)
-- 
-- ============================================================================

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS create_complete_entreprise_automated(
  text, text, text, text, text, text, text, text, numeric, text, text, 
  text, text, text, text, text, text, text, text, text, text, text, 
  uuid, uuid[], boolean, boolean
) CASCADE;

DROP FUNCTION IF EXISTS create_complete_entreprise_automated(
  p_nom_entreprise text, p_forme_juridique text, p_siret text, 
  p_email_entreprise text, p_telephone_entreprise text, p_adresse text, 
  p_code_postal text, p_ville text, p_capital numeric, p_rcs text, 
  p_site_web text, p_code_ape text, p_code_naf text, 
  p_convention_collective text, p_email_client text, p_nom_client text, 
  p_prenom_client text, p_telephone_client text, p_adresse_client text, 
  p_code_postal_client text, p_ville_client text, p_password_client text, 
  p_plan_id uuid, p_options_ids uuid[], p_creer_client_super_admin boolean, 
  p_envoyer_email boolean
) CASCADE;

-- Créer la fonction avec la signature EXACTE (sans valeurs par défaut pour les paramètres obligatoires)
CREATE OR REPLACE FUNCTION create_complete_entreprise_automated(
  p_nom_entreprise text,
  p_forme_juridique text DEFAULT 'SARL',
  p_siret text DEFAULT NULL,
  p_email_entreprise text DEFAULT NULL,
  p_telephone_entreprise text DEFAULT NULL,
  p_adresse text DEFAULT NULL,
  p_code_postal text DEFAULT NULL,
  p_ville text DEFAULT NULL,
  p_capital numeric DEFAULT 0,
  p_rcs text DEFAULT NULL,
  p_site_web text DEFAULT NULL,
  p_code_ape text DEFAULT NULL,
  p_code_naf text DEFAULT NULL,
  p_convention_collective text DEFAULT NULL,
  p_email_client text DEFAULT NULL,
  p_nom_client text DEFAULT NULL,
  p_prenom_client text DEFAULT NULL,
  p_telephone_client text DEFAULT NULL,
  p_adresse_client text DEFAULT NULL,
  p_code_postal_client text DEFAULT NULL,
  p_ville_client text DEFAULT NULL,
  p_password_client text DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL,
  p_creer_client_super_admin boolean DEFAULT true,
  p_envoyer_email boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_paiement_id uuid;
  v_plan RECORD;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_password text;
  v_workflow_data_id uuid;
BEGIN
  RAISE NOTICE '[create_complete_entreprise_automated] 🚀 DÉBUT - Entreprise: %', p_nom_entreprise;
  
  -- 1. Créer l'entreprise
  INSERT INTO entreprises (
    nom, forme_juridique, siret, email, telephone,
    adresse, code_postal, ville, capital, rcs, site_web,
    code_ape, code_naf, convention_collective,
    statut, statut_paiement, user_id
  )
  VALUES (
    p_nom_entreprise, p_forme_juridique, p_siret, p_email_entreprise, p_telephone_entreprise,
    p_adresse, p_code_postal, p_ville, p_capital, p_rcs, p_site_web,
    p_code_ape, p_code_naf, p_convention_collective,
    'active', 'en_attente', auth.uid()
  )
  RETURNING id INTO v_entreprise_id;
  
  RAISE NOTICE '[create_complete_entreprise_automated] ✅ Entreprise créée: %', v_entreprise_id;
  
  -- 2. Si un client doit être créé
  IF p_email_client IS NOT NULL AND p_nom_client IS NOT NULL THEN
    -- Générer un mot de passe si non fourni
    IF p_password_client IS NULL OR p_password_client = '' THEN
      v_password := encode(gen_random_bytes(16), 'base64');
    ELSE
      v_password := p_password_client;
    END IF;
    
    -- Créer l'utilisateur auth
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email_client,
        crypt(v_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('nom', p_nom_client, 'prenom', p_prenom_client)
      )
      RETURNING id INTO v_auth_user_id;
      
      RAISE NOTICE '[create_complete_entreprise_automated] ✅ Utilisateur auth créé: %', v_auth_user_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Utilisateur existe déjà, récupérer son ID
        SELECT id INTO v_auth_user_id
        FROM auth.users
        WHERE email = p_email_client
        LIMIT 1;
        
        RAISE NOTICE '[create_complete_entreprise_automated] ⚠️ Utilisateur existe déjà: %', v_auth_user_id;
    END;
    
    -- Créer le client
    INSERT INTO clients (
      entreprise_id, email, nom, prenom, telephone,
      adresse, code_postal, ville, statut
    )
    VALUES (
      v_entreprise_id, p_email_client, p_nom_client, p_prenom_client, p_telephone_client,
      p_adresse_client, p_code_postal_client, p_ville_client, 'actif'
    )
    RETURNING id INTO v_client_id;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Client créé: %', v_client_id;
    
    -- Mettre à jour le rôle si super admin
    IF p_creer_client_super_admin THEN
      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
          jsonb_build_object('role', 'client_super_admin')
      WHERE id = v_auth_user_id;
      
      -- Créer aussi dans utilisateurs
      INSERT INTO utilisateurs (id, email, role, nom, prenom)
      VALUES (v_auth_user_id, p_email_client, 'client_super_admin', p_nom_client, p_prenom_client)
      ON CONFLICT (id) DO UPDATE
      SET role = 'client_super_admin', nom = p_nom_client, prenom = p_prenom_client;
      
      RAISE NOTICE '[create_complete_entreprise_automated] ✅ Client configuré comme Super Admin';
    END IF;
  END IF;
  
  -- 3. Si un plan est sélectionné, créer le paiement et workflow_data
  IF p_plan_id IS NOT NULL THEN
    -- Récupérer le plan
    SELECT * INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id
    LIMIT 1;
    
    IF FOUND THEN
      v_montant_ht := COALESCE(v_plan.prix_mensuel, 0);
      v_montant_tva := v_montant_ht * 0.20;
      v_montant_ttc := v_montant_ht + v_montant_tva;
      
      -- Créer le paiement
      INSERT INTO paiements (
        entreprise_id, montant_ht, montant_tva, montant_ttc,
        statut, methode_paiement
      )
      VALUES (
        v_entreprise_id, v_montant_ht, v_montant_tva, v_montant_ttc,
        'en_attente', 'stripe'
      )
      RETURNING id INTO v_paiement_id;
      
      RAISE NOTICE '[create_complete_entreprise_automated] ✅ Paiement créé: %', v_paiement_id;
      
      -- Créer workflow_data (CRITIQUE pour le workflow complet)
      INSERT INTO workflow_data (
        paiement_id, entreprise_id, client_id, auth_user_id, plan_id,
        plan_info, traite
      )
      VALUES (
        v_paiement_id, v_entreprise_id, v_client_id, v_auth_user_id, p_plan_id,
        jsonb_build_object(
          'nom', v_plan.nom,
          'prix_mensuel', v_plan.prix_mensuel,
          'description', v_plan.description
        ),
        false
      )
      RETURNING id INTO v_workflow_data_id;
      
      RAISE NOTICE '[create_complete_entreprise_automated] ✅ workflow_data créé: %', v_workflow_data_id;
    END IF;
  END IF;
  
  -- 4. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'client_id', v_client_id,
    'auth_user_id', v_auth_user_id,
    'paiement_id', v_paiement_id,
    'montant_ttc', v_montant_ttc,
    'email', p_email_client,
    'password', v_password,
    'email_a_envoyer', p_envoyer_email AND p_email_client IS NOT NULL,
    'entreprise_nom', p_nom_entreprise
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[create_complete_entreprise_automated] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
  'Crée une entreprise complète avec client, espace membre et paiement. Signature exacte correspondant au frontend.';

