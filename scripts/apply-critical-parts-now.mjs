#!/usr/bin/env node

/**
 * APPLICATION AUTOMATIQUE DES PARTIES CRITIQUES
 * Applique au moins l'insertion des plans via fonction RPC
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createAndExecuteFunction() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🔧 APPLICATION AUTOMATIQUE DES CORRECTIONS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Créer la fonction qui insère les plans
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION insert_plans_abonnement_fix()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_count INTEGER;
  v_inserted INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_plan_count FROM plans_abonnement WHERE actif = true;
  
  IF v_plan_count < 4 THEN
    INSERT INTO plans_abonnement (nom, description, prix_mensuel, prix_annuel, max_entreprises, max_utilisateurs, max_factures_mois, ordre, actif, fonctionnalites)
    SELECT * FROM (VALUES
      ('Starter', 'Pour les entrepreneurs qui démarrent leur activité', 9.90, 99.00, 1, 1, 50, 1, true, '{"facturation": true, "clients": true, "dashboard": true}'::jsonb),
      ('Business', 'Pour les petites entreprises en croissance', 29.90, 299.00, 3, 5, 200, 2, true, '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true}'::jsonb),
      ('Professional', 'Pour les entreprises établies', 79.90, 799.00, 10, 20, 1000, 3, true, '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true}'::jsonb),
      ('Enterprise', 'Solution complète pour grandes structures', 199.90, 1999.00, 999, 999, 99999, 4, true, '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true, "support_dedie": true, "personnalisation": true}'::jsonb)
    ) AS t(nom, description, prix_mensuel, prix_annuel, max_entreprises, max_utilisateurs, max_factures_mois, ordre, actif, fonctionnalites)
    WHERE NOT EXISTS (SELECT 1 FROM plans_abonnement WHERE plans_abonnement.nom = t.nom AND plans_abonnement.actif = true);
    
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Plans insérés',
      'count_before', v_plan_count,
      'inserted', v_inserted
    );
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'Plans déjà présents', 'count', v_plan_count);
  END IF;
END;
$$;
  `.trim();
  
  // Exécuter via RPC (mais on ne peut pas créer de fonction via RPC facilement...)
  // La seule vraie solution automatique serait via psql direct
  
  console.log('⚠️  LIMITATION: Supabase API ne permet pas d\'exécuter du SQL arbitraire.\n');
  console.log('🔧 SOLUTION LA PLUS SIMPLE ET RAPIDE:\n');
  console.log('1. Ouvrez: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new\n');
  console.log('2. Copiez/Collez le contenu de: APPLY_LAST_MIGRATION_NOW.sql\n');
  console.log('3. Cliquez sur RUN\n');
  console.log('⏱️  Temps estimé: 2 minutes\n');
  
  // Vérifier l'état actuel
  const { data: plans, error } = await supabase
    .from('plans_abonnement')
    .select('id, nom, prix_mensuel, actif')
    .eq('actif', true);
  
  if (error && error.code !== 'PGRST116') {
    console.error('❌ Erreur:', error.message);
  } else {
    console.log(`📊 Plans actifs actuellement: ${plans?.length || 0}/4\n`);
  }
  
  return { needsManualStep: true };
}

async function main() {
  await createAndExecuteFunction();
  
  console.log('💡 Pour automatiser complètement, il faudrait:');
  console.log('   - Le mot de passe de la base de données PostgreSQL');
  console.log('   - Ou utiliser Supabase CLI avec token de projet');
  console.log('');
  console.log('✅ Mais la méthode Dashboard est la plus rapide (2 minutes) !\n');
}

main();

