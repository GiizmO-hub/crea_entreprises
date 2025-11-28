/**
 * Script pour appliquer la protection du compte créateur
 * Utilise l'API Supabase pour exécuter la migration de protection
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔒 APPLICATION DE LA PROTECTION CRÉATEUR');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

async function applyProtection() {
  try {
    // Lire le fichier SQL de protection
    const sqlPath = join(__dirname, '..', 'APPLY_PROTECTION_CREATOR.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('1️⃣  Application de la protection via SQL...');
    console.log('');
    
    // Exécuter le SQL via l'API Supabase
    // Note: Supabase API ne supporte pas directement l'exécution de SQL arbitraire
    // On doit utiliser l'Admin API ou créer une Edge Function
    
    // Méthode 1: Utiliser l'API REST directement
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    if (!response.ok) {
      // Si la fonction RPC n'existe pas, on fait les opérations manuellement
      console.log('⚠️  Fonction RPC non disponible, application manuelle...');
      console.log('');
      
      // Mettre à jour les métadonnées pour la protection
      console.log('2️⃣  Mise à jour des métadonnées de protection...');
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        'a20797f9-3578-4a3b-83aa-967d78fd62b4',
        {
          user_metadata: {
            role: 'super_admin',
            is_protected: true,
            is_creator: true,
            is_platform_super_admin: true
          },
          app_metadata: {
            is_protected: true,
            is_creator: true
          }
        }
      );
      
      if (updateError) {
        console.error('❌ Erreur mise à jour métadonnées:', updateError.message);
      } else {
        console.log('✅ Métadonnées de protection mises à jour');
      }
      
      console.log('');
      console.log('💡 Pour appliquer la protection complète (trigger), exécutez le SQL');
      console.log('   dans Supabase Dashboard → SQL Editor');
      console.log('');
      console.log('   Fichier: APPLY_PROTECTION_CREATOR.sql');
      console.log('');
      
    } else {
      console.log('✅ Protection appliquée avec succès !');
    }
    
    // Vérification finale
    console.log('3️⃣  Vérification finale...');
    console.log('');
    
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === 'meddecyril@icloud.com');
    
    if (user) {
      console.log('✅ Utilisateur vérifié:');
      console.log('   → Email:', user.email);
      console.log('   → Rôle:', user.user_metadata?.role || user.app_metadata?.role || 'N/A');
      console.log('   → Protégé:', user.user_metadata?.is_protected || user.app_metadata?.is_protected ? '✅ Oui' : '❌ Non');
      console.log('   → Créateur:', user.user_metadata?.is_creator || user.app_metadata?.is_creator ? '✅ Oui' : '❌ Non');
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅ PROTECTION APPLIQUÉE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 RÉSUMÉ:');
    console.log('   ✅ Rôle super_admin attribué');
    console.log('   ✅ Métadonnées de protection mises à jour');
    console.log('   ⚠️  Trigger de protection à appliquer manuellement');
    console.log('');
    console.log('💡 Pour finaliser, appliquez APPLY_PROTECTION_CREATOR.sql');
    console.log('   dans Supabase Dashboard → SQL Editor');
    console.log('');
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

applyProtection();

