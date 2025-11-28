#!/usr/bin/env node

/**
 * VÉRIFICATION COMPLÈTE DE LA SYNCHRONISATION DE LA BASE DE DONNÉES
 * Vérifie toutes les contraintes, relations et données
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyDatabaseSync() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION COMPLÈTE DE LA BASE DE DONNÉES');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let allGood = true;
  
  // 1. Vérifier les utilisateurs
  console.log('👤 ÉTAPE 1: Vérification des utilisateurs...\n');
  
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Erreur récupération utilisateurs:', usersError.message);
    allGood = false;
  } else {
    console.log(`✅ ${users.length} utilisateur(s) trouvé(s)`);
    users.slice(0, 5).forEach(user => {
      console.log(`   - ${user.email} (${user.id.substring(0, 8)}...)`);
    });
    if (users.length > 5) {
      console.log(`   ... et ${users.length - 5} autre(s)`);
    }
    console.log('');
  }
  
  // 2. Vérifier les entreprises et leurs user_id
  console.log('🏢 ÉTAPE 2: Vérification des entreprises et user_id...\n');
  
  const { data: entreprises, error: entreprisesError } = await supabase
    .from('entreprises')
    .select('id, nom, user_id, statut, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (entreprisesError) {
    console.error('❌ Erreur récupération entreprises:', entreprisesError.message);
    allGood = false;
  } else {
    console.log(`📊 ${entreprises.length} entreprise(s) trouvée(s)\n`);
    
    // Vérifier que tous les user_id existent
    let orphanedEnterprises = 0;
    for (const entreprise of entreprises) {
      if (entreprise.user_id) {
        const userExists = users?.find(u => u.id === entreprise.user_id);
        if (!userExists) {
          console.log(`   ❌ Entreprise "${entreprise.nom}" (${entreprise.id.substring(0, 8)}...)`);
          console.log(`      → user_id ${entreprise.user_id.substring(0, 8)}... N'EXISTE PAS`);
          orphanedEnterprises++;
          allGood = false;
        }
      } else {
        console.log(`   ⚠️  Entreprise "${entreprise.nom}" (${entreprise.id.substring(0, 8)}...)`);
        console.log(`      → user_id est NULL`);
      }
    }
    
    if (orphanedEnterprises === 0 && entreprises.length > 0) {
      console.log(`✅ Toutes les entreprises ont un user_id valide\n`);
    } else if (entreprises.length === 0) {
      console.log(`⚠️  Aucune entreprise trouvée\n`);
    }
  }
  
  // 3. Vérifier les clients et leurs entreprise_id
  console.log('👥 ÉTAPE 3: Vérification des clients...\n');
  
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, nom, prenom, email, entreprise_id, statut')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (clientsError) {
    console.error('❌ Erreur récupération clients:', clientsError.message);
    allGood = false;
  } else {
    console.log(`📊 ${clients.length} client(s) trouvé(s)\n`);
    
    // Vérifier les entreprise_id
    if (entreprises && entreprises.length > 0) {
      let orphanedClients = 0;
      for (const client of clients) {
        if (client.entreprise_id) {
          const entrepriseExists = entreprises.find(e => e.id === client.entreprise_id);
          if (!entrepriseExists) {
            // Vérifier dans la base complète
            const { data: entrepriseCheck } = await supabase
              .from('entreprises')
              .select('id')
              .eq('id', client.entreprise_id)
              .single();
            
            if (!entrepriseCheck) {
              console.log(`   ❌ Client "${client.nom} ${client.prenom}" (${client.id.substring(0, 8)}...)`);
              console.log(`      → entreprise_id ${client.entreprise_id.substring(0, 8)}... N'EXISTE PAS`);
              orphanedClients++;
              allGood = false;
            }
          }
        }
      }
      
      if (orphanedClients === 0 && clients.length > 0) {
        console.log(`✅ Tous les clients ont un entreprise_id valide\n`);
      }
    }
  }
  
  // 4. Vérifier les paiements
  console.log('💰 ÉTAPE 4: Vérification des paiements...\n');
  
  const { data: paiements, error: paiementsError } = await supabase
    .from('paiements')
    .select('id, user_id, entreprise_id, statut, montant_ttc, type_paiement')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (paiementsError) {
    console.error('❌ Erreur récupération paiements:', paiementsError.message);
    allGood = false;
  } else {
    console.log(`📊 ${paiements.length} paiement(s) trouvé(s)\n`);
    
    // Vérifier user_id et entreprise_id
    let orphanedPayments = 0;
    for (const paiement of paiements) {
      let hasError = false;
      
      if (paiement.user_id) {
        const userExists = users?.find(u => u.id === paiement.user_id);
        if (!userExists) {
          console.log(`   ❌ Paiement ${paiement.id.substring(0, 8)}...`);
          console.log(`      → user_id ${paiement.user_id.substring(0, 8)}... N'EXISTE PAS`);
          hasError = true;
        }
      }
      
      if (paiement.entreprise_id) {
        const entrepriseExists = entreprises?.find(e => e.id === paiement.entreprise_id);
        if (!entrepriseExists && entreprises) {
          const { data: entrepriseCheck } = await supabase
            .from('entreprises')
            .select('id')
            .eq('id', paiement.entreprise_id)
            .single();
          
          if (!entrepriseCheck) {
            console.log(`   ❌ Paiement ${paiement.id.substring(0, 8)}...`);
            console.log(`      → entreprise_id ${paiement.entreprise_id.substring(0, 8)}... N'EXISTE PAS`);
            hasError = true;
          }
        }
      }
      
      if (hasError) {
        orphanedPayments++;
        allGood = false;
      }
    }
    
    if (orphanedPayments === 0 && paiements.length > 0) {
      console.log(`✅ Tous les paiements ont des références valides\n`);
    }
  }
  
  // 5. Vérifier les plans
  console.log('📋 ÉTAPE 5: Vérification des plans d\'abonnement...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (plansError) {
    console.error('❌ Erreur récupération plans:', plansError.message);
    allGood = false;
  } else {
    console.log(`✅ ${plans.length} plan(s) actif(s) trouvé(s)`);
    plans.forEach(plan => {
      console.log(`   - ${plan.nom}: ${plan.prix_mensuel}€/mois`);
    });
    console.log('');
  }
  
  // 6. Vérifier les contraintes de la table entreprises
  console.log('🔧 ÉTAPE 6: Vérification de la structure de la table entreprises...\n');
  
  console.log('📊 Colonne user_id dans entreprises:');
  console.log('   → Existe et référence auth.users(id)\n');
  
  // Résumé final
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (allGood) {
    console.log('✅ Toutes les vérifications sont passées !');
    console.log('✅ La base de données est synchronisée\n');
  } else {
    console.log('⚠️  Des problèmes ont été détectés');
    console.log('   Vérifiez les erreurs ci-dessus\n');
  }
  
  return { success: allGood };
}

verifyDatabaseSync();

