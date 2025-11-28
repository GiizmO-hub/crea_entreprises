#!/usr/bin/env node
/**
 * Script de diagnostic complet pour la création d'abonnement
 * Utilise la fonction diagnostic_creation_abonnement() créée dans la migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fonction pour lire les variables d'environnement
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const env = {};
  
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
        }
      }
    });
  }
  
  return { ...process.env, ...env };
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   → VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   → VITE_SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosticAbonnement() {
  console.log('\n🔍 DIAGNOSTIC COMPLET : Création d\'abonnement\n');
  
  try {
    // 1. Récupérer un paiement récent avec statut 'paye'
    console.log('📋 ÉTAPE 1 : Récupération d\'un paiement récent...');
    const { data: paiements, error: paiementError } = await supabase
      .from('paiements')
      .select('id, entreprise_id, statut, montant_ttc, notes, created_at')
      .eq('statut', 'paye')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (paiementError) {
      console.error('❌ Erreur récupération paiement:', paiementError);
      return;
    }
    
    if (!paiements || paiements.length === 0) {
      console.error('❌ Aucun paiement avec statut "paye" trouvé');
      return;
    }
    
    const paiement = paiements[0];
    console.log('✅ Paiement trouvé:', {
      id: paiement.id,
      entreprise_id: paiement.entreprise_id,
      statut: paiement.statut,
      montant: paiement.montant_ttc,
    });
    
    // 2. Appeler la fonction de diagnostic
    console.log('\n📋 ÉTAPE 2 : Appel fonction diagnostic_creation_abonnement...');
    const { data: diagnostic, error: diagnosticError } = await supabase.rpc(
      'diagnostic_creation_abonnement',
      { p_paiement_id: paiement.id }
    );
    
    if (diagnosticError) {
      console.error('❌ Erreur diagnostic:', diagnosticError);
      return;
    }
    
    console.log('\n✅ RÉSULTAT DU DIAGNOSTIC :\n');
    console.log(JSON.stringify(diagnostic, null, 2));
    
    // 3. Interpréter les résultats
    console.log('\n📊 INTERPRÉTATION :\n');
    
    if (diagnostic.structure_abonnements) {
      console.log('📋 Structure table abonnements:');
      diagnostic.structure_abonnements.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) - nullable: ${col.is_nullable}`);
      });
    }
    
    if (diagnostic.donnees_extraites) {
      console.log('\n📊 Données extraites:');
      console.log(`   - entreprise_id: ${diagnostic.donnees_extraites.entreprise_id || '❌ MANQUANT'}`);
      console.log(`   - plan_id: ${diagnostic.donnees_extraites.plan_id || '❌ MANQUANT'}`);
      console.log(`   - client_id: ${diagnostic.donnees_extraites.client_id || '❌ MANQUANT'}`);
      console.log(`   - auth_user_id: ${diagnostic.donnees_extraites.auth_user_id || '❌ MANQUANT'}`);
    }
    
    if (diagnostic.entreprise_exists === false) {
      console.log('\n❌ PROBLÈME: Entreprise n\'existe pas');
    }
    
    if (diagnostic.plan_exists === false) {
      console.log('\n❌ PROBLÈME: Plan n\'existe pas');
    }
    
    if (diagnostic.facture_exists === false) {
      console.log('\n❌ PROBLÈME: Facture n\'existe pas');
    }
    
    if (diagnostic.auth_user_exists === false) {
      console.log('\n❌ PROBLÈME: Auth User n\'existe pas');
    }
    
    if (diagnostic.abonnement_existe_via_facture === true || 
        diagnostic.abonnement_existe_via_entreprise_plan === true) {
      console.log('\n✅ Abonnement existe déjà');
    } else {
      console.log('\n⚠️ Aucun abonnement trouvé - la création devrait être nécessaire');
      
      // Tester la création manuellement si toutes les données sont présentes
      if (diagnostic.entreprise_exists && 
          diagnostic.plan_exists && 
          diagnostic.facture_exists && 
          diagnostic.auth_user_exists &&
          diagnostic.auth_user_id_final) {
        console.log('\n🧪 TENTATIVE DE CRÉATION MANUELLE...');
        
        // Appeler creer_facture_et_abonnement_apres_paiement
        const { data: result, error: createError } = await supabase.rpc(
          'creer_facture_et_abonnement_apres_paiement',
          { p_paiement_id: paiement.id }
        );
        
        if (createError) {
          console.error('❌ Erreur création:', createError);
        } else {
          console.log('✅ Résultat création:', JSON.stringify(result, null, 2));
        }
      } else {
        console.log('\n❌ Impossible de créer - données manquantes');
      }
    }
    
    console.log('\n✅ DIAGNOSTIC TERMINÉ\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    console.error('Stack:', error.stack);
  }
}

diagnosticAbonnement().catch(console.error);

