#!/usr/bin/env node

/**
 * Script pour vérifier si des entreprises existent dans la base de données
 * pour un utilisateur spécifique
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
const envPath = path.join(__dirname, '..', '.env');
let SUPABASE_URL, DB_PASSWORD;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
        SUPABASE_URL = value;
      }
      if (key === 'SUPABASE_DB_PASSWORD') {
        DB_PASSWORD = value;
      }
    }
  });
}

SUPABASE_URL = SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
DB_PASSWORD = DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

const USER_ID = '060d7ec6-9307-4f6d-b85f-c89712774212'; // ID de l'utilisateur depuis les logs

// Extraire le project ref
const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Format d\'URL invalide');
  process.exit(1);
}

const projectRef = urlMatch[1];
const dbHost = `db.${projectRef}.supabase.co`;

async function checkEnterprises() {
  const client = new Client({
    host: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Vérifier les entreprises pour cet utilisateur
    console.log(`🔍 Recherche des entreprises pour user_id: ${USER_ID}\n`);
    
    const entreprisesResult = await client.query(`
      SELECT 
        id,
        nom,
        user_id,
        statut,
        statut_paiement,
        created_at,
        forme_juridique,
        email,
        telephone
      FROM entreprises
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [USER_ID]);

    console.log(`📊 Nombre d'entreprises trouvées: ${entreprisesResult.rows.length}\n`);

    if (entreprisesResult.rows.length > 0) {
      console.log('✅ Entreprises trouvées:\n');
      entreprisesResult.rows.forEach((ent, idx) => {
        console.log(`${idx + 1}. ${ent.nom}`);
        console.log(`   ID: ${ent.id}`);
        console.log(`   Statut: ${ent.statut}`);
        console.log(`   Statut paiement: ${ent.statut_paiement || 'NULL'}`);
        console.log(`   Forme juridique: ${ent.forme_juridique || 'NULL'}`);
        console.log(`   Créée le: ${ent.created_at}`);
        console.log(`   Email: ${ent.email || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  Aucune entreprise trouvée pour cet utilisateur\n');
      
      // Vérifier si l'utilisateur existe dans auth.users
      console.log('🔍 Vérification de l\'utilisateur dans auth.users...\n');
      const userResult = await client.query(`
        SELECT id, email, created_at, raw_user_meta_data
        FROM auth.users
        WHERE id = $1
      `, [USER_ID]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        console.log('✅ Utilisateur trouvé:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Créé le: ${user.created_at}`);
        console.log(`   Metadata: ${JSON.stringify(user.raw_user_meta_data, null, 2)}\n`);
      } else {
        console.log('❌ Utilisateur non trouvé dans auth.users\n');
      }

      // Vérifier toutes les entreprises (pour debug)
      console.log('🔍 Vérification de toutes les entreprises dans la base...\n');
      const allEntreprises = await client.query(`
        SELECT id, nom, user_id, statut, created_at
        FROM entreprises
        ORDER BY created_at DESC
        LIMIT 10
      `);

      console.log(`📊 Total d'entreprises dans la base: ${allEntreprises.rows.length}\n`);
      if (allEntreprises.rows.length > 0) {
        console.log('📋 Dernières entreprises créées:');
        allEntreprises.rows.forEach((ent, idx) => {
          console.log(`${idx + 1}. ${ent.nom} (user_id: ${ent.user_id})`);
        });
      }
    }

    // 2. Vérifier les clients associés
    if (entreprisesResult.rows.length > 0) {
      console.log('\n🔍 Recherche des clients pour ces entreprises...\n');
      
      const entrepriseIds = entreprisesResult.rows.map(e => e.id);
      const clientsResult = await client.query(`
        SELECT 
          id,
          nom,
          prenom,
          email,
          entreprise_id,
          statut,
          created_at
        FROM clients
        WHERE entreprise_id = ANY($1)
        ORDER BY created_at DESC
      `, [entrepriseIds]);

      console.log(`📊 Nombre de clients trouvés: ${clientsResult.rows.length}\n`);
      if (clientsResult.rows.length > 0) {
        clientsResult.rows.forEach((client, idx) => {
          console.log(`${idx + 1}. ${client.prenom} ${client.nom} (${client.email})`);
          console.log(`   Entreprise ID: ${client.entreprise_id}`);
          console.log(`   Statut: ${client.statut}\n`);
        });
      }
    }

    // 3. Vérifier les paiements
    if (entreprisesResult.rows.length > 0) {
      console.log('\n🔍 Recherche des paiements pour ces entreprises...\n');
      
      const entrepriseIds = entreprisesResult.rows.map(e => e.id);
      const paiementsResult = await client.query(`
        SELECT 
          id,
          entreprise_id,
          statut,
          methode_paiement,
          montant_ttc,
          created_at,
          date_paiement
        FROM paiements
        WHERE entreprise_id = ANY($1)
        ORDER BY created_at DESC
      `, [entrepriseIds]);

      console.log(`📊 Nombre de paiements trouvés: ${paiementsResult.rows.length}\n`);
      if (paiementsResult.rows.length > 0) {
        paiementsResult.rows.forEach((paiement, idx) => {
          console.log(`${idx + 1}. Paiement ${paiement.statut} - ${paiement.montant_ttc}€`);
          console.log(`   Méthode: ${paiement.methode_paiement || 'NULL'}`);
          console.log(`   Créé le: ${paiement.created_at}`);
          if (paiement.date_paiement) {
            console.log(`   Payé le: ${paiement.date_paiement}`);
          }
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkEnterprises();


