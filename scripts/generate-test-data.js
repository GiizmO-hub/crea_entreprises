#!/usr/bin/env node

/**
 * Script de génération de données de test
 * 
 * Ce script génère des données aléatoires réalistes pour tester l'application
 * - Entreprises
 * - Clients
 * - Factures avec lignes
 * - Documents avec dossiers
 * - Collaborateurs
 * - Équipes
 * - Abonnements
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

// Données de test réalistes
const ENTREPRISES_NOMS = [
  'Tech Solutions SARL', 'Digital Agency SAS', 'Innovation Group', 
  'Smart Business', 'Pro Services', 'Expert Consulting', 'Global Corp'
];

const FORMES_JURIDIQUES = ['SARL', 'SAS', 'SA', 'EURL', 'SASU', 'SNC'];

const VILLES = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg',
  'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Le Havre'
];

const NOMS_CLIENTS = [
  'Dupont', 'Martin', 'Bernard', 'Dubois', 'Thomas', 'Richard', 'Petit',
  'Robert', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre'
];

const PRENOMS_CLIENTS = [
  'Jean', 'Marie', 'Pierre', 'François', 'Michel', 'Philippe', 'André',
  'Sylvie', 'Catherine', 'Nathalie', 'Sophie', 'Isabelle', 'Christine'
];

const POSTES = [
  'Développeur', 'Chef de projet', 'Manager', 'Comptable', 'Commercial',
  'Responsable RH', 'Directeur', 'Consultant', 'Designer'
];

const TYPES_DOCUMENTS = [
  'contrat', 'facture', 'devis', 'note', 'rapport', 'fiche_paie', 'autre'
];

const STATUTS_FACTURES = ['brouillon', 'envoyee', 'en_attente', 'payee'];

// Fonction pour générer un SIRET aléatoire
function generateSIRET() {
  const siren = Math.floor(100000000 + Math.random() * 900000000);
  const nic = Math.floor(1000 + Math.random() * 9000);
  return `${siren}${nic}`;
}

// Fonction pour générer un email aléatoire
function generateEmail(nom, prenom) {
  const domains = ['gmail.com', 'outlook.com', 'yahoo.fr', 'hotmail.com', 'protonmail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${prenom.toLowerCase()}.${nom.toLowerCase()}${Math.floor(Math.random() * 100)}@${domain}`;
}

// Fonction pour générer un téléphone aléatoire
function generatePhone() {
  const prefixes = ['06', '07', '01', '02', '03', '04', '05', '09'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${number}`;
}

// Fonction pour générer un mot de passe
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + 'A1!';
}

// Fonction pour obtenir une date aléatoire
function randomDate(start = new Date(2024, 0, 1), end = new Date()) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Fonction pour formater une date PostgreSQL
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Fonction pour formater une date/heure PostgreSQL
function formatDateTime(date) {
  return date.toISOString();
}

// Fonction pour obtenir l'URL de connexion PostgreSQL
function getPostgresConnection() {
  // Essayer d'utiliser SUPABASE_DB_URL si fourni directement
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    console.log('✅ URL PostgreSQL trouvée dans .env');
    return dbUrl;
  }

  // Sinon, essayer de construire depuis les variables individuelles
  const dbHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST || 'aws-0-eu-central-1.pooler.supabase.com';
  const dbPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '6543';
  const dbName = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const dbUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;

  if (dbHost && dbPassword) {
    console.log('✅ Informations PostgreSQL trouvées dans .env');
    return `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  throw new Error('❌ Impossible de trouver les informations de connexion PostgreSQL. Vérifiez votre fichier .env');
}

async function generateTestData() {
  const dbUrl = getPostgresConnection();

  console.log('🔧 Connexion à la base de données...');
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // Récupérer l'ID du super admin
    console.log('👤 Recherche du super admin...');
    const adminResult = await client.query(`
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin' 
      LIMIT 1
    `);

    if (adminResult.rows.length === 0) {
      console.error('❌ Aucun super admin trouvé. Veuillez créer un compte super admin d\'abord.');
      process.exit(1);
    }

    const superAdminId = adminResult.rows[0].id;
    console.log(`✅ Super admin trouvé: ${superAdminId}\n`);

    // Générer des entreprises
    console.log('🏢 Génération de 5 entreprises...');
    const entrepriseIds = [];
    for (let i = 0; i < 5; i++) {
      const nom = ENTREPRISES_NOMS[Math.floor(Math.random() * ENTREPRISES_NOMS.length)];
      const formeJuridique = FORMES_JURIDIQUES[Math.floor(Math.random() * FORMES_JURIDIQUES.length)];
      const siret = generateSIRET();
      const ville = VILLES[Math.floor(Math.random() * VILLES.length)];
      const email = generateEmail(nom.replace(/\s/g, ''), 'contact');

      const result = await client.query(`
        INSERT INTO entreprises (
          user_id, nom, forme_juridique, siret, adresse, code_postal, ville, pays,
          telephone, email, date_creation, statut
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        superAdminId,
        nom,
        formeJuridique,
        siret,
        `${Math.floor(Math.random() * 200)} Rue de la ${ville}`,
        String(Math.floor(10000 + Math.random() * 90000)),
        ville,
        'France',
        generatePhone(),
        email,
        formatDate(randomDate()),
        'active'
      ]);

      entrepriseIds.push(result.rows[0].id);
      console.log(`  ✅ Entreprise créée: ${nom} (${result.rows[0].id})`);
    }
    console.log(`\n✅ ${entrepriseIds.length} entreprises créées\n`);

    // Générer des clients pour chaque entreprise
    console.log('👥 Génération de 20 clients (4 par entreprise)...');
    const clientIds = [];
    for (const entrepriseId of entrepriseIds) {
      for (let i = 0; i < 4; i++) {
        const nom = NOMS_CLIENTS[Math.floor(Math.random() * NOMS_CLIENTS.length)];
        const prenom = PRENOMS_CLIENTS[Math.floor(Math.random() * PRENOMS_CLIENTS.length)];
        const email = generateEmail(nom, prenom);
        const ville = VILLES[Math.floor(Math.random() * VILLES.length)];

        const result = await client.query(`
          INSERT INTO clients (
            entreprise_id, nom, prenom, email, telephone, ville, statut
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          entrepriseId,
          nom,
          prenom,
          email,
          generatePhone(),
          ville,
          'actif'
        ]);

        clientIds.push({ id: result.rows[0].id, entreprise_id: entrepriseId, email });
        console.log(`  ✅ Client créé: ${prenom} ${nom} (${result.rows[0].id})`);
      }
    }
    console.log(`\n✅ ${clientIds.length} clients créés\n`);

    // Générer des factures
    console.log('📄 Génération de 50 factures...');
    let factureCount = 0;
    for (const clientData of clientIds) {
      // Générer 2-3 factures par client
      const nbFactures = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < nbFactures && factureCount < 50; i++) {
        const numero = `FACT-${String(factureCount + 1).padStart(3, '0')}`;
        const statut = STATUTS_FACTURES[Math.floor(Math.random() * STATUTS_FACTURES.length)];
        const dateEmission = randomDate();
        const montantHT = Math.floor(100 + Math.random() * 9900);
        const tauxTVA = [0.2, 0.1, 0.055, 0.021][Math.floor(Math.random() * 4)];
        const montantTVA = Math.round(montantHT * tauxTVA * 100) / 100;
        const montantTTC = montantHT + montantTVA;

        const factureResult = await client.query(`
          INSERT INTO factures (
            entreprise_id, client_id, numero, date_emission, date_echeance,
            montant_ht, montant_tva, montant_ttc, statut, type, taux_tva
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          clientData.entreprise_id,
          clientData.id,
          numero,
          formatDate(dateEmission),
          formatDate(new Date(dateEmission.getTime() + 30 * 24 * 60 * 60 * 1000)),
          montantHT,
          montantTVA,
          montantTTC,
          statut,
          'facture',
          tauxTVA
        ]);

        const factureId = factureResult.rows[0].id;

        // Ajouter 2-4 lignes par facture
        const nbLignes = Math.floor(Math.random() * 3) + 2;
        const produits = ['Prestation développement', 'Conseil', 'Formation', 'Support', 'Licence logiciel'];
        
        let totalHTLignes = 0;
        for (let j = 0; j < nbLignes; j++) {
          const description = produits[Math.floor(Math.random() * produits.length)];
          const quantite = Math.floor(Math.random() * 10) + 1;
          const prixUnitaire = Math.floor(50 + Math.random() * 950);
          const tauxTVALigne = tauxTVA;
          const montantHTLigne = quantite * prixUnitaire;
          const montantTVALigne = Math.round(montantHTLigne * tauxTVALigne * 100) / 100;
          const montantTTCLigne = montantHTLigne + montantTVALigne;
          
          totalHTLignes += montantHTLigne;

          await client.query(`
            INSERT INTO facture_lignes (
              facture_id, description, quantite, prix_unitaire, taux_tva,
              montant_ht, montant_tva, montant_ttc
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            factureId,
            description,
            quantite,
            prixUnitaire,
            tauxTVALigne,
            montantHTLigne,
            montantTVALigne,
            montantTTCLigne
          ]);
        }

        factureCount++;
        console.log(`  ✅ Facture créée: ${numero} (${factureId}) - ${nbLignes} lignes`);
      }
    }
    console.log(`\n✅ ${factureCount} factures créées avec lignes\n`);

    // Générer des documents
    console.log('📁 Génération de 30 documents...');
    let docCount = 0;
    for (const clientData of clientIds) {
      // Générer 1-2 documents par client
      const nbDocs = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < nbDocs && docCount < 30; i++) {
        const type = TYPES_DOCUMENTS[Math.floor(Math.random() * TYPES_DOCUMENTS.length)];
        const nom = `${type}_${clientData.id}_${docCount + 1}.pdf`;

        await client.query(`
          INSERT INTO documents (
            entreprise_id, client_id, nom, description, categorie, type_fichier,
            taille, chemin_fichier, url, mime_type, date_document, statut
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          clientData.entreprise_id,
          clientData.id,
          nom,
          `Document ${type} généré automatiquement`,
          type,
          'application/pdf',
          Math.floor(50000 + Math.random() * 500000),
          `documents/${clientData.entreprise_id}/${nom}`,
          `https://storage.example.com/${nom}`,
          'application/pdf',
          formatDate(randomDate()),
          'actif'
        ]);

        docCount++;
        console.log(`  ✅ Document créé: ${nom}`);
      }
    }
    console.log(`\n✅ ${docCount} documents créés\n`);

    // Générer des collaborateurs
    console.log('👨‍💼 Génération de 15 collaborateurs...');
    const collaborateurIds = [];
    const roles = ['collaborateur', 'admin', 'manager', 'comptable', 'commercial'];
    
    for (const entrepriseId of entrepriseIds) {
      // Générer 3 collaborateurs par entreprise
      for (let i = 0; i < 3; i++) {
        const nom = NOMS_CLIENTS[Math.floor(Math.random() * NOMS_CLIENTS.length)];
        const prenom = PRENOMS_CLIENTS[Math.floor(Math.random() * PRENOMS_CLIENTS.length)];
        const email = generateEmail(nom, prenom);
        const role = roles[Math.floor(Math.random() * roles.length)];
        const poste = POSTES[Math.floor(Math.random() * POSTES.length)];

        // Créer l'utilisateur auth.users
        let userId = crypto.randomUUID();
        const password = generatePassword();

        try {
          await client.query(`
            INSERT INTO auth.users (
              id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
              confirmation_token, recovery_token, email_change_token_new, email_change,
              last_sign_in_at, confirmed_at
            ) VALUES ($1, $2, $3, $4, $5, crypt($6, gen_salt('bf')), NOW(),
              '{"provider":"email","providers":["email"]}', $7, NOW(), NOW(),
              '', '', '', '', NOW(), NOW())
          `, [
            userId,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            email,
            password,
            JSON.stringify({ nom, prenom, role })
          ]);
        } catch (error) {
          // Ignorer si l'utilisateur existe déjà, récupérer l'ID
          console.log(`  ⚠️ Utilisateur ${email} existe déjà, récupération de l'ID...`);
          const existingUser = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
          } else {
            console.log(`  ⚠️ Impossible de créer ou récupérer l'utilisateur ${email}, passage au suivant...`);
            continue;
          }
        }

        const result = await client.query(`
          INSERT INTO collaborateurs (
            user_id, entreprise_id, email, role, nom, prenom, poste, statut
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          userId,
          entrepriseId,
          email,
          role,
          nom,
          prenom,
          poste,
          'active'
        ]);

        collaborateurIds.push({ id: result.rows[0].id, entreprise_id: entrepriseId });
        console.log(`  ✅ Collaborateur créé: ${prenom} ${nom} (${role})`);
      }
    }
    console.log(`\n✅ ${collaborateurIds.length} collaborateurs créés\n`);

    // Générer des équipes
    console.log('👥 Génération de 5 équipes...');
    const equipeIds = [];
    for (let i = 0; i < 5 && i < collaborateurIds.length; i++) {
      const collab = collaborateurIds[i];
      const nomEquipe = `Équipe ${i + 1}`;

      const result = await client.query(`
        INSERT INTO equipes (
          nom, description, responsable_id, entreprise_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        nomEquipe,
        `Équipe de test générée automatiquement`,
        collab.id,
        collab.entreprise_id
      ]);

      const equipeId = result.rows[0].id;
      equipeIds.push(equipeId);

      // Ajouter 2-3 membres à l'équipe
      const membresCount = Math.min(3, collaborateurIds.length - i);
      for (let j = 0; j < membresCount; j++) {
        const membre = collaborateurIds[(i + j) % collaborateurIds.length];
        if (membre.entreprise_id === collab.entreprise_id) {
          await client.query(`
            INSERT INTO collaborateurs_equipes (equipe_id, collaborateur_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [equipeId, membre.id]);
        }
      }

      console.log(`  ✅ Équipe créée: ${nomEquipe} (${equipeId}) avec ${membresCount} membres`);
    }
    console.log(`\n✅ ${equipeIds.length} équipes créées\n`);

    console.log('\n✅✅✅ GÉNÉRATION DE DONNÉES DE TEST TERMINÉE ✅✅✅\n');
    console.log('📊 RÉSUMÉ:');
    console.log(`  - ${entrepriseIds.length} entreprises`);
    console.log(`  - ${clientIds.length} clients`);
    console.log(`  - ${factureCount} factures avec lignes`);
    console.log(`  - ${docCount} documents`);
    console.log(`  - ${collaborateurIds.length} collaborateurs`);
    console.log(`  - ${equipeIds.length} équipes\n`);

  } catch (error) {
    console.error('\n❌ ERREUR lors de la génération des données de test:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Déconnexion de la base de données');
  }
}

// Exécuter le script
generateTestData().catch((error) => {
  console.error('❌ Échec de la génération des données de test:', error);
  process.exit(1);
});

