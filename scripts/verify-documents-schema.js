#!/usr/bin/env node

/**
 * Script pour vérifier et afficher le schéma réel de la table documents
 */

import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;

async function verifyDocumentsSchema() {
  console.log('🔍 Vérification du schéma réel de la table documents...\n');

  try {
    // Construire l'URL de connexion PostgreSQL
    if (!supabaseUrl || !dbPassword) {
      console.error('❌ Variables d\'environnement manquantes');
      process.exit(1);
    }

    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectId) {
      console.error('❌ Impossible d\'extraire le project ID de l\'URL Supabase');
      process.exit(1);
    }

    const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
    
    const client = new Client({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    console.log('✅ Connecté à PostgreSQL\n');

    // Vérifier toutes les colonnes de la table documents
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'documents'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Colonnes de la table documents:\n');
    if (result.rows.length === 0) {
      console.log('❌ La table documents n\'existe pas!\n');
    } else {
      result.rows.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name}`);
        console.log(`   Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
        console.log(`   Nullable: ${col.is_nullable}`);
        console.log(`   Défaut: ${col.column_default || 'NULL'}`);
        console.log('');
      });

      // Vérifier spécifiquement si "type" existe
      const hasType = result.rows.some(r => r.column_name === 'type');
      const hasTypeFichier = result.rows.some(r => r.column_name === 'type_fichier');

      if (hasType) {
        console.log('⚠️  ATTENTION: La colonne "type" existe encore!\n');
        console.log('💡 Solution: La migration doit être réexécutée pour supprimer cette colonne.\n');
      } else if (hasTypeFichier) {
        console.log('✅ La colonne "type" n\'existe pas, seule "type_fichier" existe.\n');
      } else {
        console.log('⚠️  ATTENTION: Aucune colonne type_fichier trouvée!\n');
      }
    }

    // Vérifier les contraintes
    const constraints = await client.query(`
      SELECT 
        constraint_name,
        constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' 
      AND table_name = 'documents';
    `);

    console.log('🔒 Contraintes de la table documents:');
    if (constraints.rows.length > 0) {
      constraints.rows.forEach(constraint => {
        console.log(`   - ${constraint.constraint_name} (${constraint.constraint_type})`);
      });
    } else {
      console.log('   Aucune contrainte trouvée');
    }

    await client.end();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

verifyDocumentsSchema().catch(console.error);




