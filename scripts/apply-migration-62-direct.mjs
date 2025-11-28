import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        SUPABASE_SERVICE_ROLE_KEY = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 APPLICATION AUTOMATIQUE DE LA MIGRATION\n');
console.log('='.repeat(80));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

// Lire la migration
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250123000062_fix_valider_paiement_carte_automatisation_complete.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Fichier migration non trouvé: ${migrationPath}`);
  process.exit(1);
}

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
console.log(`✅ Migration lue (${migrationSQL.length} caractères)\n`);

// Créer le client Supabase avec service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('📋 Application de la migration...\n');

// Exécuter la migration SQL directement
try {
  // Diviser le SQL en instructions individuelles pour mieux gérer les erreurs
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*\/\*/));

  console.log(`📝 Exécution de ${statements.length} instructions SQL...\n`);

  // Pour Supabase, on peut utiliser rpc ou exécuter directement via la connexion
  // Mais la meilleure méthode est d'exécuter tout le SQL en une fois via une fonction RPC
  // ou directement via la connexion PostgreSQL
  
  // Méthode : Utiliser une fonction RPC temporaire qui exécute le SQL
  // Ou mieux : Utiliser le endpoint SQL REST API de Supabase
  
  // Pour simplifier, on va exécuter le SQL complet via une requête directe
  // Note: Supabase ne permet pas d'exécuter du SQL arbitraire via l'API REST
  // Il faut utiliser le dashboard SQL editor ou le CLI
  
  console.log('⚠️  Supabase ne permet pas l''exécution SQL directe via l''API REST');
  console.log('📋 Application manuelle requise\n');
  
  console.log('💡 OPTION 1 : Via Dashboard (RECOMMANDÉ)');
  console.log(`   1. Allez sur : ${SUPABASE_URL.replace('/rest/v1', '/sql/new')}`);
  console.log(`   2. Ouvrez : ${migrationPath}`);
  console.log('   3. Copiez le contenu');
  console.log('   4. Collez dans l''éditeur SQL');
  console.log('   5. Cliquez sur "Run"\n');
  
  console.log('💡 OPTION 2 : Via CLI');
  console.log('   cd /Users/user/Downloads/cursor');
  console.log('   export SUPABASE_ACCESS_TOKEN=sbp_cde65a8637aa3680b475cc189236b6fec950808d');
  console.log('   npx supabase db push --include-all\n');
  
  // Créer un fichier SQL prêt à copier
  const outputPath = path.join(__dirname, '..', 'APPLY_THIS_SQL.sql');
  fs.writeFileSync(outputPath, migrationSQL, 'utf8');
  
  console.log(`✅ Fichier SQL créé : ${outputPath}`);
  console.log('   Vous pouvez copier ce fichier et le coller dans Supabase Dashboard\n');

} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}


