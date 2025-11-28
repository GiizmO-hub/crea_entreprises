#!/usr/bin/env node
/**
 * Script pour vérifier que les modules sont bien activés pour les clients
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifierModules() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 VÉRIFICATION DES MODULES CLIENTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Récupérer tous les espaces clients actifs
    const { data: espaces, error } = await supabase
      .from('espaces_membres_clients')
      .select('id, user_id, modules_actifs, entreprise_id, client:clients(id, nom, prenom, email)')
      .eq('actif', true);

    if (error) throw error;

    if (!espaces || espaces.length === 0) {
      console.log('⚠️  Aucun espace client actif trouvé');
      return;
    }

    console.log(`✅ ${espaces.length} espace(s) client(s) trouvé(s)\n`);

    // Vérifier les modules pour chaque client
    let totalClients = 0;
    let avecDocuments = 0;
    let avecCollaborateurs = 0;
    let avecGestionEquipe = 0;
    let avecGestionProjets = 0;

    for (const espace of espaces) {
      totalClients++;
      const modules = espace.modules_actifs || {};

      // Vérifier chaque module avec différentes variantes de noms
      const hasDocuments = modules.documents === true || 
                          modules['gestion-documents'] === true || 
                          modules['gestion_de_documents'] === true;
      
      const hasCollaborateurs = modules.collaborateurs === true || 
                                modules['gestion-collaborateurs'] === true;
      
      const hasGestionEquipe = modules['gestion-equipe'] === true || 
                               modules['gestion_equipe'] === true || 
                               modules['gestion-d-equipe'] === true;
      
      const hasGestionProjets = modules['gestion-projets'] === true || 
                                modules['gestion_projets'] === true || 
                                modules['gestion-de-projets'] === true;

      if (hasDocuments) avecDocuments++;
      if (hasCollaborateurs) avecCollaborateurs++;
      if (hasGestionEquipe) avecGestionEquipe++;
      if (hasGestionProjets) avecGestionProjets++;

      const client = espace.client;
      const clientName = client ? `${client.prenom || ''} ${client.nom || ''}`.trim() || client.email : 'Inconnu';
      
      console.log(`👤 ${clientName}:`);
      console.log(`   📄 Documents: ${hasDocuments ? '✅' : '❌'}`);
      console.log(`   👥 Collaborateurs: ${hasCollaborateurs ? '✅' : '❌'}`);
      console.log(`   🛡️  Gestion Équipe: ${hasGestionEquipe ? '✅' : '❌'}`);
      console.log(`   📦 Gestion Projets: ${hasGestionProjets ? '✅' : '❌'}`);
      console.log('');
    }

    // Résumé
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total clients: ${totalClients}`);
    console.log(`✅ Avec Documents: ${avecDocuments}/${totalClients} (${Math.round(avecDocuments/totalClients*100)}%)`);
    console.log(`✅ Avec Collaborateurs: ${avecCollaborateurs}/${totalClients} (${Math.round(avecCollaborateurs/totalClients*100)}%)`);
    console.log(`✅ Avec Gestion Équipe: ${avecGestionEquipe}/${totalClients} (${Math.round(avecGestionEquipe/totalClients*100)}%)`);
    console.log(`✅ Avec Gestion Projets: ${avecGestionProjets}/${totalClients} (${Math.round(avecGestionProjets/totalClients*100)}%)`);
    console.log('\n✅ Vérification terminée !\n');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

verifierModules();

