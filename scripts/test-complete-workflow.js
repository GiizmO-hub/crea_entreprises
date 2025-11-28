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

async function testWorkflow() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Trouver un paiement payé sans facture
    const { rows: paiements } = await client.query(`
      SELECT p.id, p.entreprise_id, p.statut, p.montant_ttc
      FROM paiements p
      LEFT JOIN factures f ON f.entreprise_id = p.entreprise_id AND f.created_at > p.created_at - INTERVAL '1 hour'
      WHERE p.statut = 'paye'
        AND p.entreprise_id IS NOT NULL
        AND f.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1;
    `);
    
    if (paiements.length === 0) {
      console.log('ℹ️ Aucun paiement payé sans facture trouvé (peut-être déjà traité)\n');
      
      // Vérifier les paiements récents
      const { rows: allPaiements } = await client.query(`
        SELECT p.id, p.entreprise_id, p.statut, p.created_at,
          (SELECT COUNT(*) FROM factures f WHERE f.entreprise_id = p.entreprise_id) as nb_factures,
          (SELECT COUNT(*) FROM abonnements a WHERE a.client_id IN (
            SELECT id FROM auth.users WHERE email IN (
              SELECT email FROM clients WHERE entreprise_id = p.entreprise_id LIMIT 1
            ) LIMIT 1
          )) as nb_abonnements
        FROM paiements p
        WHERE p.statut = 'paye'
          AND p.entreprise_id IS NOT NULL
        ORDER BY p.created_at DESC
        LIMIT 3;
      `);
      
      console.log('📋 Derniers paiements payés:');
      allPaiements.forEach(p => {
        console.log(`\n   ID: ${p.id}`);
        console.log(`   Entreprise: ${p.entreprise_id}`);
        console.log(`   Date: ${p.created_at}`);
        console.log(`   Factures: ${p.nb_factures}`);
        console.log(`   Abonnements: ${p.nb_abonnements}`);
      });
      
      return;
    }
    
    const paiement = paiements[0];
    console.log('📋 Paiement trouvé:');
    console.log(`   ID: ${paiement.id}`);
    console.log(`   Entreprise: ${paiement.entreprise_id}`);
    console.log(`   Montant: ${paiement.montant_ttc}€\n`);
    
    // Tester la fonction
    console.log('🔄 Appel de creer_facture_et_abonnement_apres_paiement...\n');
    const { rows: result } = await client.query(`
      SELECT creer_facture_et_abonnement_apres_paiement($1::uuid) as result;
    `, [paiement.id]);
    
    console.log('📊 Résultat:');
    console.log(JSON.stringify(result[0].result, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testWorkflow();
