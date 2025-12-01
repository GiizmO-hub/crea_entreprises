#!/usr/bin/env node

/**
 * Script pour vérifier la structure de la table parametres_documents
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

async function checkTable() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Vérifier si la table existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'parametres_documents'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('❌ La table parametres_documents n\'existe pas');
      console.log('   La migration doit être appliquée\n');
      return;
    }

    console.log('✅ La table parametres_documents existe\n');

    // Récupérer toutes les colonnes
    const columns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'parametres_documents'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colonnes de la table:');
    console.log('═══════════════════════════════════════════════════════════');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Vérifier les colonnes problématiques
    const columnNames = columns.rows.map(r => r.column_name);
    const oldColumns = ['afficher_adresse', 'afficher_nom_entreprise', 'afficher_contact', 'afficher_siret', 'logo_taille', 'couleur_principale', 'police_titre', 'taille_titre', 'mentions_legales'];
    const newColumns = ['show_entreprise_adresse', 'show_entreprise_nom', 'show_entreprise_contact', 'show_entreprise_siret', 'logo_size', 'primary_color', 'header_font', 'header_font_size', 'footer_text'];

    const hasOldColumns = oldColumns.some(col => columnNames.includes(col));
    const hasNewColumns = newColumns.some(col => columnNames.includes(col));

    if (hasOldColumns && !hasNewColumns) {
      console.log('⚠️  PROBLÈME DÉTECTÉ:');
      console.log('   La table utilise les anciens noms de colonnes (français)');
      console.log('   Il faut recréer la table avec les nouveaux noms (anglais)\n');
      console.log('💡 SOLUTION:');
      console.log('   1. Supprimer la table existante');
      console.log('   2. Réappliquer la migration\n');
    } else if (hasNewColumns) {
      console.log('✅ La table utilise les bons noms de colonnes (anglais)');
      console.log('   La migration est correctement appliquée !\n');
    } else {
      console.log('⚠️  Structure inconnue\n');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

checkTable().catch(console.error);

