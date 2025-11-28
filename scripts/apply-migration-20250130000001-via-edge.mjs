#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement la migration via Edge Function
 * 20250130000001_extend_update_client_complete_with_all_data.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_ANON_KEY non définies');
  console.error('💡 Vérifiez vos variables d\'environnement dans .env.local');
  process.exit(1);
}

async function applyMigrationViaEdgeFunction() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 APPLICATION DE LA MIGRATION VIA EDGE FUNCTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250130000001_extend_update_client_complete_with_all_data.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Fichier de migration non trouvé : ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📁 Fichier de migration lu :', migrationPath);
    console.log('📏 Taille :', (migrationSQL.length / 1024).toFixed(2), 'KB\n');
    
    // Appeler l'Edge Function
    console.log('📡 Appel de l\'Edge Function apply-migration...');
    
    // Obtenir le token d'authentification (vous devez être connecté)
    // Pour l'instant, on va essayer sans token pour voir si l'Edge Function accepte
    const response = await fetch(`${SUPABASE_URL}/functions/v1/apply-migration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        migration_name: '20250130000001_extend_update_client_complete_with_all_data',
        sql: migrationSQL,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `Erreur HTTP ${response.status}`);
    }
    
    console.log('✅ Migration appliquée avec succès !\n');
    console.log('📋 Résultat :', JSON.stringify(result, null, 2));
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'application de la migration:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\n💡 L\'Edge Function nécessite une authentification.');
      console.error('💡 Veuillez appliquer la migration manuellement via le Dashboard Supabase :');
      console.error('   1. Ouvrir Supabase Dashboard > SQL Editor');
      console.error('   2. Copier le contenu de : supabase/migrations/20250130000001_extend_update_client_complete_with_all_data.sql');
      console.error('   3. Exécuter le SQL\n');
    }
    
    process.exit(1);
  }
}

applyMigrationViaEdgeFunction();

