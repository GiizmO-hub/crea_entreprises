#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL manquante');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connecté\n');
    
    // Extraire la définition complète
    const query = `
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY oid DESC
      LIMIT 1;
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ Fonction non trouvée');
      return;
    }
    
    let definition = result.rows[0].definition;
    
    // Sauvegarder la version originale
    writeFileSync('fonction-originale.sql', definition);
    console.log('📄 Version originale sauvegardée dans fonction-originale.sql\n');
    
    // Chercher et corriger toutes les occurrences de v_paiement.facture_id
    const lines = definition.split('\n');
    const problematicLines = [];
    
    lines.forEach((line, index) => {
      if (line.includes('v_paiement.facture_id')) {
        problematicLines.push({ line: index + 1, content: line.trim() });
      }
    });
    
    if (problematicLines.length > 0) {
      console.log('❌ Lignes problématiques trouvées:\n');
      problematicLines.forEach(({ line, content }) => {
        console.log(`   Ligne ${line}: ${content.substring(0, 80)}...`);
      });
      
      // Corriger : remplacer v_paiement.facture_id par une requête via paiement_id
      console.log('\n🔧 Correction en cours...\n');
      
      // Remplacer toutes les occurrences
      definition = definition.replace(
        /WHERE id = v_paiement\.facture_id/g,
        'WHERE paiement_id = p_paiement_id'
      );
      
      // Autres patterns possibles
      definition = definition.replace(
        /v_paiement\.facture_id/g,
        '(SELECT id FROM factures WHERE paiement_id = p_paiement_id LIMIT 1)'
      );
      
      // Appliquer la correction
      console.log('📋 Application de la fonction corrigée...\n');
      await client.query(definition);
      console.log('✅ Fonction corrigée et appliquée !\n');
      
      // Sauvegarder la version corrigée
      writeFileSync('fonction-corrigee.sql', definition);
      console.log('📄 Version corrigée sauvegardée dans fonction-corrigee.sql\n');
      
    } else {
      console.log('✅ Aucune référence à v_paiement.facture_id trouvée');
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

main();

