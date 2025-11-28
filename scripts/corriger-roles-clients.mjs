#!/usr/bin/env node
/**
 * Script pour corriger les rôles des clients et les passer en client_super_admin
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function corrigerRolesClients() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔐 CORRECTION DES RÔLES CLIENTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer tous les espaces membres clients actifs
    console.log('📋 Recherche des espaces membres clients...\n');
    
    const { data: espaces, error: espacesError } = await supabase
      .from('espaces_membres_clients')
      .select('*, clients(email, nom, prenom), entreprises(id, nom)')
      .eq('statut_compte', 'actif');
    
    if (espacesError) {
      throw new Error(`Erreur récupération espaces: ${espacesError.message}`);
    }
    
    if (!espaces || espaces.length === 0) {
      console.log('✅ Aucun espace membre client trouvé\n');
      return;
    }
    
    console.log(`✅ ${espaces.length} espace(s) membre(s) trouvé(s)\n`);
    
    let updatedCount = 0;
    
    for (const espace of espaces) {
      const client = espace.clients;
      const entreprise = espace.entreprises;
      
      if (!espace.user_id) {
        console.log(`⚠️  Espace ${espace.id}: pas de user_id`);
        continue;
      }
      
      console.log(`─`.repeat(60));
      console.log(`👤 Client: ${client?.prenom || ''} ${client?.nom || ''} (${client?.email || 'N/A'})`);
      console.log(`   → Entreprise: ${entreprise?.nom || 'N/A'}`);
      console.log(`   → User ID: ${espace.user_id}`);
      
      // Vérifier le rôle actuel dans utilisateurs
      const { data: utilisateur } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('id', espace.user_id)
        .single();
      
      if (utilisateur) {
        console.log(`   → Rôle actuel: ${utilisateur.role || 'NULL'}`);
        
        if (utilisateur.role !== 'client_super_admin') {
          // Mettre à jour le rôle
          const { error: updateError } = await supabase
            .from('utilisateurs')
            .update({ 
              role: 'client_super_admin',
              updated_at: new Date().toISOString()
            })
            .eq('id', espace.user_id);
          
          if (updateError) {
            console.error(`   ❌ Erreur mise à jour rôle: ${updateError.message}`);
          } else {
            console.log(`   ✅ Rôle mis à jour: client_super_admin`);
            updatedCount++;
          }
        } else {
          console.log(`   ✅ Rôle déjà correct`);
        }
      } else {
        // Créer l'entrée dans utilisateurs
        console.log(`   ⚠️  Utilisateur non trouvé dans utilisateurs, création...`);
        
        const { error: createError } = await supabase
          .from('utilisateurs')
          .insert({
            id: espace.user_id,
            email: client?.email || '',
            nom: client?.nom || '',
            prenom: client?.prenom || '',
            role: 'client_super_admin',
            statut: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (createError) {
          console.error(`   ❌ Erreur création utilisateur: ${createError.message}`);
          
          // Essayer avec ON CONFLICT
          const { error: upsertError } = await supabase
            .from('utilisateurs')
            .upsert({
              id: espace.user_id,
              email: client?.email || '',
              nom: client?.nom || '',
              prenom: client?.prenom || '',
              role: 'client_super_admin',
              statut: 'active',
              updated_at: new Date().toISOString()
            });
          
          if (upsertError) {
            console.error(`   ❌ Erreur upsert utilisateur: ${upsertError.message}`);
          } else {
            console.log(`   ✅ Utilisateur créé/mis à jour avec rôle client_super_admin`);
            updatedCount++;
          }
        } else {
          console.log(`   ✅ Utilisateur créé avec rôle client_super_admin`);
          updatedCount++;
        }
      }
      
      // Mettre à jour aussi dans auth.users metadata
      try {
        // Utiliser une fonction RPC si disponible, sinon skip
        const { error: rpcError } = await supabase.rpc('toggle_client_super_admin', {
          p_client_id: espace.client_id,
          p_is_super_admin: true
        });
        
        if (rpcError && !rpcError.message.includes('does not exist')) {
          console.log(`   ⚠️  Fonction toggle_client_super_admin non disponible ou erreur`);
        } else if (!rpcError) {
          console.log(`   ✅ Rôle synchronisé via toggle_client_super_admin`);
        }
      } catch (e) {
        // Ignorer si la fonction n'existe pas
      }
      
      console.log('');
    }
    
    console.log('═'.repeat(60));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ ${updatedCount} client(s) mis à jour avec le rôle client_super_admin`);
    console.log('═'.repeat(60));
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ERREUR lors de la correction:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

corrigerRolesClients().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Erreur:', error);
  process.exit(1);
});

