#!/usr/bin/env node

/**
 * Vérification des entreprises existantes
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlozuwvrteopotfizcr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzc3MzE5MiwiZXhwIjoyMDc5MzQ5MTkyfQ.rQLpDCC0KyMdhBFMDvixKfeyRGdlLhlo_mqEeqCt0IM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkEntreprises() {
  console.log('🔍 Vérification des entreprises...\n');
  
  // Chercher l'entreprise par son ID
  const entrepriseId = '644d027e-e035-483d-9786-55c7870b15fb';
  
  const { data: entreprise, error } = await supabase
    .from('entreprises')
    .select('id, nom, statut, user_id, created_at')
    .eq('id', entrepriseId)
    .single();
  
  if (error) {
    console.log(`❌ Entreprise ${entrepriseId} non trouvée\n`);
    console.log('🔍 Recherche des entreprises récentes...\n');
    
    const { data: entreprises, error: entreprisesError } = await supabase
      .from('entreprises')
      .select('id, nom, statut, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (entreprisesError) {
      console.error('❌ Erreur:', entreprisesError.message);
      return;
    }
    
    if (entreprises && entreprises.length > 0) {
      console.log(`📋 ${entreprises.length} entreprise(s) trouvée(s):\n`);
      entreprises.forEach(e => {
        console.log(`   - ${e.id.substring(0, 8)}... | ${e.nom || 'N/A'} | ${e.statut || 'N/A'}`);
      });
      console.log('');
      
      // Chercher une entreprise liée au user_id du paiement
      console.log('🔍 Recherche d\'entreprise pour le user_id du paiement...\n');
      const userId = '060d7ec6-9307-4f6d-b85f-c89712774212';
      
      const { data: entreprisesUser } = await supabase
        .from('entreprises')
        .select('id, nom, statut, user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (entreprisesUser && entreprisesUser.length > 0) {
        console.log(`✅ ${entreprisesUser.length} entreprise(s) trouvée(s) pour ce user:\n`);
        entreprisesUser.forEach(e => {
          console.log(`   - ID: ${e.id}`);
          console.log(`     Nom: ${e.nom || 'N/A'}`);
          console.log(`     Statut: ${e.statut || 'N/A'}\n`);
        });
      } else {
        console.log('❌ Aucune entreprise trouvée pour ce user_id\n');
      }
    } else {
      console.log('❌ Aucune entreprise trouvée dans la base\n');
    }
  } else {
    console.log('✅ Entreprise trouvée:');
    console.log(`   ID: ${entreprise.id}`);
    console.log(`   Nom: ${entreprise.nom || 'N/A'}`);
    console.log(`   Statut: ${entreprise.statut || 'N/A'}`);
    console.log(`   User ID: ${entreprise.user_id || 'N/A'}\n`);
  }
}

checkEntreprises();

