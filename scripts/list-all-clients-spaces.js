/**
 * Script pour lister tous les clients et leurs espaces membres
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllClientsAndSpaces() {
  console.log('\n📋 LISTE DE TOUS LES CLIENTS ET LEURS ESPACES\n');
  console.log('='.repeat(70));

  try {
    // Récupérer tous les clients avec leurs espaces
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        nom,
        prenom,
        email,
        entreprise_id,
        espaces_membres_clients (
          id,
          user_id,
          abonnement_id,
          modules_actifs,
          actif
        )
      `)
      .limit(50);

    if (clientsError) {
      console.error('❌ Erreur:', clientsError.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ Aucun client trouvé');
      return;
    }

    console.log(`\n✅ ${clients.length} client(s) trouvé(s):\n`);

    clients.forEach((client, idx) => {
      console.log(`[${idx + 1}] ${client.nom || ''} ${client.prenom || ''}`);
      console.log(`    Email: ${client.email || 'N/A'}`);
      console.log(`    Client ID: ${client.id}`);
      console.log(`    Entreprise ID: ${client.entreprise_id}`);

      if (client.espaces_membres_clients && client.espaces_membres_clients.length > 0) {
        client.espaces_membres_clients.forEach((espace, espIdx) => {
          console.log(`\n    📦 Espace ${espIdx + 1}:`);
          console.log(`        ID: ${espace.id}`);
          console.log(`        User ID: ${espace.user_id || 'NON DÉFINI'}`);
          console.log(`        Abonnement ID: ${espace.abonnement_id || 'NON DÉFINI'}`);
          console.log(`        Actif: ${espace.actif}`);
          
          if (espace.modules_actifs) {
            const modules = espace.modules_actifs;
            const modulesActifs = Object.keys(modules).filter(key => {
              const val = modules[key];
              return val === true || val === 'true' || val === 1;
            });
            console.log(`        📦 Modules actifs: ${modulesActifs.length}`);
            if (modulesActifs.length > 0) {
              modulesActifs.forEach(m => console.log(`           - ${m}`));
            } else {
              console.log(`           ⚠️ AUCUN MODULE ACTIF`);
            }
          } else {
            console.log(`        ⚠️ modules_actifs est vide`);
          }
        });
      } else {
        console.log(`    ⚠️ PAS D'ESPACE MEMBRE`);
      }

      console.log('\n' + '-'.repeat(70) + '\n');
    });

  } catch (error) {
    console.error('\n❌ Erreur:', error);
  }
}

listAllClientsAndSpaces();

