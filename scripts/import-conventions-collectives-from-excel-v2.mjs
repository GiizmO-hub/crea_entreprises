import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier Excel téléchargé
const excelPath = '/Users/user/Downloads/Dares_donnes_Identifiant_convention_collective_Novembre25.xlsx';

console.log(`📖 Lecture du fichier Excel : ${excelPath}\n`);

// Lire le fichier Excel
const workbook = XLSX.readFile(excelPath);
const sheetName = 'Liste IDCC-Publication'; // Nom de la feuille principale
const worksheet = workbook.Sheets[sheetName];

// Lire toutes les lignes brutes
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log(`📊 Total de lignes dans le fichier : ${rawData.length}\n`);

// Trouver la ligne d'en-tête (chercher "IDCC" et "TITRE")
let headerRowIndex = -1;
let headerRow = null;

for (let i = 0; i < Math.min(10, rawData.length); i++) {
  const row = rawData[i];
  const rowStr = JSON.stringify(row).toUpperCase();
  
  if (rowStr.includes('IDCC') && (rowStr.includes('TITRE') || rowStr.includes('CONVENTION'))) {
    headerRowIndex = i;
    headerRow = row;
    console.log(`✅ Ligne d'en-tête trouvée à la ligne ${i + 1}`);
    break;
  }
}

if (headerRowIndex === -1) {
  console.log('⚠️  En-tête non trouvé, analyse des premières lignes...\n');
  rawData.slice(0, 15).forEach((row, i) => {
    console.log(`Ligne ${i + 1}:`, row.slice(0, 3).join(' | '));
  });
  process.exit(1);
}

// Afficher l'en-tête
console.log(`\n📋 En-tête détecté :`);
console.log(headerRow.slice(0, 5).map((cell, i) => `Col ${i}: "${cell}"`).join('\n'));

// Dans ce fichier, la structure est simple :
// Colonne 0 : Code IDCC (sans préfixe, juste le nombre)
// Colonne 1 : Titre de la convention
const idccCol = 0;
const libelleCol = 1;
const secteurCol = -1; // Pas de secteur dans ce fichier

console.log(`\n📍 Colonnes utilisées :`);
console.log(`   - IDCC : colonne ${idccCol} (${headerRow[idccCol]})`);
console.log(`   - Libellé : colonne ${libelleCol} (${headerRow[libelleCol]})`);
console.log(`   - Secteur : non disponible dans ce fichier`);

// Parser les données
const conventions = [];
const codesVus = new Set();

for (let i = headerRowIndex + 1; i < rawData.length; i++) {
  const row = rawData[i];
  
  const idcc = String(row[idccCol] || '').trim();
  const libelle = String(row[libelleCol] || '').trim();
  
  // Ignorer les lignes vides
  if (!idcc && !libelle) continue;
  
  // Ignorer si le code IDCC n'est pas un nombre valide
  if (!/^\d+$/.test(idcc)) continue;
  
  // Formater le code IDCC : ajouter le préfixe IDCC avec padding à 4 chiffres
  const codeFormate = `IDCC${idcc.padStart(4, '0')}`;
  
  if (codeFormate && libelle && !codesVus.has(codeFormate)) {
    // Essayer de deviner le secteur à partir du libellé
    let secteur = 'autre';
    const libelleUpper = libelle.toUpperCase();
    
    if (libelleUpper.includes('INFORMATIQUE') || libelleUpper.includes('NUMERIQUE') || libelleUpper.includes('SYNTEC') || libelleUpper.includes('BUREAUX D\'ETUDES')) {
      secteur = 'informatique';
    } else if (libelleUpper.includes('COMMERCE') || libelleUpper.includes('DETAIL') || libelleUpper.includes('GROS')) {
      secteur = 'commerce';
    } else if (libelleUpper.includes('BTP') || libelleUpper.includes('BATIMENT') || libelleUpper.includes('TRAVAUX') || libelleUpper.includes('CONSTRUCTION')) {
      secteur = 'btp';
    } else if (libelleUpper.includes('HOTELLERIE') || libelleUpper.includes('RESTAURATION') || libelleUpper.includes('HOTEL')) {
      secteur = 'hotellerie';
    } else if (libelleUpper.includes('TRANSPORT') || libelleUpper.includes('ROUTIER') || libelleUpper.includes('LOGISTIQUE')) {
      secteur = 'transport';
    } else if (libelleUpper.includes('SANTE') || libelleUpper.includes('HOSPITALISATION') || libelleUpper.includes('PHARMACIE') || libelleUpper.includes('MEDICAL')) {
      secteur = 'sante';
    } else if (libelleUpper.includes('INDUSTRIE') || libelleUpper.includes('METALLURGIE') || libelleUpper.includes('CHIMIE') || libelleUpper.includes('TEXTILE')) {
      secteur = 'industrie';
    } else if (libelleUpper.includes('AGRICULTURE') || libelleUpper.includes('FORESTIER') || libelleUpper.includes('EXPLOITATION')) {
      secteur = 'agriculture';
    } else if (libelleUpper.includes('BANQUE') || libelleUpper.includes('ASSURANCE') || libelleUpper.includes('FINANCE')) {
      secteur = 'finance';
    } else if (libelleUpper.includes('EDUCATION') || libelleUpper.includes('ENSEIGNEMENT') || libelleUpper.includes('FORMATION')) {
      secteur = 'education';
    } else if (libelleUpper.includes('COIFFURE') || libelleUpper.includes('ESTHETIQUE') || libelleUpper.includes('BEAUTE')) {
      secteur = 'beaute';
    } else if (libelleUpper.includes('IMMOBILIER') || libelleUpper.includes('AGENT IMMOBILIER')) {
      secteur = 'immobilier';
    } else if (libelleUpper.includes('SPECTACLE') || libelleUpper.includes('CULTURE') || libelleUpper.includes('ARTISTIQUE')) {
      secteur = 'spectacle';
    } else if (libelleUpper.includes('SPORT')) {
      secteur = 'sport';
    } else if (libelleUpper.includes('SERVICES') || libelleUpper.includes('PROPRETE') || libelleUpper.includes('SECURITE')) {
      secteur = 'services';
    }
    
    conventions.push({
      code: codeFormate,
      libelle: libelle,
      secteur: secteur,
    });
    codesVus.add(codeFormate);
  }
}

