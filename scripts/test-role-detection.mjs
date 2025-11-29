#!/usr/bin/env node

/**
 * Script de test pour vérifier la détection des rôles
 * - Vérifie si un utilisateur est détecté comme client ou Super Admin plateforme
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRoleDetection(userEmail) {
  console.log(`\n🔍 Test de détection de rôle pour: ${userEmail}\n`);
  
  // 1. Vérifier si l'utilisateur existe
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', listError);
    return;
  }
  
  const user = users.find(u => u.email === userEmail);
  if (!user) {
    console.error(`❌ Utilisateur ${userEmail} non trouvé`);
    return;
  }
  
  console.log(`✅ Utilisateur trouvé: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Rôle dans metadata: ${user.user_metadata?.role || user.app_metadata?.role || 'N/A'}`);
  
  // 2. Vérifier dans la table utilisateurs
  const { data: utilisateur, error: utilisateurError } = await supabase
    .from('utilisateurs')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  
  if (!utilisateurError && utilisateur) {
    console.log(`   Rôle dans utilisateurs: ${utilisateur.role || 'N/A'}`);
  } else {
    console.log(`   Rôle dans utilisateurs: N/A (erreur ou non trouvé)`);
  }
  
  // 3. Vérifier si l'utilisateur a un espace_membre_client
  const { data: espaceClient, error: espaceError } = await supabase
    .from('espaces_membres_clients')
    .select('id, entreprise_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (!espaceError && espaceClient) {
    console.log(`\n👤 CLIENT DÉTECTÉ`);
    console.log(`   Espace membre client: ${espaceClient.id}`);
    console.log(`   Entreprise ID: ${espaceClient.entreprise_id}`);
    console.log(`   → C'est un CLIENT (pas Super Admin plateforme)`);
    
    // Vérifier le rôle client
    const { data: roleCheck, error: roleError } = await supabase
      .rpc('check_my_super_admin_status');
    
    if (!roleError && roleCheck) {
      console.log(`   Client Super Admin: ${roleCheck ? 'OUI' : 'NON'}`);
    }
  } else {
    console.log(`\n👤 PAS DE CLIENT (pas d'espace_membre_client)`);
    console.log(`   → Peut être Super Admin plateforme`);
    
    // Vérifier si Super Admin plateforme
    const { data: isPlatformAdmin, error: platformError } = await supabase
      .rpc('is_platform_super_admin');
    
    if (!platformError) {
      console.log(`   Super Admin plateforme: ${isPlatformAdmin ? 'OUI' : 'NON'}`);
    } else {
      console.log(`   Super Admin plateforme: Erreur lors de la vérification`);
    }
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// Test avec les emails spécifiés
const emails = [
  'groupemclem@gmail.com',
  'meddecyril@icloud.com'
];

async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTS DE DÉTECTION DE RÔLES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const email of emails) {
    await testRoleDetection(email);
  }
}

runTests().catch(console.error);

