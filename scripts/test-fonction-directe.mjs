#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const dbClient = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await dbClient.connect();
    
    // Récupérer le vrai paiement_id
    const result = await dbClient.query(`
      SELECT id FROM paiements
      WHERE statut = 'en_attente'
      ORDER BY created_at DESC
      LIMIT 1;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Aucun paiement en attente');
      return;
    }
    
    const paiementId = result.rows[0].id;
    console.log('📋 Paiement ID:', paiementId);
    
    // Appeler directement via PostgreSQL pour voir l'erreur complète
    console.log('\n🔍 Appel direct via PostgreSQL...\n');
    
    try {
      const funcResult = await dbClient.query(`
        SELECT creer_facture_et_abonnement_apres_paiement($1) as result;
      `, [paiementId]);
      
      console.log('✅ Résultat:', JSON.stringify(funcResult.rows[0].result, null, 2));
    } catch (err) {
      console.log('❌ Erreur PostgreSQL:');
      console.log('   Message:', err.message);
      console.log('   Code:', err.code);
      console.log('   Position:', err.position);
      if (err.position) {
        // Essayer de trouver la ligne exacte
        console.log('\n   📍 L\'erreur se trouve probablement autour de la position', err.position);
      }
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await dbClient.end();
  }
}

main();

