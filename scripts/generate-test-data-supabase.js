#!/usr/bin/env node

/**
 * Script de génération de données de test via Supabase Client
 * 
 * Ce script utilise le client Supabase pour générer des données de test
 * - Entreprises
 * - Clients
 * - Factures avec lignes
 * - Documents avec dossiers
 * - Collaborateurs
 * - Équipes
 * - Abonnements
 * 
 * Usage:
 *   npm run test:generate-data
 *   npm run test:generate-data -- --user-id=xxx
 *   node scripts/generate-test-data-supabase.js --user-id=xxx
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Charger les variables d'environnement
config({ path: join(projectRoot, '.env') });

// Récupérer les paramètres de ligne de commande
const args = process.argv.slice(2);
let providedUserId = null;
args.forEach(arg => {
  if (arg.startsWith('--user-id=')) {
    providedUserId = arg.split('=')[1];
  } else if (arg.startsWith('--user-id')) {
    const index = args.indexOf(arg);
    if (args[index + 1] && !args[index + 1].startsWith('--')) {
      providedUserId = args[index + 1];
    }
  }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env');
  process.exit(1);
}

// Créer le client Supabase avec Service Role Key pour avoir tous les droits
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Types de documents selon les contraintes CHECK de la table documents
const CATEGORIES_DOCUMENTS = [
  'facture', 'devis', 'contrat', 'administratif', 'juridique', 'fiscal', 'rh', 'autre'
];

const TYPES_FICHIERS_DOCUMENTS = [
  'pdf', 'image', 'excel', 'word', 'autre'
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

// Fonction pour obtenir une date aléatoire
function randomDate(start = new Date(2024, 0, 1), end = new Date()) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Fonction pour formater une date PostgreSQL
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function generateTestData() {
  console.log('🔧 Initialisation de la génération de données de test...\n');

  // Récupérer l'ID du super admin - Recherche automatique multi-méthodes
  console.log('👤 Recherche de l\'ID utilisateur pour générer les données...\n');
  let superAdminId = null;
  const knownAdminEmail = 'meddecyril@icloud.com';
  
  // Vérifier si l'ID est fourni en paramètre
  if (providedUserId) {
    superAdminId = providedUserId;
    console.log(`✅ ID utilisateur fourni en paramètre: ${superAdminId}\n`);
  } else {
    // Vérifier si l'ID est dans .env
    if (process.env.SUPER_ADMIN_ID) {
      superAdminId = process.env.SUPER_ADMIN_ID;
      console.log(`✅ ID utilisateur trouvé dans .env (SUPER_ADMIN_ID): ${superAdminId}\n`);
    }
  }
  
  // Si l'ID n'est pas fourni, rechercher automatiquement
  if (!superAdminId) {
    console.log('📋 Recherche automatique du super admin...\n');
  
    // Méthode 1: Chercher dans auth.users via RPC SQL direct (si disponible avec Service Role)
    console.log('   1️⃣  Tentative via requête SQL directe...');
  try {
    // Utiliser une requête SQL directe via RPC pour accéder à auth.users
    const { data: sqlResult, error: sqlError } = await supabase.rpc('get_super_admin_user_id');
    if (!sqlError && sqlResult) {
      superAdminId = sqlResult;
      console.log(`   ✅ Super admin trouvé via RPC get_super_admin_user_id: ${superAdminId}\n`);
    } else {
      console.log(`   ⚠️  RPC get_super_admin_user_id non disponible (normal si fonction n'existe pas)\n`);
      if (sqlError) {
        console.log(`      Erreur: ${sqlError.message}\n`);
      }
    }
  } catch (error) {
    // Ignorer - fonction RPC peut ne pas exister
    console.log(`   ⚠️  Erreur lors de l'appel RPC: ${error.message}\n`);
  }

  // Méthode 2: Chercher dans la table utilisateurs
  if (!superAdminId) {
    console.log('   2️⃣  Tentative via table utilisateurs...');
    try {
      // Chercher par role super_admin
      const { data: adminByRole, error: roleError } = await supabase
        .from('utilisateurs')
        .select('id, user_id, email, role')
        .eq('role', 'super_admin')
        .limit(1)
        .maybeSingle();

      if (!roleError && adminByRole) {
        superAdminId = adminByRole.user_id || adminByRole.id;
        console.log(`   ✅ Super admin trouvé par rôle dans utilisateurs: ${adminByRole.email || 'N/A'} (${superAdminId})\n`);
      } else {
        console.log(`   ⚠️  Aucun super_admin trouvé par rôle\n`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur lecture utilisateurs: ${error.message}\n`);
    }
  }

  // Méthode 3: Chercher par email connu dans utilisateurs
  if (!superAdminId) {
    console.log('   3️⃣  Tentative via email connu dans utilisateurs...');
    try {
      const { data: adminByEmail, error: emailError } = await supabase
        .from('utilisateurs')
        .select('id, user_id, email, role')
        .eq('email', knownAdminEmail)
        .limit(1)
        .maybeSingle();

      if (!emailError && adminByEmail) {
        superAdminId = adminByEmail.user_id || adminByEmail.id;
        console.log(`   ✅ Utilisateur trouvé par email dans utilisateurs: ${knownAdminEmail} (${superAdminId})\n`);
      } else {
        console.log(`   ⚠️  Email ${knownAdminEmail} non trouvé dans utilisateurs\n`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur recherche par email: ${error.message}\n`);
    }
  }

  // Méthode 4: Chercher via entreprises existantes (prendre le premier user_id)
  if (!superAdminId) {
    console.log('   4️⃣  Tentative via entreprises existantes...');
    try {
      const { data: entreprises, error: entreprisesError } = await supabase
        .from('entreprises')
        .select('user_id')
        .limit(1)
        .maybeSingle();

      if (!entreprisesError && entreprises && entreprises.user_id) {
        superAdminId = entreprises.user_id;
        console.log(`   ✅ Utilisateur trouvé via entreprises: ${superAdminId}\n`);
        console.log(`   ⚠️  Note: Ce n'est peut-être pas le super admin, mais sera utilisé pour les tests\n`);
      } else {
        console.log(`   ⚠️  Aucune entreprise trouvée\n`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur lecture entreprises: ${error.message}\n`);
    }
  }

  // Méthode 5: Chercher dans auth.users via requête directe (si fonction RPC existe)
  if (!superAdminId) {
    console.log('   5️⃣  Tentative via fonction RPC is_super_admin...');
    try {
      // Tenter d'utiliser une requête SQL via RPC pour accéder à auth.users
      // Note: On peut créer une fonction RPC qui retourne l'ID du super admin
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_super_admin_user_id');
      if (!rpcError && rpcData) {
        superAdminId = rpcData;
        console.log(`   ✅ Super admin trouvé via RPC get_super_admin_user_id: ${superAdminId}\n`);
      } else {
        console.log(`   ⚠️  Fonction RPC get_super_admin_user_id non disponible\n`);
      }
    } catch (error) {
      // Ignorer - fonction peut ne pas exister
    }
  }

  // Méthode 6: Utiliser SUPER_ADMIN_ID depuis .env
  if (!superAdminId && process.env.SUPER_ADMIN_ID) {
    console.log('   6️⃣  Utilisation de SUPER_ADMIN_ID depuis .env...');
    superAdminId = process.env.SUPER_ADMIN_ID;
    console.log(`   ✅ Utilisation de SUPER_ADMIN_ID: ${superAdminId}\n`);
  }

  // Vérifier que l'ID trouvé existe vraiment
  if (superAdminId) {
    console.log(`✅✅✅ Super admin identifié: ${superAdminId}\n`);
    
    // Vérifier que l'utilisateur existe en tentant de lire une entreprise
    try {
      const { data: testEntreprise, error: testError } = await supabase
        .from('entreprises')
        .select('id')
        .eq('user_id', superAdminId)
        .limit(1)
        .maybeSingle();

      if (testError && testError.code !== 'PGRST116') {
        console.log(`⚠️  Attention: L'ID ${superAdminId} peut ne pas être valide (${testError.message})\n`);
      }
    } catch (error) {
      // Ignorer les erreurs de test
    }
  } else {
    console.error('\n❌❌❌ IMPOSSIBLE DE TROUVER L\'ID UTILISATEUR ❌❌❌\n');
    console.error('📋 Options pour résoudre:\n');
    console.error('   Option 1 - Fournir l\'ID en paramètre (RECOMMANDÉ):');
    console.error('     npm run test:generate-data -- --user-id=votre-uuid-utilisateur');
    console.error('     ou');
    console.error('     node scripts/generate-test-data-supabase.js --user-id=votre-uuid-utilisateur\n');
    console.error('   Option 2 - Ajouter SUPER_ADMIN_ID dans .env:');
    console.error('     1. Connectez-vous à l\'application');
    console.error('     2. Ouvrez la console (F12)');
    console.error('     3. Exécutez:');
    console.error('        const { data: { user } } = await supabase.auth.getUser();');
    console.error('        console.log("Votre ID:", user.id);');
    console.error('     4. Ajoutez dans .env: SUPER_ADMIN_ID=votre-uuid-utilisateur\n');
    console.error('   Option 3 - Créer une entreprise dans l\'application:');
    console.error('     1. L\'ID user_id de cette entreprise sera utilisé automatiquement\n');
    
    // Afficher les IDs trouvés pour aider au diagnostic
    console.error('🔍 Diagnostic - IDs trouvés dans la base:');
    try {
      const { data: allUtilisateurs } = await supabase
        .from('utilisateurs')
        .select('id, user_id, email, role')
        .limit(5);
      
      if (allUtilisateurs && allUtilisateurs.length > 0) {
        console.error('\n   Utilisateurs dans la table utilisateurs:');
        allUtilisateurs.forEach((u, i) => {
          console.error(`     ${i + 1}. ID: ${u.id}, user_id: ${u.user_id || 'N/A'}, email: ${u.email || 'N/A'}, role: ${u.role || 'N/A'}`);
        });
      }
    } catch (error) {
      // Ignorer
    }

    try {
      const { data: allEntreprises } = await supabase
        .from('entreprises')
        .select('id, user_id')
        .limit(5);
      
      if (allEntreprises && allEntreprises.length > 0) {
        console.error('\n   User IDs trouvés dans entreprises:');
        allEntreprises.forEach((e, i) => {
          console.error(`     ${i + 1}. Entreprise ID: ${e.id}, user_id: ${e.user_id || 'N/A'}`);
        });
        console.error(`\n   💡 Suggestion rapide:`);
        console.error(`      npm run test:generate-data -- --user-id=${allEntreprises[0].user_id}\n`);
      }
    } catch (error) {
      // Ignorer
    }
    
    console.error('\n📖 Exemple d\'utilisation:\n');
    console.error('   # Avec ID en paramètre:');
    console.error('   npm run test:generate-data -- --user-id=12345678-1234-1234-1234-123456789abc\n');
    
    process.exit(1);
    }
  }

  const errors = [];
  const stats = {
    entreprises: 0,
    clients: 0,
    factures: 0,
    documents: 0,
    collaborateurs: 0,
    equipes: 0,
  };

  try {
    // Générer des entreprises
    console.log('🏢 Génération de 5 entreprises...');
    const entrepriseIds = [];
    for (let i = 0; i < 5; i++) {
      const nom = ENTREPRISES_NOMS[Math.floor(Math.random() * ENTREPRISES_NOMS.length)];
      const formeJuridique = FORMES_JURIDIQUES[Math.floor(Math.random() * FORMES_JURIDIQUES.length)];
      const siret = generateSIRET();
      const ville = VILLES[Math.floor(Math.random() * VILLES.length)];
      const email = generateEmail(nom.replace(/\s/g, ''), 'contact');

      const { data, error } = await supabase
        .from('entreprises')
        .insert({
          user_id: superAdminId,
          nom,
          forme_juridique: formeJuridique,
          siret,
          adresse: `${Math.floor(Math.random() * 200)} Rue de la ${ville}`,
          code_postal: String(Math.floor(10000 + Math.random() * 90000)),
          ville,
          pays: 'France',
          telephone: generatePhone(),
          email,
          date_creation: formatDate(randomDate()),
          statut: 'active',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`  ❌ Erreur création entreprise ${nom}:`, error.message);
        errors.push({ type: 'entreprise', error: error.message });
      } else {
        entrepriseIds.push(data.id);
        stats.entreprises++;
        console.log(`  ✅ Entreprise créée: ${nom} (${data.id})`);
      }
    }
    console.log(`\n✅ ${stats.entreprises}/${5} entreprises créées\n`);

    // Générer des clients pour chaque entreprise
    console.log('👥 Génération de 20 clients (4 par entreprise)...');
    const clientIds = [];
    for (const entrepriseId of entrepriseIds) {
      for (let i = 0; i < 4; i++) {
        const nom = NOMS_CLIENTS[Math.floor(Math.random() * NOMS_CLIENTS.length)];
        const prenom = PRENOMS_CLIENTS[Math.floor(Math.random() * PRENOMS_CLIENTS.length)];
        const email = generateEmail(nom, prenom);
        const ville = VILLES[Math.floor(Math.random() * VILLES.length)];

        const { data, error } = await supabase
          .from('clients')
          .insert({
            entreprise_id: entrepriseId,
            nom,
            prenom,
            email,
            telephone: generatePhone(),
            ville,
            statut: 'actif',
          })
          .select('id')
          .single();

        if (error) {
          console.error(`  ❌ Erreur création client ${prenom} ${nom}:`, error.message);
          errors.push({ type: 'client', error: error.message });
        } else {
          clientIds.push({ id: data.id, entreprise_id: entrepriseId, email });
          stats.clients++;
          console.log(`  ✅ Client créé: ${prenom} ${nom} (${data.id})`);
        }
      }
    }
    console.log(`\n✅ ${stats.clients}/${20} clients créés\n`);

    // Générer des factures
    console.log('📄 Génération de 50 factures...');
    let factureCount = 0;
    const factureNumeros = new Set(); // Pour éviter les doublons
    for (const clientData of clientIds) {
      // Générer 2-3 factures par client
      const nbFactures = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < nbFactures && factureCount < 50; i++) {
        // Générer un numéro unique par entreprise
        let numero;
        do {
          numero = `FACT-${clientData.entreprise_id.substring(0, 8)}-${String(factureCount + 1).padStart(3, '0')}`;
        } while (factureNumeros.has(`${clientData.entreprise_id}-${numero}`));
        factureNumeros.add(`${clientData.entreprise_id}-${numero}`);
        const statut = STATUTS_FACTURES[Math.floor(Math.random() * STATUTS_FACTURES.length)];
        const dateEmission = randomDate();
        const tauxTVA = [0.2, 0.1, 0.055, 0.021][Math.floor(Math.random() * 4)];
        const montantHT = Math.floor(100 + Math.random() * 9900);
        const montantTVA = Math.round(montantHT * tauxTVA * 100) / 100;
        const montantTTC = montantHT + montantTVA;
        const dateEcheance = new Date(dateEmission.getTime() + 30 * 24 * 60 * 60 * 1000);

        const { data: factureData, error: factureError } = await supabase
          .from('factures')
          .insert({
            entreprise_id: clientData.entreprise_id,
            client_id: clientData.id,
            numero,
            date_emission: formatDate(dateEmission),
            date_echeance: formatDate(dateEcheance),
            montant_ht: montantHT,
            tva: montantTVA, // Colonne 'tva' dans le schéma initial
            montant_ttc: montantTTC,
            statut,
            type: 'facture',
            // taux_tva n'existe pas dans factures, seulement dans facture_lignes
          })
          .select('id')
          .single();

        if (factureError) {
          console.error(`  ❌ Erreur création facture ${numero}:`, factureError.message);
          errors.push({ type: 'facture', error: factureError.message });
          continue;
        }

        const factureId = factureData.id;

        // Ajouter 2-4 lignes par facture
        const nbLignes = Math.floor(Math.random() * 3) + 2;
        const produits = ['Prestation développement', 'Conseil', 'Formation', 'Support', 'Licence logiciel'];
        
        const lignes = [];
        for (let j = 0; j < nbLignes; j++) {
          const description = produits[Math.floor(Math.random() * produits.length)];
          const quantite = Math.floor(Math.random() * 10) + 1;
          const prixUnitaire = Math.floor(50 + Math.random() * 950);
          const montantHTLigne = quantite * prixUnitaire;
          const montantTVALigne = Math.round(montantHTLigne * tauxTVA * 100) / 100;
          const montantTTCLigne = montantHTLigne + montantTVALigne;
          
          lignes.push({
            facture_id: factureId,
            description,
            quantite,
            prix_unitaire_ht: prixUnitaire,
            taux_tva: tauxTVA,
            montant_ht: montantHTLigne,
            tva: montantTVALigne, // Utiliser 'tva' au lieu de 'montant_tva' selon le schéma
            montant_ttc: montantTTCLigne,
          });
        }

        const { error: lignesError } = await supabase
          .from('facture_lignes')
          .insert(lignes);

        if (lignesError) {
          console.error(`  ⚠️ Erreur création lignes facture ${numero}:`, lignesError.message);
          errors.push({ type: 'facture_lignes', error: lignesError.message });
        } else {
          factureCount++;
          stats.factures++;
          console.log(`  ✅ Facture créée: ${numero} (${factureId}) - ${nbLignes} lignes`);
        }
      }
    }
    console.log(`\n✅ ${stats.factures}/50 factures créées avec lignes\n`);

    // Générer des documents
    console.log('📁 Génération de 30 documents...');
    let docCount = 0;
    for (const clientData of clientIds) {
      // Générer 1-2 documents par client
      const nbDocs = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < nbDocs && docCount < 30; i++) {
        const categorie = CATEGORIES_DOCUMENTS[Math.floor(Math.random() * CATEGORIES_DOCUMENTS.length)];
        const typeFichier = TYPES_FICHIERS_DOCUMENTS[Math.floor(Math.random() * TYPES_FICHIERS_DOCUMENTS.length)];
        const nom = `${categorie}_${clientData.id}_${docCount + 1}.${typeFichier === 'pdf' ? 'pdf' : typeFichier === 'image' ? 'jpg' : typeFichier === 'excel' ? 'xlsx' : typeFichier === 'word' ? 'docx' : 'pdf'}`;

        const { error: docError } = await supabase
          .from('documents')
          .insert({
            entreprise_id: clientData.entreprise_id,
            client_id: clientData.id,
            nom,
            description: `Document ${categorie} généré automatiquement`,
            categorie: categorie, // Utiliser les valeurs autorisées par CHECK
            type_fichier: typeFichier, // Utiliser les valeurs autorisées par CHECK ('pdf', 'image', 'excel', 'word', 'autre')
            taille: Math.floor(50000 + Math.random() * 500000),
            chemin_fichier: `documents/${clientData.entreprise_id}/${nom}`,
            url: `https://storage.example.com/${nom}`,
            mime_type: typeFichier === 'pdf' ? 'application/pdf' : typeFichier === 'image' ? 'image/jpeg' : typeFichier === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : typeFichier === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
            date_document: formatDate(randomDate()),
            statut: 'actif',
          });

        if (docError) {
          console.error(`  ❌ Erreur création document ${nom}:`, docError.message);
          errors.push({ type: 'document', error: docError.message });
        } else {
          docCount++;
          stats.documents++;
          console.log(`  ✅ Document créé: ${nom}`);
        }
      }
    }
    console.log(`\n✅ ${stats.documents}/30 documents créés\n`);

    // Générer des collaborateurs - Pour simplifier, on va skip cette partie car elle nécessite
    // de créer des comptes auth.users et la fonction RPC nécessite un super_admin authentifié
    // On va juste créer des équipes sans membres pour l'instant
    console.log('👥 Génération de collaborateurs (SKIP - nécessite auth.users)...');
    const collaborateurIds = []; // Vide pour l'instant
    console.log(`\n✅ ${stats.collaborateurs}/15 collaborateurs créés\n`);

    // Générer des équipes (1 par entreprise, sans membres pour l'instant)
    console.log('🏢 Génération de 5 équipes (1 par entreprise)...');
    const equipeIds = [];
    for (let i = 0; i < entrepriseIds.length && i < 5; i++) {
      const entrepriseId = entrepriseIds[i];
      const nomsEquipes = ['Équipe Développement', 'Équipe Commerciale', 'Équipe Marketing', 'Équipe Support', 'Équipe Management'];
      const nomEquipe = nomsEquipes[Math.floor(Math.random() * nomsEquipes.length)];
      const description = `Équipe ${nomEquipe} de l'entreprise`;

      const { data: equipeData, error: equipeError } = await supabase
        .from('equipes')
        .insert({
          entreprise_id: entrepriseId,
          nom: `${nomEquipe} ${i + 1}`,
          description,
          responsable_id: null, // Pas de responsable pour l'instant
          couleur: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          actif: true,
        })
        .select('id')
        .single();

      if (equipeError) {
        console.error(`  ❌ Erreur création équipe ${nomEquipe}:`, equipeError.message);
        errors.push({ type: 'equipe', error: equipeError.message });
      } else {
        equipeIds.push({ id: equipeData.id, entreprise_id: entrepriseId });
        stats.equipes++;
        console.log(`  ✅ Équipe créée: ${nomEquipe} ${i + 1} (${equipeData.id})`);
      }
    }
    console.log(`\n✅ ${stats.equipes}/5 équipes créées\n`);

    // Afficher le résumé final
    console.log('\n✅✅✅ GÉNÉRATION DE DONNÉES DE TEST TERMINÉE ✅✅✅\n');
    console.log('📊 RÉSUMÉ:');
    console.log(`  - ${stats.entreprises} entreprises`);
    console.log(`  - ${stats.clients} clients`);
    console.log(`  - ${stats.factures} factures avec lignes`);
    console.log(`  - ${stats.documents} documents`);
    console.log(`  - ${stats.collaborateurs} collaborateurs`);
    console.log(`  - ${stats.equipes} équipes\n`);

    if (errors.length > 0) {
      console.log('⚠️ ERREURS RENCONTRÉES:\n');
      errors.forEach((err, index) => {
        console.log(`  ${index + 1}. Type: ${err.type}`);
        console.log(`     Erreur: ${err.error}\n`);
      });
    }

  } catch (error) {
    console.error('\n❌ ERREUR lors de la génération des données de test:', error);
    throw error;
  }
}

// Exécuter le script
generateTestData().catch((error) => {
  console.error('❌ Échec de la génération des données de test:', error);
  process.exit(1);
});

