/**
 * Script de nettoyage complet d'un email de la base de données
 * Usage: node scripts/cleanup-email.js <email>
 * 
 * ⚠️  ATTENTION: Cette opération est irréversible !
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définis dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o');
    });
  });
}

async function cleanupEmail(email) {
  console.log(`\n🧹 Nettoyage de l'email: ${email}\n`);
  console.log('=' .repeat(60));
  
  // D'abord faire un diagnostic
  console.log('\n🔍 Diagnostic préalable...\n');
  
  try {
    const { data: diagnostic, error: diagError } = await supabase.rpc('diagnostic_email', {
      p_email: email
    });
    
    if (diagError) {
      console.error('❌ Erreur lors du diagnostic:', diagError);
      return;
    }
    
    if (diagnostic.total_occurrences === 0) {
      console.log('✅ Cet email n\'est utilisé nulle part. Rien à nettoyer.\n');
      return;
    }
    
    console.log('📊 Résultats du diagnostic:');
    console.log(JSON.stringify(diagnostic, null, 2));
    console.log('\n');
    
    // Demander confirmation
    console.log('⚠️  ATTENTION: Cette opération va supprimer cet email de TOUTES les tables !');
    console.log('   Cela supprimera:');
    if (diagnostic.found_in) {
      diagnostic.found_in.forEach((occurrence) => {
        console.log(`   - ${occurrence.table}${occurrence.count ? ` (${occurrence.count} occurrence(s))` : ''}`);
      });
    }
    console.log('\n');
    
    const confirmed = await askConfirmation('❓ Êtes-vous sûr de vouloir continuer ? (oui/non): ');
    
    if (!confirmed) {
      console.log('\n❌ Opération annulée.\n');
      return;
    }
    
    // Procéder au nettoyage
    console.log('\n🧹 Nettoyage en cours...\n');
    
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_email_complete', {
      p_email: email
    });
    
    if (cleanupError) {
      console.error('❌ Erreur lors du nettoyage:', cleanupError);
      return;
    }
    
    if (cleanupResult.success) {
      console.log('✅ Nettoyage réussi !\n');
      console.log('📊 Résultats:');
      console.log(JSON.stringify(cleanupResult, null, 2));
      console.log('\n');
      
      // Vérifier que tout a été supprimé
      console.log('🔍 Vérification finale...\n');
      
      const { data: finalCheck, error: checkError } = await supabase.rpc('diagnostic_email', {
        p_email: email
      });
      
      if (!checkError && finalCheck.total_occurrences === 0) {
        console.log('✅ Vérification OK: L\'email n\'est plus utilisé nulle part.\n');
      } else if (!checkError) {
        console.log(`⚠️  Attention: L'email est encore présent dans ${finalCheck.total_occurrences} endroit(s).\n`);
        console.log(JSON.stringify(finalCheck, null, 2));
      }
      
    } else {
      console.error('❌ Échec du nettoyage:', cleanupResult.error);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer l'email depuis les arguments de la ligne de commande
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node scripts/cleanup-email.js <email>');
  console.error('   Exemple: node scripts/cleanup-email.js user@example.com');
  console.error('\n⚠️  ATTENTION: Cette opération est irréversible !');
  process.exit(1);
}

cleanupEmail(email);

