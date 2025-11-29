import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnosticClient() {
  console.log('🔍 Diagnostic pour groupemclem@gmail.com\n');
  
  try {
    // 1. Trouver l'utilisateur dans auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erreur liste users:', usersError);
      return;
    }
    
    const user = users.users.find(u => u.email === 'groupemclem@gmail.com');
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé dans auth.users');
      return;
    }
    
    console.log('✅ Utilisateur trouvé:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role (raw_user_meta_data):', user.user_metadata?.role);
    console.log('   Créé le:', user.created_at);
    console.log('');
    
    // 2. Vérifier espaces_membres_clients
    const { data: espaces, error: espacesError } = await supabase
      .from('espaces_membres_clients')
      .select('*, entreprises(*), clients(*)')
      .eq('user_id', user.id);
    
    if (espacesError) {
      console.error('❌ Erreur espaces:', espacesError);
      return;
    }
    
    console.log('📦 Espaces membres clients:', espaces?.length || 0);
    
    if (espaces && espaces.length > 0) {
      espaces.forEach((espace, idx) => {
        console.log(`\n   Espace ${idx + 1}:`);
        console.log('   - ID:', espace.id);
        console.log('   - Actif:', espace.actif);
        console.log('   - Entreprise:', espace.entreprises?.nom);
        console.log('   - Client:', espace.clients?.nom, espace.clients?.prenom);
        console.log('   - Modules actifs:', JSON.stringify(espace.modules_actifs, null, 2));
      });
    } else {
      console.log('   ⚠️ Aucun espace membre trouvé pour cet utilisateur');
    }
    
    console.log('');
    
    // 3. Vérifier clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'groupemclem@gmail.com');
    
    if (clientsError) {
      console.error('❌ Erreur clients:', clientsError);
      return;
    }
    
    console.log('👤 Clients avec cet email:', clients?.length || 0);
    
    if (clients && clients.length > 0) {
      clients.forEach((client, idx) => {
        console.log(`\n   Client ${idx + 1}:`);
        console.log('   - ID:', client.id);
        console.log('   - Nom:', client.nom, client.prenom);
        console.log('   - Entreprise ID:', client.entreprise_id);
      });
    }
    
    console.log('');
    
    // 4. Vérifier utilisateurs (table publique)
    const { data: utilisateurs, error: utilisateursError } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('email', 'groupemclem@gmail.com');
    
    if (utilisateursError) {
      console.error('❌ Erreur utilisateurs:', utilisateursError);
      return;
    }
    
    console.log('👥 Utilisateurs (table publique):', utilisateurs?.length || 0);
    
    if (utilisateurs && utilisateurs.length > 0) {
      utilisateurs.forEach((utilisateur, idx) => {
        console.log(`\n   Utilisateur ${idx + 1}:`);
        console.log('   - ID:', utilisateur.id);
        console.log('   - Email:', utilisateur.email);
        console.log('   - Role:', utilisateur.role);
        console.log('   - Is Protected:', utilisateur.is_protected);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

diagnosticClient();