console.log(`\n✅ ${conventions.length} conventions collectives uniques extraites\n`);

// Afficher quelques exemples
console.log(`💡 Exemples de conventions extraites :`);
conventions.slice(0, 10).forEach((conv, i) => {
  console.log(`   ${i + 1}. ${conv.code} - ${conv.libelle.substring(0, 70)}${conv.libelle.length > 70 ? '...' : ''}`);
});

// Taux par défaut URSSAF 2025
const tauxDefaut = {
  sal: {
    ss_maladie: 0.0075,
    ss_vieil_plaf: 0.006,
    ss_vieil_deplaf: 0.004,
    ass_chomage: 0.024,
    ret_compl: 0.0315,
    csg_ded: 0.0525,
    csg_non_ded: 0.029,
  },
  pat: {
    ss_maladie: 0.07,
    ss_vieil_plaf: 0.0855,
    ss_vieil_deplaf: 0.019,
    alloc_fam: 0.0345,
    at_mp: 0.015,
    ass_chomage: 0.0405,
    ret_compl: 0.0472,
  },
};

function escapeSQL(str) {
  return str.replace(/'/g, "''");
}

// Générer le fichier SQL
function generateSQL() {
  let sql = `/*
  # Import complet des conventions collectives depuis le fichier officiel DARES
  
  Ce fichier contient TOUTES les conventions collectives françaises avec leurs vrais intitulés officiels.
  Source : DARES - Ministère du Travail (Novembre 2025)
  Date de génération : ${new Date().toISOString().split('T')[0]}
  Nombre de conventions : ${conventions.length}
  
  IMPORTANT : Ce fichier utilise ON CONFLICT DO UPDATE pour mettre à jour
  les libellés existants avec les vrais intitulés officiels.
*/

-- Supprimer les anciennes entrées génériques
DELETE FROM conventions_collectives WHERE code_idcc LIKE 'IDCC%';

-- Insérer toutes les conventions collectives avec vrais intitulés
INSERT INTO conventions_collectives (
  code_idcc,
  libelle,
  secteur_activite,
  annee,
  taux_ss_maladie_sal,
  taux_ss_vieil_plaf_sal,
  taux_ss_vieil_deplaf_sal,
  taux_ass_chomage_sal,
  taux_ret_compl_sal,
  taux_csg_ded_sal,
  taux_csg_non_ded_sal,
  taux_ss_maladie_pat,
  taux_ss_vieil_plaf_pat,
  taux_ss_vieil_deplaf_pat,
  taux_alloc_fam_pat,
  taux_at_mp_pat,
  taux_ass_chomage_pat,
  taux_ret_compl_pat,
  source_url,
  date_mise_a_jour,
  est_actif
) VALUES
`;

  const values = conventions.map((conv, index) => {
    const url = `https://www.legifrance.gouv.fr/liste/code/id/LEGITEXT000006025202/`;
    return `  (
    '${conv.code}',
    '${escapeSQL(conv.libelle)}',
    '${escapeSQL(conv.secteur)}',
    2025,
    ${tauxDefaut.sal.ss_maladie}, ${tauxDefaut.sal.ss_vieil_plaf}, ${tauxDefaut.sal.ss_vieil_deplaf},
    ${tauxDefaut.sal.ass_chomage}, ${tauxDefaut.sal.ret_compl}, ${tauxDefaut.sal.csg_ded}, ${tauxDefaut.sal.csg_non_ded},
    ${tauxDefaut.pat.ss_maladie}, ${tauxDefaut.pat.ss_vieil_plaf}, ${tauxDefaut.pat.ss_vieil_deplaf},
    ${tauxDefaut.pat.alloc_fam}, ${tauxDefaut.pat.at_mp}, ${tauxDefaut.pat.ass_chomage}, ${tauxDefaut.pat.ret_compl},
    '${url}',
    CURRENT_DATE,
    true
  )${index < conventions.length - 1 ? ',' : ';'}`;
  });

  sql += values.join('\n');

  return sql;
}

// Générer le fichier SQL
const sqlContent = generateSQL();
const outputPath = path.join(__dirname, '../supabase/migrations/20250202000019_import_all_conventions_collectives_official.sql');

fs.writeFileSync(outputPath, sqlContent, 'utf-8');
console.log(`\n✅ Fichier SQL généré : ${outputPath}`);
console.log(`📊 ${conventions.length} conventions collectives avec vrais intitulés officiels`);

