import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listClientsWithEnterprises() {
  console.log('🔍 Recherche des clients avec entreprises...\n');
  
  try {
    // Récupérer tous les espaces membres clients avec leurs entreprises
    const { data: espaces, error } = await supabase
      .from('espaces_membres_clients')
      .select(`
        id,
        user_id,
        entreprise_id,
        client_id,
        actif,
        entreprises:entreprises!inner (
          id,
          nom,
          email,
          statut
        ),
        clients:clients!inner (
          id,
          email,
          nom,
          prenom
        )
      `)
      .eq('actif', true);
    
    if (error) {
      console.error('❌ Erreur:', error);
      return;
    }
    
    if (!espaces || espaces.length === 0) {
      console.log('⚠️ Aucun espace membre client trouvé');
      return;
    }
    
    console.log(`✅ ${espaces.length} espace(s) membre(s) client trouvé(s)\n`);
    
    espaces.forEach((espace, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 Client ${index + 1}:`);
      console.log(`   ID Espace: ${espace.id}`);
      console.log(`   User ID: ${espace.user_id || 'NON ASSIGNÉ'}`);
      console.log(`   Email Client: ${espace.clients?.email || 'N/A'}`);
      console.log(`   Nom: ${espace.clients?.prenom || ''} ${espace.clients?.nom || ''}`);
      console.log(`   Entreprise: ${espace.entreprises?.nom || 'N/A'}`);
      console.log(`   Entreprise ID: ${espace.entreprise_id}`);
      console.log(`   Statut: ${espace.actif ? '✅ Actif' : '❌ Inactif'}`);
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Pour tester l\'espace client, connectez-vous avec l\'email d\'un client listé ci-dessus.');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

listClientsWithEnterprises();
