import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDeleteEntreprise() {
  try {
    console.log('🧪 TEST DE SUPPRESSION D\'ENTREPRISE\n');
    console.log('='.repeat(80));

    // 1. Créer une entreprise de test
    console.log('\n📝 Étape 1: Création d\'une entreprise de test...');
    const { data: testUser } = await supabase.auth.admin.listUsers();
    if (!testUser || testUser.users.length === 0) {
      console.error('❌ Aucun utilisateur trouvé pour le test');
      return;
    }
    
    const userId = testUser.users[0].id;
    console.log(`   Utilisateur de test: ${userId}`);

    const { data: entreprise, error: err1 } = await supabase
      .from('entreprises')
      .insert({
        nom: 'TEST SUPPRESSION',
        user_id: userId,
        forme_juridique: 'SARL',
        capital: 1000,
        adresse_siege: 'Test',
        code_postal: '00000',
        ville: 'Test'
      })
      .select()
      .single();

    if (err1 || !entreprise) {
      console.error('❌ Erreur création entreprise:', err1);
      return;
    }

    const entrepriseId = entreprise.id;
    console.log(`   ✅ Entreprise créée: ${entrepriseId}`);

    // 2. Vérifier que l'entreprise existe
    console.log('\n📝 Étape 2: Vérification de l\'existence...');
    const { data: check1 } = await supabase
      .from('entreprises')
      .select('id')
      .eq('id', entrepriseId)
      .single();

    if (!check1) {
      console.error('❌ Entreprise non trouvée après création');
      return;
    }
    console.log('   ✅ Entreprise trouvée');

    // 3. Tester la suppression
    console.log('\n📝 Étape 3: Test de suppression...');
    const { data: result, error: err2 } = await supabase.rpc('delete_entreprise_complete', {
      p_entreprise_id: entrepriseId
    });

    if (err2) {
      console.error('❌ Erreur lors de la suppression:', err2);
      console.error('   Message:', err2.message);
      console.error('   Code:', err2.code);
      console.error('   Details:', err2.details);
      return;
    }

    if (!result || !result.success) {
      console.error('❌ Suppression échouée:', result);
      return;
    }

    console.log('   ✅ Suppression réussie!');
    console.log('   Message:', result.message);

    // 4. Vérifier que l'entreprise a bien été supprimée
    console.log('\n📝 Étape 4: Vérification de la suppression...');
    const { data: check2 } = await supabase
      .from('entreprises')
      .select('id')
      .eq('id', entrepriseId)
      .single();

    if (check2) {
      console.error('❌ L\'entreprise existe encore après suppression!');
      return;
    }
    console.log('   ✅ Entreprise supprimée avec succès');

    console.log('\n✅ TEST RÉUSSI ! La suppression fonctionne correctement.\n');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error(error.stack);
  }
}

testDeleteEntreprise();


