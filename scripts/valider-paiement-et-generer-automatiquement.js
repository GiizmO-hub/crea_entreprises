#!/usr/bin/env node
import { config } from 'dotenv';
import pg from 'pg';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

config({ path: join(projectRoot, '.env') });

function getPostgresConnection() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) return dbUrl;
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  
  if (supabaseUrl && dbPassword) {
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectId) {
      return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
    }
  }
  
  console.error('❌ Informations de connexion PostgreSQL manquantes');
  process.exit(1);
}

async function validerPaiement() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Trouver un paiement en attente avec entreprise
    const { rows: paiements } = await client.query(`
      SELECT p.id, p.entreprise_id, p.statut, p.montant_ttc, p.notes
      FROM paiements p
      WHERE p.entreprise_id IS NOT NULL
        AND p.statut = 'en_attente'
      ORDER BY p.created_at DESC
      LIMIT 1;
    `);
    
    if (paiements.length === 0) {
      console.log('ℹ️ Aucun paiement en attente trouvé\n');
      console.log('📋 Vérification des paiements payés...\n');
      
      // Lister les paiements payés
      const { rows: paidPaiements } = await client.query(`
        SELECT 
          p.id,
          p.entreprise_id,
          p.statut,
          p.created_at,
          (SELECT COUNT(*) FROM factures f WHERE f.entreprise_id = p.entreprise_id) as nb_factures,
          (SELECT COUNT(*) FROM abonnements a 
           WHERE a.client_id IN (
             SELECT au.id FROM auth.users au
             WHERE au.email IN (
               SELECT c.email FROM clients c WHERE c.entreprise_id = p.entreprise_id LIMIT 1
             )
           )) as nb_abonnements,
          (SELECT COUNT(*) FROM espaces_membres_clients emc
           WHERE emc.entreprise_id = p.entreprise_id) as nb_espaces
        FROM paiements p
        WHERE p.statut = 'paye'
          AND p.entreprise_id IS NOT NULL
        ORDER BY p.created_at DESC
        LIMIT 5;
      `);
      
      paidPaiements.forEach(p => {
        console.log(`\n💳 Paiement: ${p.id}`);
        console.log(`   Entreprise: ${p.entreprise_id}`);
        console.log(`   Date: ${p.created_at}`);
        console.log(`   Factures: ${p.nb_factures}`);
        console.log(`   Abonnements: ${p.nb_abonnements}`);
        console.log(`   Espaces membres: ${p.nb_espaces}`);
        
        if (p.nb_factures === 0 || p.nb_abonnements === 0 || p.nb_espaces === 0) {
          console.log(`   ⚠️  INCOMPLET - Génération manuelle nécessaire`);
        } else {
          console.log(`   ✅ COMPLET`);
        }
      });
      
      return;
    }
    
    const paiement = paiements[0];
    console.log('📋 Paiement en attente trouvé:');
    console.log(`   ID: ${paiement.id}`);
    console.log(`   Entreprise: ${paiement.entreprise_id}`);
    console.log(`   Montant: ${paiement.montant_ttc}€\n`);
    
    // Valider le paiement manuellement (simuler le webhook)
    console.log('🔄 Validation du paiement...\n');
    const { rows: result } = await client.query(`
      UPDATE paiements
      SET statut = 'paye',
          date_paiement = CURRENT_DATE,
          updated_at = now()
      WHERE id = $1
      RETURNING id;
    `, [paiement.id]);
    
    if (result.length === 0) {
      console.log('❌ Erreur lors de la validation du paiement');
      return;
    }
    
    console.log('✅ Paiement validé (le trigger devrait se déclencher automatiquement)\n');
    
    // Attendre un peu pour que le trigger s'exécute
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Vérifier ce qui a été créé
    console.log('📊 Vérification des créations...\n');
    
    const { rows: check } = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM factures WHERE entreprise_id = $1) as nb_factures,
        (SELECT COUNT(*) FROM abonnements a 
         WHERE a.client_id IN (
           SELECT au.id FROM auth.users au
           WHERE au.email IN (
             SELECT c.email FROM clients c WHERE c.entreprise_id = $1 LIMIT 1
           )
         )) as nb_abonnements,
        (SELECT COUNT(*) FROM espaces_membres_clients WHERE entreprise_id = $1) as nb_espaces;
    `, [paiement.entreprise_id]);
    
    console.log('📋 Résultats:');
    console.log(`   Factures: ${check[0].nb_factures}`);
    console.log(`   Abonnements: ${check[0].nb_abonnements}`);
    console.log(`   Espaces membres: ${check[0].nb_espaces}`);
    
    // Si rien n'a été créé, appeler manuellement la fonction
    if (check[0].nb_factures === 0) {
      console.log('\n⚠️  Le trigger ne s\'est pas déclenché. Appel manuel de la fonction...\n');
      
      const { rows: manualResult } = await client.query(`
        SELECT creer_facture_et_abonnement_apres_paiement($1::uuid) as result;
      `, [paiement.id]);
      
      console.log('📊 Résultat de l\'appel manuel:');
      console.log(JSON.stringify(manualResult[0].result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

validerPaiement();




