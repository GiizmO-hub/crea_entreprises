import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceRoleKey || !databaseUrl) {
  console.error('❌ Variables d\'environnement manquantes !');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRoleKey);
  console.error('   DATABASE_URL:', !!databaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyMigration() {
  console.log('');
  console.log('====================================================');
  console.log('  🔧 CORRECTION WORKFLOW 40%');
  console.log('====================================================');
  console.log('');
  
  try {
    // Lire le fichier de migration
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250129000001_fix_workflow_40_percent_complete.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Lecture de la migration...');
    console.log('   Fichier:', migrationPath);
    console.log('');
    
    // Appliquer la migration via RPC (si disponible) ou via requête SQL directe
    console.log('🔄 Application de la migration...');
    
    // Méthode 1: Via Supabase Management API (si disponible)
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: migrationSQL
      });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Migration appliquée via RPC exec_sql');
    } catch (rpcError) {
      // Méthode 2: Via une requête directe PostgreSQL (nécessite DATABASE_URL)
      console.log('⚠️  RPC exec_sql non disponible, utilisation de pg directement...');
      
      const { default: pg } = await import('pg');
      const { Client } = pg;
      
      const client = new Client({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      await client.connect();
      console.log('✅ Connexion à la base de données établie');
      
      // Exécuter la migration
      await client.query(migrationSQL);
      console.log('✅ Migration appliquée avec succès !');
      
      await client.end();
    }
    
    console.log('');
    console.log('====================================================');
    console.log('  ✅ MIGRATION APPLIQUÉE AVEC SUCCÈS');
    console.log('====================================================');
    console.log('');
    console.log('📋 CORRECTIONS APPLIQUÉES :');
    console.log('');
    console.log('   1. ✅ Fonction creer_facture_et_abonnement_apres_paiement recréée');
    console.log('      → Utilise correctement auth.users.id pour client_id dans abonnements');
    console.log('      → Crée facture, abonnement, espace membre avec droits admin');
    console.log('');
    console.log('   2. ✅ Fonction valider_paiement_carte_immediat recréée');
    console.log('      → Appelle TOUJOURS creer_facture_et_abonnement_apres_paiement');
    console.log('      → Garantit la création automatique complète après paiement');
    console.log('');
    console.log('🎯 RÉSULTAT :');
    console.log('   → Le workflow ne devrait plus s\'arrêter à 40%');
    console.log('   → La création automatique (facture, abonnement, espace client) se fera après chaque paiement');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERREUR lors de l\'application de la migration :');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('');
    
    if (error.message?.includes('permission denied')) {
      console.error('💡 SOLUTION :');
      console.error('   → Vérifiez que DATABASE_URL pointe vers la bonne base de données');
      console.error('   → Vérifiez que les permissions sont correctes');
      console.error('');
    }
    
    process.exit(1);
  }
}

applyMigration();

