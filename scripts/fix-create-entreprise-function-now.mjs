#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL manquante');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

const fixSQL = `
-- ============================================================================
-- SUPPRIMER TOUTES LES VERSIONS EXISTANTES
-- ============================================================================

DO \$\$
DECLARE
  r RECORD;
BEGIN
  -- Supprimer toutes les versions de la fonction
  FOR r IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'create_complete_entreprise_automated'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 'public', r.proname, r.args);
    RAISE NOTICE 'Supprimé: %(%)', r.proname, r.args;
  END LOOP;
END \$\$;

-- ============================================================================
-- CRÉER LA FONCTION AVEC TOUS LES PARAMÈTRES
-- ============================================================================

CREATE OR REPLACE FUNCTION create_complete_entreprise_automated(
  -- Informations entreprise
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
  -- ✅ PARAMÈTRES POUR MODULE COMPTABILITÉ (via fichier tampon shared.ts)
  p_code_ape text DEFAULT NULL,
  p_code_naf text DEFAULT NULL,
  p_convention_collective text DEFAULT NULL,
  
  -- Informations client (optionnel)
  p_email_client text DEFAULT NULL,
  p_nom_client text DEFAULT NULL,
  p_prenom_client text DEFAULT NULL,
  p_telephone_client text DEFAULT NULL,
  p_adresse_client text DEFAULT NULL,
  p_code_postal_client text DEFAULT NULL,
  p_ville_client text DEFAULT NULL,
  p_password_client text DEFAULT NULL,
  
  -- Abonnement
  p_plan_id uuid DEFAULT NULL,
  p_options_ids uuid[] DEFAULT NULL,
  
  -- Options
  p_creer_client_super_admin boolean DEFAULT true,
  p_envoyer_email boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS \$\$
DECLARE
  v_user_id uuid;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_password text;
  v_email_final text;
  v_auth_user_id uuid;
  v_role text;
  v_plan RECORD;
  v_plan_montant_mensuel numeric;
  v_plan_info jsonb;
  v_plan_exists boolean;
  v_statut_paiement text;
  v_paiement_id uuid;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
BEGIN
  RAISE NOTICE '[create_complete_entreprise_automated] 🚀 DÉBUT - Entreprise: %, Plan ID: %', p_nom_entreprise, p_plan_id;
  
  -- 1. Récupérer l'utilisateur connecté
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  -- 2. Récupérer les informations du plan depuis plans_abonnement
  IF p_plan_id IS NOT NULL THEN
    RAISE NOTICE '[create_complete_entreprise_automated] 🔍 Recherche plan d''abonnement: %', p_plan_id;
    
    SELECT EXISTS(SELECT 1 FROM plans_abonnement WHERE id = p_plan_id) INTO v_plan_exists;
    
    IF NOT v_plan_exists THEN
      RAISE WARNING '[create_complete_entreprise_automated] ❌ Plan d''abonnement NON TROUVÉ: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text
      );
    END IF;
    
    SELECT 
      id, nom, description, prix_mensuel, prix_annuel,
      fonctionnalites, max_entreprises, max_utilisateurs,
      actif, ordre, created_at
    INTO v_plan
    FROM plans_abonnement
    WHERE id = p_plan_id;
    
    IF NOT FOUND THEN
      RAISE WARNING '[create_complete_entreprise_automated] ❌ Plan d''abonnement non trouvé après vérification: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement non trouvé',
        'plan_id', p_plan_id::text
      );
    END IF;
    
    IF v_plan.actif IS FALSE THEN
      RAISE WARNING '[create_complete_entreprise_automated] ⚠️ Plan d''abonnement inactif: %', p_plan_id;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Plan d''abonnement inactif',
        'plan_id', p_plan_id::text,
        'plan_nom', v_plan.nom
      );
    END IF;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Plan trouvé: % (ID: %, Prix mensuel: %)', 
      v_plan.nom, v_plan.id, v_plan.prix_mensuel;
    
    v_plan_montant_mensuel := COALESCE(v_plan.prix_mensuel, 0);
    IF v_plan_montant_mensuel = 0 AND v_plan.prix_annuel IS NOT NULL AND v_plan.prix_annuel > 0 THEN
      v_plan_montant_mensuel := v_plan.prix_annuel / 12;
      RAISE NOTICE '[create_complete_entreprise_automated] 📊 Prix mensuel calculé depuis prix annuel: %', v_plan_montant_mensuel;
    END IF;
    
    v_montant_ht := v_plan_montant_mensuel;
    v_montant_tva := v_montant_ht * 0.20;
    v_montant_ttc := v_montant_ht + v_montant_tva;
    
    v_plan_info := jsonb_build_object(
      'plan_id', v_plan.id::text,
      'plan_nom', v_plan.nom,
      'plan_description', COALESCE(v_plan.description, ''),
      'prix_mensuel', v_plan.prix_mensuel,
      'prix_annuel', v_plan.prix_annuel,
      'montant_ht', v_montant_ht,
      'montant_tva', v_montant_tva,
      'montant_ttc', v_montant_ttc
    );
    
    RAISE NOTICE '[create_complete_entreprise_automated] 📊 Plan info créé: %', v_plan_info;
  ELSE
    v_plan_montant_mensuel := 0;
    v_montant_ht := 0;
    v_montant_tva := 0;
    v_montant_ttc := 0;
    v_plan_info := NULL;
    RAISE NOTICE '[create_complete_entreprise_automated] ℹ️ Aucun plan sélectionné';
  END IF;

  -- 3. Déterminer le statut de paiement
  v_statut_paiement := CASE 
    WHEN v_plan_montant_mensuel > 0 THEN 'en_attente'
    ELSE 'non_requis'
  END;

  -- 4. Créer l'entreprise AVEC statut_paiement ET les nouveaux champs (code_ape, code_naf, convention_collective)
  INSERT INTO entreprises (
    user_id, nom, forme_juridique, siret, email, telephone,
    adresse, code_postal, ville, capital, rcs, site_web, statut, statut_paiement,
    code_ape, code_naf, convention_collective
  )
  VALUES (
    v_user_id, p_nom_entreprise, p_forme_juridique, NULLIF(p_siret, ''),
    NULLIF(p_email_entreprise, ''), NULLIF(p_telephone_entreprise, ''),
    NULLIF(p_adresse, ''), NULLIF(p_code_postal, ''), NULLIF(p_ville, ''),
    p_capital, NULLIF(p_rcs, ''), NULLIF(p_site_web, ''),
    'active', v_statut_paiement,
    NULLIF(p_code_ape, ''), NULLIF(p_code_naf, ''), NULLIF(p_convention_collective, '')
  )
  RETURNING id INTO v_entreprise_id;

  RAISE NOTICE '[create_complete_entreprise_automated] ✅ Entreprise créée: % (statut_paiement: %, code_ape: %, code_naf: %, convention_collective: %)', 
    v_entreprise_id, v_statut_paiement, p_code_ape, p_code_naf, p_convention_collective;

  -- 5. Créer le client si les informations sont fournies
  IF p_email_client IS NOT NULL AND p_email_client != '' THEN
    IF p_password_client IS NOT NULL AND p_password_client != '' THEN
      v_password := p_password_client;
    ELSE
      v_password := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || upper(substr(md5(random()::text), 1, 2)) || '!';
    END IF;
    
    INSERT INTO clients (
      entreprise_id, nom, prenom, email, telephone,
      adresse, code_postal, ville, statut, entreprise_nom
    )
    VALUES (
      v_entreprise_id,
      COALESCE(NULLIF(p_nom_client, ''), 'Client'),
      COALESCE(NULLIF(p_prenom_client, ''), ''),
      p_email_client,
      NULLIF(p_telephone_client, ''),
      NULLIF(p_adresse_client, ''),
      NULLIF(p_code_postal_client, ''),
      NULLIF(p_ville_client, ''),
      CASE WHEN v_statut_paiement = 'en_attente' THEN 'en_attente' ELSE 'actif' END,
      p_nom_entreprise
    )
    RETURNING id INTO v_client_id;
    
    v_auth_user_id := gen_random_uuid();
    v_role := CASE WHEN p_creer_client_super_admin THEN 'client_super_admin' ELSE 'client' END;
    
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_user_id, 'authenticated', 'authenticated', p_email_client,
        crypt(v_password, gen_salt('bf')), now(),
        jsonb_build_object('nom', COALESCE(NULLIF(p_nom_client, ''), 'Client'), 'prenom', COALESCE(NULLIF(p_prenom_client, ''), ''), 'role', v_role, 'type', 'client'),
        now(), now(), '', '', '', ''
      );
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email_client LIMIT 1;
      IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Email existe mais utilisateur introuvable: %', p_email_client;
      END IF;
    END;
    
    INSERT INTO utilisateurs (id, email, nom, prenom, role)
    VALUES (v_auth_user_id, p_email_client, COALESCE(NULLIF(p_nom_client, ''), 'Client'), COALESCE(NULLIF(p_prenom_client, ''), ''), v_role)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email, nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, role = EXCLUDED.role;
    
    v_email_final := p_email_client;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Client créé: % (auth_user_id: %)', 
      v_client_id, v_auth_user_id;
  END IF;

  -- 6. Créer le paiement avec plan_id dans les notes ET workflow_data
  IF p_plan_id IS NOT NULL AND v_plan_montant_mensuel > 0 THEN
    RAISE NOTICE '[create_complete_entreprise_automated] 💳 Création paiement avec plan_id: %', p_plan_id;
    
    INSERT INTO paiements (
      user_id, entreprise_id, type_paiement,
      montant_ht, montant_tva, montant_ttc,
      methode_paiement, statut, date_echeance, notes
    )
    VALUES (
      v_user_id, v_entreprise_id, 'autre',
      v_montant_ht, v_montant_tva, v_montant_ttc,
      'stripe', 'en_attente', CURRENT_DATE + INTERVAL '30 days',
      jsonb_build_object(
        'plan_id', p_plan_id::text,
        'entreprise_id', v_entreprise_id::text,
        'client_id', COALESCE(v_client_id::text, NULL),
        'auth_user_id', COALESCE(v_auth_user_id::text, NULL),
        'options_ids', CASE 
          WHEN p_options_ids IS NOT NULL THEN array_to_json(p_options_ids::text[])::text
          ELSE NULL
        END,
        'description', format('Paiement pour création entreprise: %s', p_nom_entreprise),
        'plan_info', v_plan_info,
        'plan_nom', v_plan.nom,
        'plan_description', COALESCE(v_plan.description, ''),
        'prix_mensuel', v_plan.prix_mensuel,
        'prix_annuel', v_plan.prix_annuel,
        'montant_ttc', v_montant_ttc,
        'montant_ht', v_montant_ht,
        'montant_tva', v_montant_tva,
        'origine', 'creation_entreprise'
      )
    )
    RETURNING id INTO v_paiement_id;
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Paiement créé: %', v_paiement_id;
    
    -- 7. ✅ CRITIQUE : Créer workflow_data pour que creer_facture_et_abonnement_apres_paiement puisse fonctionner
    INSERT INTO workflow_data (
      paiement_id,
      entreprise_id,
      client_id,
      auth_user_id,
      plan_id,
      plan_info,
      traite
    )
    VALUES (
      v_paiement_id,
      v_entreprise_id,
      v_client_id,
      v_auth_user_id,
      p_plan_id,
      v_plan_info,
      false
    )
    ON CONFLICT (paiement_id) DO UPDATE
    SET entreprise_id = EXCLUDED.entreprise_id,
        client_id = EXCLUDED.client_id,
        auth_user_id = EXCLUDED.auth_user_id,
        plan_id = EXCLUDED.plan_id,
        plan_info = EXCLUDED.plan_info,
        traite = false,
        updated_at = now();
    
    RAISE NOTICE '[create_complete_entreprise_automated] ✅ Données stockées dans workflow_data pour paiement: %', v_paiement_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entreprise_id', v_entreprise_id,
    'entreprise_nom', p_nom_entreprise,
    'client_id', v_client_id,
    'email', v_email_final,
    'password', CASE WHEN v_email_final IS NOT NULL THEN v_password ELSE NULL END,
    'paiement_id', v_paiement_id,
    'montant_ttc', CASE WHEN v_paiement_id IS NOT NULL THEN v_montant_ttc ELSE NULL END,
    'plan_id', CASE WHEN p_plan_id IS NOT NULL THEN p_plan_id::text ELSE NULL END,
    'plan_info', CASE WHEN v_plan_info IS NOT NULL THEN v_plan_info ELSE NULL END,
    'message', CASE 
      WHEN v_paiement_id IS NOT NULL THEN 'Entreprise créée. Sélectionnez votre méthode de paiement.'
      ELSE 'Entreprise créée avec succès'
    END
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_complete_entreprise_automated] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'message', 'Erreur lors de la création automatisée de l''entreprise'
  );
END;
\$\$;

COMMENT ON FUNCTION create_complete_entreprise_automated IS 
'Crée une entreprise et un client. Si un plan est sélectionné, crée le paiement ET workflow_data. 
✅ CORRECTION: Inclut p_code_ape, p_code_naf, p_convention_collective pour le module comptabilité.
✅ Utilise le fichier tampon shared.ts pour gérer les variables communes entre modules.';
`;

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 FIX URGENT : create_complete_entreprise_automated');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    console.log('📋 Suppression de toutes les versions existantes...');
    await client.query(fixSQL);
    console.log('✅ Fonction corrigée avec succès !\n');
    
    console.log('🔄 Tu peux maintenant tester la création d\'entreprise dans l\'application.\n');
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

main();

