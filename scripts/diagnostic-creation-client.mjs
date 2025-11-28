#!/usr/bin/env node
/**
 * Script de diagnostic pour la création de clients
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔍 DIAGNOSTIC CRÉATION CLIENT');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Vérifier la structure de la table clients
    console.log('📋 1. Vérification de la structure de la table clients...\n');
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'clients'
        ORDER BY ordinal_position;
      `
    }).catch(() => ({ data: null, error: { message: 'RPC exec_sql non disponible' } }));

    if (columnsError) {
      console.log('⚠️  Impossible de récupérer la structure via RPC, tentative alternative...\n');
      // Essayer de récupérer via une requête directe
      const { data: testData } = await supabase
        .from('clients')
        .select('*')
        .limit(1);
      
      if (testData) {
        console.log('✅ Table clients existe');
        console.log('   Colonnes disponibles (via SELECT *):', Object.keys(testData[0] || {}));
      }
    } else if (columns) {
      console.log('✅ Structure de la table:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(REQUIS)' : '(OPTIONNEL)'}`);
      });
    }

    console.log('');

    // 2. Vérifier les entreprises disponibles
    console.log('📋 2. Vérification des entreprises disponibles...\n');
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, user_id')
      .limit(10);

    if (entreprisesError) {
      console.error('❌ Erreur lors de la récupération des entreprises:', entreprisesError);
    } else {
      console.log(`✅ ${entreprises?.length || 0} entreprise(s) trouvée(s):`);
      entreprises?.forEach(ent => {
        console.log(`   - ${ent.nom} (ID: ${ent.id})`);
      });
    }

    console.log('');

    // 3. Test de création d'un client (simulation)
    console.log('📋 3. Test de création d\'un client (simulation)...\n');
    
    if (!entreprises || entreprises.length === 0) {
      console.log('⚠️  Aucune entreprise trouvée - impossible de créer un client');
      return;
    }

    const testEntreprise = entreprises[0];
    const testClientData = {
      entreprise_id: testEntreprise.id,
      nom: 'TEST',
      prenom: 'Diagnostic',
      email: `test-diagnostic-${Date.now()}@example.com`,
      telephone: '0100000000',
      adresse: '123 Rue Test',
      code_postal: '75001',
      ville: 'Paris',
      entreprise_nom: null,
      siret: null,
      updated_at: new Date().toISOString(),
    };

    console.log('📝 Tentative d\'insertion avec les données suivantes:');
    console.log(JSON.stringify(testClientData, null, 2));
    console.log('');

    const { data: insertResult, error: insertError } = await supabase
      .from('clients')
      .insert([testClientData])
      .select();

    if (insertError) {
      console.error('❌ ERREUR lors de l\'insertion:');
      console.error(`   Code: ${insertError.code}`);
      console.error(`   Message: ${insertError.message}`);
      console.error(`   Détails: ${insertError.details || 'N/A'}`);
      console.error(`   Hint: ${insertError.hint || 'N/A'}`);
      console.log('');
      console.log('🔍 Analyse de l\'erreur:');
      
      if (insertError.code === '42501') {
        console.log('   → Problème de permissions RLS (Row Level Security)');
        console.log('   → Vérifiez les politiques RLS sur la table clients');
      } else if (insertError.code === '23503') {
        console.log('   → Problème de clé étrangère (foreign key)');
        console.log('   → Vérifiez que entreprise_id existe dans la table entreprises');
      } else if (insertError.code === '23505') {
        console.log('   → Violation de contrainte unique');
        console.log('   → L\'email ou un autre champ unique existe déjà');
      } else if (insertError.code === '23502') {
        console.log('   → Champ requis manquant');
        console.log('   → Vérifiez tous les champs NOT NULL');
      }
    } else {
      console.log('✅ Client créé avec succès !');
      console.log('   ID:', insertResult?.[0]?.id);
      console.log('');
      console.log('🧹 Suppression du client de test...');
      
      // Supprimer le client de test
      if (insertResult?.[0]?.id) {
        await supabase
          .from('clients')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('✅ Client de test supprimé');
      }
    }

    console.log('');

    // 4. Vérifier les RLS policies
    console.log('📋 4. Vérification des politiques RLS...\n');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual
        FROM pg_policies
        WHERE tablename = 'clients';
      `
    }).catch(() => ({ data: null, error: { message: 'RPC exec_sql non disponible' } }));

    if (policiesError) {
      console.log('⚠️  Impossible de récupérer les politiques RLS via RPC');
      console.log('   → Consultez le Supabase Dashboard pour vérifier les politiques RLS');
    } else if (policies && policies.length > 0) {
      console.log('✅ Politiques RLS trouvées:');
      policies.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd}): ${policy.qual || 'N/A'}`);
      });
    } else {
      console.log('⚠️  Aucune politique RLS trouvée');
      console.log('   → Cela signifie que RLS est désactivé ou que les politiques doivent être créées');
    }

    console.log('');

    // 5. Vérifier les contraintes de la table
    console.log('📋 5. Vérification des contraintes de la table...\n');
    const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          conname AS constraint_name,
          contype AS constraint_type,
          pg_get_constraintdef(oid) AS constraint_definition
        FROM pg_constraint
        WHERE conrelid = 'public.clients'::regclass;
      `
    }).catch(() => ({ data: null, error: { message: 'RPC exec_sql non disponible' } }));

    if (constraintsError) {
      console.log('⚠️  Impossible de récupérer les contraintes via RPC');
    } else if (constraints && constraints.length > 0) {
      console.log('✅ Contraintes trouvées:');
      constraints.forEach(constraint => {
        const type = constraint.constraint_type === 'f' ? 'FOREIGN KEY' :
                     constraint.constraint_type === 'u' ? 'UNIQUE' :
                     constraint.constraint_type === 'p' ? 'PRIMARY KEY' :
                     constraint.constraint_type === 'c' ? 'CHECK' : constraint.constraint_type;
        console.log(`   - ${constraint.constraint_name} (${type})`);
      });
    }

    console.log('\n✅ Diagnostic terminé !\n');

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
    process.exit(1);
  }
}

diagnostic();

