/**
 * Script de diagnostic complet pour l'administrateur principal
 * Vérifie la configuration de meddecyril@icloud.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnosticComplet() {
  console.log('\n🔍 === DIAGNOSTIC COMPLET ADMIN PRINCIPAL ===\n');

  try {
    // 1. Vérifier la fonction de diagnostic
    console.log('1️⃣ Vérification via fonction diagnostic_admin_principal()...');
    const { data: diagnosticData, error: diagnosticError } = await supabase.rpc('diagnostic_admin_principal');
    
    if (diagnosticError) {
      console.error('❌ Erreur lors du diagnostic:', diagnosticError);
    } else {
      console.log('✅ Résultat du diagnostic:');
      console.log(JSON.stringify(diagnosticData, null, 2));
    }

    // 2. Vérifier is_platform_super_admin
    console.log('\n2️⃣ Vérification is_platform_super_admin()...');
    const { data: isPlatformAdmin, error: platformError } = await supabase.rpc('is_platform_super_admin');
    
    if (platformError) {
      console.error('❌ Erreur:', platformError);
    } else {
      console.log(`✅ is_platform_super_admin: ${isPlatformAdmin}`);
    }

    // 3. Vérifier get_current_user_role
    console.log('\n3️⃣ Vérification get_current_user_role()...');
    const { data: roleData, error: roleError } = await supabase.rpc('get_current_user_role');
    
    if (roleError) {
      console.error('❌ Erreur:', roleError);
    } else {
      console.log('✅ Rôle actuel:');
      console.log(JSON.stringify(roleData, null, 2));
    }

    console.log('\n✅ === DIAGNOSTIC TERMINÉ ===\n');
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

// Lancer le diagnostic
diagnosticComplet();




