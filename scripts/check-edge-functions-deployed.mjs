import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEdgeFunctions() {
  try {
    console.log('🔍 VÉRIFICATION DES EDGE FUNCTIONS\n');
    console.log('='.repeat(80));
    
    // 1. Vérifier que le dossier existe
    const fs = await import('fs');
    const path = await import('path');
    const functionsDir = path.join(__dirname, '..', 'supabase', 'functions');
    
    console.log('\n📁 Vérification des fichiers Edge Functions locaux:');
    if (!fs.existsSync(functionsDir)) {
      console.error('❌ Dossier supabase/functions non trouvé');
      return;
    }
    
    const functions = fs.readdirSync(functionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`   ✅ Dossier trouvé: ${functionsDir}`);
    console.log(`   📋 Fonctions trouvées: ${functions.join(', ')}`);
    
    if (!functions.includes('create-stripe-checkout')) {
      console.error('❌ create-stripe-checkout n\'est pas dans le dossier functions');
      return;
    }
    
    // 2. Vérifier le fichier index.ts
    const indexPath = path.join(functionsDir, 'create-stripe-checkout', 'index.ts');
    if (!fs.existsSync(indexPath)) {
      console.error(`❌ Fichier index.ts non trouvé: ${indexPath}`);
      return;
    }
    console.log(`   ✅ Fichier index.ts trouvé`);
    
    // 3. Tester l'appel à l'Edge Function
    console.log('\n🧪 TEST D\'APPEL À L\'EDGE FUNCTION:');
    console.log('-'.repeat(80));
    
    // Créer un utilisateur de test pour l'auth
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123'
    }).catch(() => ({ data: { session: null } }));
    
    if (!session) {
      console.log('   ⚠️  Création d\'une session de test...');
      // Essayer avec un utilisateur existant ou créer un token de test
    }
    
    // Essayer d'appeler l'Edge Function
    console.log('   📞 Tentative d\'appel à create-stripe-checkout...');
    
    const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        paiement_id: '00000000-0000-0000-0000-000000000000', // ID de test
        success_url: 'http://localhost:5173/success',
        cancel_url: 'http://localhost:5173/cancel',
      },
    });
    
    if (error) {
      console.log('   ❌ Erreur lors de l\'appel:');
      console.log(`      Message: ${error.message}`);
      console.log(`      Status: ${error.status}`);
      
      if (error.message.includes('Function not found') || error.message.includes('404')) {
        console.log('\n💡 SOLUTION: L\'Edge Function n\'est pas déployée.');
        console.log('   Déployez-la avec:');
        console.log('   supabase functions deploy create-stripe-checkout\n');
      } else if (error.message.includes('Failed to fetch')) {
        console.log('\n💡 SOLUTION: Problème de connexion réseau ou Edge Function non accessible.');
        console.log('   Vérifiez:');
        console.log('   1. Que l\'Edge Function est déployée');
        console.log('   2. Les secrets sont configurés dans Supabase Dashboard\n');
      }
      return;
    }
    
    console.log('   ✅ Edge Function accessible!');
    console.log(`   Réponse: ${JSON.stringify(data, null, 2)}`);
    
    console.log('\n✅ TOUTES LES VÉRIFICATIONS RÉUSSIES\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

checkEdgeFunctions();


