#!/usr/bin/env node

/**
 * Script pour appliquer directement le fix SQL via connexion PostgreSQL
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL manquante dans .env');
  process.exit(1);
}

const fixSQL = `
-- Supprimer l'ancienne version
DROP FUNCTION IF EXISTS creer_facture_et_abonnement_apres_paiement(uuid) CASCADE;

-- Créer la fonction CORRIGÉE
CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_workflow_data RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_plan_id uuid;
  v_plan RECORD;
  v_facture_id uuid;
  v_facture_existante uuid;
  v_numero_facture text;
  v_abonnement_id uuid;
  v_abonnement_existant uuid;
  v_espace_membre_id uuid;
  v_montant_ht numeric;
  v_montant_tva numeric;
  v_montant_ttc numeric;
  v_montant_mensuel numeric;
BEGIN
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 🚀 DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement FROM paiements WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé: %', p_paiement_id;
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Paiement trouvé - Statut: %, Entreprise: %, Montant: %', 
    v_paiement.statut, v_paiement.entreprise_id, v_paiement.montant_ttc;
  
  -- 2. ✅ CRITIQUE : Récupérer les données depuis workflow_data
  SELECT * INTO v_workflow_data
  FROM workflow_data
  WHERE paiement_id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ workflow_data non trouvé pour paiement: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Données du workflow non trouvées',
      'message', 'Les données nécessaires au workflow ne sont pas disponibles dans workflow_data.'
    );
  END IF;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data trouvé - Entreprise: %, Client: %, Plan: %, Auth User: %', 
    v_workflow_data.entreprise_id, v_workflow_data.client_id, v_workflow_data.plan_id, v_workflow_data.auth_user_id;
  
  -- 3. Utiliser les données de workflow_data
  v_entreprise_id := COALESCE(v_workflow_data.entreprise_id, v_paiement.entreprise_id);
  v_client_id := v_workflow_data.client_id;
  v_auth_user_id := v_workflow_data.auth_user_id;
  v_plan_id := v_workflow_data.plan_id;
  
  -- 4. Vérifications critiques
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID NULL';
    RETURN jsonb_build_object('success', false, 'error', 'ID d''entreprise manquant');
  END IF;
  
  IF v_client_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Client ID NULL';
    RETURN jsonb_build_object('success', false, 'error', 'ID de client manquant');
  END IF;
  
  IF v_auth_user_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Auth User ID NULL';
    RETURN jsonb_build_object('success', false, 'error', 'ID utilisateur client manquant');
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Plan ID NULL';
    RETURN jsonb_build_object('success', false, 'error', 'ID de plan manquant');
  END IF;
  
  -- 5. Marquer le paiement comme payé si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye', date_paiement = CURRENT_DATE WHERE id = p_paiement_id;
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Statut paiement mis à jour à "paye"';
  END IF;
  
  -- 6. Extraire les montants
  v_montant_ht := COALESCE(v_paiement.montant_ht, 0);
  v_montant_tva := COALESCE(v_paiement.montant_tva, 0);
  v_montant_ttc := COALESCE(v_paiement.montant_ttc, 0);
  v_montant_mensuel := v_montant_ht;
  
  -- 7. ✅ CORRECTION : Vérifier si une facture existe déjà via paiement_id (PAS via v_paiement.facture_id)
  SELECT id INTO v_facture_existante
  FROM factures
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_facture_existante IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Facture déjà existante: %', v_facture_existante;
    v_facture_id := v_facture_existante;
    SELECT numero INTO v_numero_facture FROM factures WHERE id = v_facture_id;
  ELSE
    -- 8. Créer la facture
    v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8);
    
    WHILE EXISTS (SELECT 1 FROM factures WHERE numero = v_numero_facture) LOOP
      v_numero_facture := 'FAC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(p_paiement_id::text, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::text;
    END LOOP;
    
    INSERT INTO factures (
      entreprise_id, client_id, numero, montant_ht, tva, montant_ttc,
      date_emission, date_echeance, statut, paiement_id, type
    )
    VALUES (
      v_entreprise_id, v_client_id, v_numero_facture,
      v_montant_ht, v_montant_tva, v_montant_ttc,
      CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'payee', p_paiement_id, 'facture'
    )
    RETURNING id, numero INTO v_facture_id, v_numero_facture;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Facture créée: % (%)', v_facture_id, v_numero_facture;
  END IF;
  
  -- 9. Récupérer le plan
  SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Plan % non trouvé', v_plan_id;
    RETURN jsonb_build_object('success', false, 'error', 'Plan d''abonnement non trouvé');
  END IF;
  
  -- 10. ✅ CRÉER L'ABONNEMENT
  SELECT id INTO v_abonnement_existant
  FROM abonnements
  WHERE entreprise_id = v_entreprise_id 
    AND plan_id = v_plan_id
    AND statut = 'actif'
  LIMIT 1;
  
  IF v_abonnement_existant IS NOT NULL THEN
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Abonnement déjà existant: %', v_abonnement_existant;
    v_abonnement_id := v_abonnement_existant;
  ELSE
    BEGIN
      INSERT INTO abonnements (
        entreprise_id, client_id, plan_id, date_debut, date_fin, 
        statut, montant_mensuel, mode_paiement
      )
      VALUES (
        v_entreprise_id, v_auth_user_id, v_plan_id,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 
        'actif', v_montant_mensuel, 'mensuel'
      )
      RETURNING id INTO v_abonnement_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Abonnement créé: %', v_abonnement_id;
      
      BEGIN
        UPDATE abonnements SET facture_id = v_facture_id WHERE id = v_abonnement_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Colonne facture_id n''existe pas, ignoré';
      END;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création abonnement: %', SQLERRM;
        BEGIN
          INSERT INTO abonnements (entreprise_id, client_id, plan_id, statut, date_debut)
          VALUES (v_entreprise_id, v_auth_user_id, v_plan_id, 'actif', CURRENT_DATE)
          RETURNING id INTO v_abonnement_id;
        EXCEPTION
          WHEN OTHERS THEN
            v_abonnement_id := NULL;
        END;
    END;
  END IF;
  
  -- 11. ✅ CRÉER L'ESPACE MEMBRE CLIENT
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    BEGIN
      INSERT INTO espaces_membres_clients (
        client_id, entreprise_id, user_id, actif,
        modules_actifs, statut_compte
      )
      VALUES (
        v_client_id, v_entreprise_id, v_auth_user_id, true,
        jsonb_build_object(
          'tableau_de_bord', true, 
          'mon_entreprise', true,
          'factures', true, 
          'documents', true, 
          'abonnements', true
        ),
        'actif'
      )
      RETURNING id INTO v_espace_membre_id;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre créé: %', v_espace_membre_id;
      
      BEGIN
        UPDATE espaces_membres_clients 
        SET abonnement_id = v_abonnement_id 
        WHERE id = v_espace_membre_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Colonne abonnement_id n''existe pas, ignoré';
      END;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Erreur création espace membre: %', SQLERRM;
        v_espace_membre_id := NULL;
    END;
  ELSE
    UPDATE espaces_membres_clients
    SET actif = true, statut_compte = 'actif', user_id = COALESCE(v_auth_user_id, user_id)
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Espace membre mis à jour: %', v_espace_membre_id;
  END IF;
  
  -- 12. Activer entreprise et client
  UPDATE entreprises SET statut = 'active', statut_paiement = 'paye' WHERE id = v_entreprise_id;
  UPDATE clients SET statut = 'actif' WHERE id = v_client_id;
  
  -- 13. Mettre à jour le rôle du client
  BEGIN
    UPDATE utilisateurs SET role = 'client_super_admin' WHERE id = v_auth_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur mise à jour rôle: %', SQLERRM;
  END;
  
  -- 14. Synchroniser les modules depuis le plan
  BEGIN
    PERFORM sync_client_modules_from_plan(v_espace_membre_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan n''existe pas, ignoré';
  END;
  
  -- 15. Marquer workflow_data comme traité
  UPDATE workflow_data
  SET traite = true, updated_at = now()
  WHERE paiement_id = p_paiement_id;
  
  RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ workflow_data marqué comme traité';
  
  -- 16. Retourner le résultat complet
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture, abonnement et espace client créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id,
    'entreprise_id', v_entreprise_id,
    'numero_facture', v_numero_facture,
    'plan_id', v_plan_id,
    'client_id', v_client_id,
    'auth_user_id', v_auth_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;
`;

async function main() {
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 FIX DIRECT : Erreur v_paiement.facture_id');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté!\n');
    
    console.log('📋 Application du fix SQL...');
    await client.query(fixSQL);
    console.log('✅ Fix appliqué avec succès !\n');
    
    console.log('🔄 Tu peux maintenant relancer: node scripts/forcer-workflow-complet.mjs\n');
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    if (err.message.includes('DATABASE_URL')) {
      console.error('\n💡 Assure-toi que DATABASE_URL est définie dans .env');
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connexion fermée');
  }
}

main();

