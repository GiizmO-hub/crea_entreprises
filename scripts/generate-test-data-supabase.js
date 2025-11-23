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

  // Récupérer l'ID du super admin
  console.log('👤 Recherche du super admin...');
  let superAdminId = null;

  // Essayer de chercher par email connu
  const knownAdminEmail = 'meddecyril@icloud.com';
  
  // Option 1: Chercher dans la table utilisateurs
  try {
    const { data: adminData, error: adminError } = await supabase
      .from('utilisateurs')
      .select('id, user_id, email')
      .or(`role.eq.super_admin,email.eq.${knownAdminEmail}`)
      .limit(1)
      .maybeSingle();

    if (!adminError && adminData) {
      superAdminId = adminData.user_id || adminData.id;
      console.log(`✅ Super admin trouvé dans utilisateurs: ${adminData.email || 'N/A'} (${superAdminId})\n`);
    }
  } catch (error) {
    console.log('⚠️ Impossible de lire utilisateurs:', error.message);
  }

  // Option 2: Chercher dans auth.users via RPC (si fonction disponible)
  if (!superAdminId) {
    try {
      // Utiliser une fonction RPC pour récupérer l'utilisateur par email
      const { data: rpcData, error: rpcError } = await supabase.rpc('is_super_admin');
      // Cette fonction n'existe peut-être pas, on continue...
    } catch (error) {
      // Ignorer
    }
  }

  // Option 3: Chercher toutes les entreprises et prendre le premier user_id
  if (!superAdminId) {
    try {
      const { data: entreprises, error: entreprisesError } = await supabase
        .from('entreprises')
        .select('user_id')
        .limit(1)
        .maybeSingle();

      if (!entreprisesError && entreprises) {
        superAdminId = entreprises.user_id;
        console.log(`✅ Utilisateur trouvé via entreprises: ${superAdminId}\n`);
      }
    } catch (error) {
      console.log('⚠️ Impossible de lire entreprises:', error.message);
    }
  }

  // Si toujours rien, demander à l'utilisateur de fournir l'ID
  if (!superAdminId) {
    console.error('❌ Impossible de trouver automatiquement le super admin.');
    console.error('💡 Options:');
    console.error('   1. Fournissez un ID d\'utilisateur en variable d\'environnement: SUPER_ADMIN_ID=xxx');
    console.error('   2. Vérifiez que l\'email meddecyril@icloud.com existe dans auth.users');
    console.error('   3. Vérifiez que la table utilisateurs contient un super_admin');
    
    // Essayer de récupérer depuis l'environnement
    if (process.env.SUPER_ADMIN_ID) {
      superAdminId = process.env.SUPER_ADMIN_ID;
      console.log(`✅ Utilisation de SUPER_ADMIN_ID depuis .env: ${superAdminId}\n`);
    } else {
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
    for (const clientData of clientIds) {
      // Générer 2-3 factures par client
      const nbFactures = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < nbFactures && factureCount < 50; i++) {
        const numero = `FACT-${String(factureCount + 1).padStart(3, '0')}`;
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
            montant_tva: montantTVA,
            montant_ttc: montantTTC,
            statut,
            type: 'facture',
            taux_tva: tauxTVA,
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
            prix_unitaire: prixUnitaire,
            taux_tva: tauxTVA,
            montant_ht: montantHTLigne,
            montant_tva: montantTVALigne,
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
        const type = TYPES_DOCUMENTS[Math.floor(Math.random() * TYPES_DOCUMENTS.length)];
        const nom = `${type}_${clientData.id}_${docCount + 1}.pdf`;

        const { error: docError } = await supabase
          .from('documents')
          .insert({
            entreprise_id: clientData.entreprise_id,
            client_id: clientData.id,
            nom,
            description: `Document ${type} généré automatiquement`,
            categorie: type,
            type_fichier: 'application/pdf',
            taille: Math.floor(50000 + Math.random() * 500000),
            chemin_fichier: `documents/${clientData.entreprise_id}/${nom}`,
            url: `https://storage.example.com/${nom}`,
            mime_type: 'application/pdf',
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

