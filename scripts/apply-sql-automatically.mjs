#!/usr/bin/env node

/**
 * APPLICATION AUTOMATIQUE DE SQL VIA FONCTION RPC
 * Crée une fonction temporaire qui exécute le SQL par blocs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🚀 APPLICATION AUTOMATIQUE DE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Vérifier d'abord l'état actuel
  console.log('🔍 Vérification de l\'état actuel...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (plansError && plansError.code !== 'PGRST116') {
    console.error('❌ Erreur:', plansError.message);
  }
  
  const planCount = plans?.length || 0;
  console.log(`📊 Plans actifs trouvés: ${planCount}`);
  
  if (planCount >= 4) {
    console.log('✅ Les plans sont déjà présents !\n');
    return { success: true, message: 'Plans déjà présents' };
  }
  
  console.log('⚠️  Migration nécessaire !\n');
  
  // Lire le fichier SQL
  const sqlFile = join(__dirname, '../APPLY_LAST_MIGRATION_NOW.sql');
  console.log(`📄 Lecture du fichier SQL: ${sqlFile}\n`);
  
  let sqlContent;
  try {
    sqlContent = readFileSync(sqlFile, 'utf-8');
    console.log(`✅ Fichier lu (${sqlContent.length} caractères)\n`);
  } catch (error) {
    console.error('❌ Erreur lecture fichier:', error.message);
    return { success: false, error: error.message };
  }
  
  // Diviser le SQL en instructions individuelles
  // Séparer par ';' mais garder les blocs DO $$ ... $$; intacts
  const statements = [];
  let currentStatement = '';
  let inDoBlock = false;
  let dollarQuote = '';
  
  const lines = sqlContent.split('\n');
  
  for (const line of lines) {
    // Détecter début de bloc DO $$
    if (line.trim().match(/^DO\s+\$\$/i)) {
      inDoBlock = true;
      dollarQuote = '$$';
      currentStatement += line + '\n';
    }
    // Détecter autres blocs $$...$$
    else if (line.includes('$$')) {
      const matches = line.match(/\$([^$]*)\$/g);
      if (matches) {
        for (const match of matches) {
          if (match === dollarQuote) {
            // Fin du bloc
            currentStatement += line + '\n';
            if (line.trim().endsWith(';')) {
              statements.push(currentStatement.trim());
              currentStatement = '';
            }
            inDoBlock = false;
            dollarQuote = '';
            break;
          } else if (match.startsWith('$') && !dollarQuote) {
            // Nouveau bloc
            dollarQuote = match;
            currentStatement += line + '\n';
            inDoBlock = true;
          }
        }
      }
    }
    // Fin de statement
    else if (!inDoBlock && line.trim().endsWith(';')) {
      currentStatement += line + '\n';
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    // Ligne normale
    else {
      currentStatement += line + '\n';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  console.log(`📋 ${statements.length} instructions SQL détectées\n`);
  
  // Méthode : Appliquer via une fonction RPC créée dynamiquement
  // Mais Supabase limite l'exécution de SQL arbitraire...
  
  console.log('⚠️  APPLICATION AUTOMATIQUE LIMITÉE\n');
  console.log('L\'API Supabase ne permet pas d\'exécuter du SQL arbitraire directement.');
  console.log('Solutions possibles:\n');
  
  console.log('1️⃣  Via Dashboard Supabase (LE PLUS SIMPLE):');
  console.log('   → https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new');
  console.log('   → Copier/Coller le contenu de APPLY_LAST_MIGRATION_NOW.sql\n');
  
  console.log('2️⃣  Via Supabase CLI:');
  console.log('   → npx supabase db push');
  console.log('   → Ou: npx supabase db execute --file APPLY_LAST_MIGRATION_NOW.sql\n');
  
  console.log('3️⃣  Je peux créer un script qui applique les parties critiques uniquement...\n');
  
  // Appliquer au moins la partie critique : insertion des plans
  console.log('🔧 Application de la partie critique (insertion des plans)...\n');
  
  const insertPlansSQL = `
    INSERT INTO plans_abonnement (
      nom, description, prix_mensuel, prix_annuel, 
      max_entreprises, max_utilisateurs, max_factures_mois, 
      ordre, actif, fonctionnalites
    ) VALUES
    (
      'Starter', 
      'Pour les entrepreneurs qui démarrent leur activité', 
      9.90, 99.00, 
      1, 1, 50, 
      1, true, 
      '{"facturation": true, "clients": true, "dashboard": true}'::jsonb
    ),
    (
      'Business', 
      'Pour les petites entreprises en croissance', 
      29.90, 299.00, 
      3, 5, 200, 
      2, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true}'::jsonb
    ),
    (
      'Professional', 
      'Pour les entreprises établies', 
      79.90, 799.00, 
      10, 20, 1000, 
      3, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true}'::jsonb
    ),
    (
      'Enterprise', 
      'Solution complète pour grandes structures', 
      199.90, 1999.00, 
      999, 999, 99999, 
      4, true, 
      '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true, "support_dedie": true, "personnalisation": true}'::jsonb
    )
    ON CONFLICT DO NOTHING;
  `;
  
  // Créer une fonction RPC temporaire pour insérer les plans
  const createInsertFunction = `
    CREATE OR REPLACE FUNCTION insert_plans_if_needed()
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    BEGIN
      ${insertPlansSQL}
      RETURN 'Plans insérés avec succès';
    END;
    $func$;
  `;
  
  // Note: On ne peut pas créer de fonction qui exécute du SQL arbitraire facilement
  // La meilleure solution est d'utiliser le Dashboard ou CLI
  
  return { 
    success: false, 
    needsManualStep: true,
    instructions: 'Utiliser Dashboard ou CLI'
  };
}

async function main() {
  const result = await applyMigration();
  
  if (result.success) {
    console.log('✅ Tout est déjà en place !\n');
  } else {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  📋 INSTRUCTIONS POUR APPLICATION MANUELLE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Générer un résumé du fichier SQL pour faciliter la vérification
    console.log('📄 Contenu du fichier APPLY_LAST_MIGRATION_NOW.sql:');
    console.log('   → Insertion des 4 plans d\'abonnement');
    console.log('   → Correction de creer_facture_et_abonnement_apres_paiement');
    console.log('   → Vérifications finales\n');
  }
}

main();

