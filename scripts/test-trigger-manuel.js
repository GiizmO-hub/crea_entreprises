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

async function testTrigger() {
  const dbUrl = getPostgresConnection();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Trouver un paiement payé récent
    const { rows: paiements } = await client.query(`
      SELECT 
        p.id,
        p.entreprise_id,
        p.statut,
        p.created_at,
        (SELECT COUNT(*) FROM factures WHERE entreprise_id = p.entreprise_id) as nb_factures,
        (SELECT COUNT(*) FROM abonnements a 
         WHERE a.client_id IN (
           SELECT au.id FROM auth.users au
           WHERE au.email IN (
             SELECT c.email FROM clients c WHERE c.entreprise_id = p.entreprise_id LIMIT 1
           )
         )) as nb_abonnements,
        (SELECT COUNT(*) FROM espaces_membres_clients WHERE entreprise_id = p.entreprise_id) as nb_espaces
      FROM paiements p
      WHERE p.statut = 'paye'
        AND p.entreprise_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1;
    `);
    
    if (paiements.length === 0) {
      console.log('❌ Aucun paiement payé trouvé. Créez d\'abord une entreprise avec un plan.');
      return;
    }
    
    const p = paiements[0];
    console.log('📋 Paiement trouvé:');
    console.log(`   ID: ${p.id}`);
    console.log(`   Entreprise: ${p.entreprise_id}`);
    console.log(`   Statut: ${p.statut}`);
    console.log(`   Date: ${p.created_at}`);
    console.log(`   Factures: ${p.nb_factures}`);
    console.log(`   Abonnements: ${p.nb_abonnements}`);
    console.log(`   Espaces membres: ${p.nb_espaces}\n`);
    
    // Si rien n'a été créé, forcer la création
    if (p.nb_factures === 0 || p.nb_abonnements === 0 || p.nb_espaces === 0) {
      console.log('⚠️  Génération manuelle nécessaire...\n');
      
      // Appeler directement la fonction
      const { rows: result } = await client.query(`
        SELECT creer_facture_et_abonnement_apres_paiement($1::uuid) as result;
      `, [p.id]);
      
      console.log('📊 Résultat:');
      const res = result[0].result;
      console.log(JSON.stringify(res, null, 2));
      
      if (res.success) {
        console.log('\n✅ Création réussie !');
        console.log(`   Facture: ${res.facture_id}`);
        console.log(`   Abonnement: ${res.abonnement_id}`);
        console.log(`   Espace membre: ${res.espace_membre_id}`);
      } else {
        console.log('\n❌ Erreur:', res.error);
      }
    } else {
      console.log('✅ Tout a déjà été créé !');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testTrigger();




