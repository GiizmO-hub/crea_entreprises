#!/usr/bin/env node

/**
 * Script pour tester directement la création de l'entreprise de test
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });
config({ path: join(projectRoot, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non configuré');
  process.exit(1);
}

async function testCreateEntreprise() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie\n');

    // Lire le script SQL
    const sqlFile = join(projectRoot, 'supabase', 'migrations', '20250201000004_create_test_entreprise_complete.sql');
    const sqlContent = readFileSync(sqlFile, 'utf-8');

    console.log('📄 Exécution du script de création d\'entreprise de test...\n');

    // Exécuter le script
    await client.query(sqlContent);

    console.log('\n✅ Script exécuté avec succès !\n');

    // Vérifier que l'entreprise a été créée
    const result = await client.query(`
      SELECT 
        e.id,
        e.nom,
        e.statut,
        e.statut_paiement,
        COUNT(DISTINCT c.id) as nb_clients,
        COUNT(DISTINCT f.id) as nb_factures,
        COUNT(DISTINCT col.id) as nb_collaborateurs,
        COUNT(DISTINCT s.id) as nb_stock_items
      FROM entreprises e
      LEFT JOIN clients c ON c.entreprise_id = e.id
      LEFT JOIN factures f ON f.entreprise_id = e.id
      LEFT JOIN collaborateurs_entreprise col ON col.entreprise_id = e.id
      LEFT JOIN stock_items s ON s.entreprise_id = e.id
      WHERE e.nom = 'SAS TEST'
      GROUP BY e.id, e.nom, e.statut, e.statut_paiement;
    `);

    if (result.rows.length > 0) {
      const entreprise = result.rows[0];
      console.log('═══════════════════════════════════════');
      console.log('✅ ENTREPRISE DE TEST CRÉÉE AVEC SUCCÈS');
      console.log('═══════════════════════════════════════');
      console.log(`ID: ${entreprise.id}`);
      console.log(`Nom: ${entreprise.nom}`);
      console.log(`Statut: ${entreprise.statut}`);
      console.log(`Statut paiement: ${entreprise.statut_paiement}`);
      console.log(`Clients: ${entreprise.nb_clients}`);
      console.log(`Factures: ${entreprise.nb_factures}`);
      console.log(`Collaborateurs: ${entreprise.nb_collaborateurs}`);
      console.log(`Articles de stock: ${entreprise.nb_stock_items}`);
      console.log('═══════════════════════════════════════\n');
    } else {
      console.log('⚠️  L\'entreprise n\'a pas été trouvée après l\'exécution');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('\nℹ️  L\'entreprise existe peut-être déjà. Vérification...\n');
      
      const checkResult = await client.query(`
        SELECT id, nom, statut FROM entreprises WHERE nom = 'SAS TEST';
      `);
      
      if (checkResult.rows.length > 0) {
        console.log('✅ L\'entreprise "SAS TEST" existe déjà:');
        console.log(`   ID: ${checkResult.rows[0].id}`);
        console.log(`   Statut: ${checkResult.rows[0].statut}\n`);
      }
    }
  } finally {
    await client.end();
  }
}

testCreateEntreprise();

