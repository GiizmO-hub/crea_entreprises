#!/usr/bin/env node

/**
 * APPLICATION DES CORRECTIONS CRITIQUES VIA FONCTIONS RPC
 * Crée et exécute des fonctions RPC pour chaque correction
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// SQL pour créer la fonction qui insère les plans
const createInsertPlansFunction = `
CREATE OR REPLACE FUNCTION insert_plans_abonnement()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_plan_count FROM plans_abonnement WHERE actif = true;
  
  IF v_plan_count < 4 THEN
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
    
    RETURN jsonb_build_object('success', true, 'message', 'Plans insérés', 'count_before', v_plan_count);
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'Plans déjà présents', 'count', v_plan_count);
  END IF;
END;
$$;
`;

async function applyCriticalFixes() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION DES CORRECTIONS CRITIQUES');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Étape 1: Vérifier l'état actuel
  console.log('🔍 Étape 1: Vérification de l\'état actuel...\n');
  
  const { data: plans, error: plansError } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (plansError && plansError.code !== 'PGRST116') {
    console.error('❌ Erreur vérification plans:', plansError.message);
    return { success: false, error: plansError.message };
  }
  
  const planCount = plans?.length || 0;
  console.log(`📊 Plans actifs trouvés: ${planCount}`);
  
  if (planCount >= 4) {
    console.log('✅ Les plans sont déjà présents !\n');
  } else {
    console.log(`⚠️  Seulement ${planCount} plan(s) trouvé(s), migration nécessaire !\n`);
  }
  
  // Étape 2: La meilleure solution est d'utiliser le Dashboard
  // Mais on peut essayer de créer la fonction via une migration manuelle
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📋 SOLUTION RAPIDE ET EFFICACE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('🚀 Pour appliquer les corrections AUTOMATIQUEMENT:\n');
  
  console.log('1️⃣  OUVREZ CETTE URL:');
  console.log('   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  
  console.log('2️⃣  COPIEZ CE CODE SQL COMPLET:\n');
  console.log('─── DÉBUT DU CODE SQL ───');
  console.log(createInsertPlansFunction);
  console.log('─── FIN DU CODE SQL ───\n');
  
  console.log('3️⃣  PUIS EXÉCUTEZ:\n');
  console.log('   SELECT insert_plans_abonnement();\n');
  
  console.log('4️⃣  ENSUITE, APPLIQUEZ LE FICHIER COMPLET:\n');
  console.log('   Ouvrez: APPLY_LAST_MIGRATION_NOW.sql');
  console.log('   Copiez tout et exécutez dans le SQL Editor\n');
  
  return { 
    success: false, 
    needsManualStep: true,
    planCount,
    sqlFunction: createInsertPlansFunction
  };
}

async function main() {
  const result = await applyCriticalFixes();
  
  if (!result.success && result.needsManualStep) {
    console.log('\n💡 ASTUCE: Vous pouvez également utiliser Supabase CLI si installé:\n');
    console.log('   npx supabase db execute --file APPLY_LAST_MIGRATION_NOW.sql\n');
  }
}

main();

