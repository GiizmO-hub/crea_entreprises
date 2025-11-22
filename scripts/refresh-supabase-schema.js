#!/usr/bin/env node

/**
 * Script pour forcer le rafraîchissement du cache de schéma Supabase
 * en vérifiant que toutes les colonnes existent
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyDocumentsTable() {
  console.log('🔍 Vérification de la table documents...\n');

  try {
    // Vérifier que la table existe en essayant de lire une colonne
    const { data, error } = await supabase
      .from('documents')
      .select('id, nom, chemin_fichier, categorie, type_fichier, taille, tags, date_document, date_expiration, statut, created_by, created_at, updated_at')
      .limit(1);

    if (error) {
      console.error('❌ Erreur lors de la vérification:', error.message);
      
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        console.error('\n⚠️  Le cache de schéma Supabase n\'est pas à jour.');
        console.error('💡 Solutions:');
        console.error('   1. Attendez 30-60 secondes et réessayez');
        console.error('   2. Rafraîchissez la page dans votre navigateur');
        console.error('   3. Déconnectez-vous et reconnectez-vous à l\'application');
        console.error('   4. Vérifiez dans Supabase Dashboard > Table Editor que la table documents existe avec toutes les colonnes');
      }
      return false;
    }

    console.log('✅ Table documents vérifiée avec succès!');
    console.log('✅ Toutes les colonnes sont présentes dans le schéma.\n');
    
    // Afficher les colonnes disponibles
    if (data && data.length === 0) {
      console.log('ℹ️  La table est vide (normal si vous n\'avez pas encore ajouté de documents)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Rafraîchissement du cache de schéma Supabase\n');
  
  const success = await verifyDocumentsTable();
  
  if (success) {
    console.log('✅ Le schéma est correct. Vous pouvez maintenant utiliser le module Documents.');
  } else {
    console.log('\n⚠️  Si le problème persiste, exécutez cette requête dans Supabase SQL Editor:');
    console.log('\nSELECT column_name, data_type, is_nullable');
    console.log('FROM information_schema.columns');
    console.log("WHERE table_name = 'documents'");
    console.log("ORDER BY ordinal_position;\n");
  }
}

main().catch(console.error);

