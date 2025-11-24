/**
 * Script de diagnostic pour trouver où un email est utilisé dans la base de données
 * Usage: node scripts/diagnostic-email.js <email>
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function diagnosticEmail(email) {
  console.log(`\n🔍 Diagnostic de l'email: ${email}\n`);
  console.log('=' .repeat(60));
  
  try {
    // Utiliser la fonction RPC de diagnostic
    const { data, error } = await supabase.rpc('diagnostic_email', {
      p_email: email
    });
    
    if (error) {
      console.error('❌ Erreur lors du diagnostic:', error);
      return;
    }
    
    console.log('\n📊 Résultats du diagnostic:\n');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.total_occurrences === 0) {
      console.log('\n✅ Cet email n\'est utilisé nulle part dans la base de données.');
    } else {
      console.log(`\n⚠️  Cet email est utilisé dans ${data.total_occurrences} endroit(s):\n`);
      
      if (data.found_in) {
        data.found_in.forEach((occurrence, index) => {
          console.log(`${index + 1}. Table: ${occurrence.table}`);
          if (occurrence.user_id) {
            console.log(`   - user_id: ${occurrence.user_id}`);
          }
          if (occurrence.count) {
            console.log(`   - Nombre d'occurrences: ${occurrence.count}`);
          }
          console.log('');
        });
      }
      
      console.log('\n💡 Pour nettoyer cet email complètement, utilisez:');
      console.log(`   node scripts/cleanup-email.js ${email}\n`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Récupérer l'email depuis les arguments de la ligne de commande
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node scripts/diagnostic-email.js <email>');
  console.error('   Exemple: node scripts/diagnostic-email.js user@example.com');
  process.exit(1);
}

diagnosticEmail(email);

