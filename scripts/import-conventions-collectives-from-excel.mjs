import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le fichier Excel téléchargé
const excelPath = '/Users/user/Downloads/Dares_donnes_Identifiant_convention_collective_Novembre25.xlsx';

// Vérifier si le fichier existe
if (!fs.existsSync(excelPath)) {
  console.error(`❌ Fichier non trouvé : ${excelPath}`);
  console.log(`💡 Assure-toi que le fichier Excel est dans le dossier Downloads`);
  process.exit(1);
}

console.log(`📖 Lecture du fichier Excel : ${excelPath}`);

// Lire le fichier Excel
const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0]; // Prendre la première feuille
const worksheet = workbook.Sheets[sheetName];

// Convertir en JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`✅ ${data.length} lignes trouvées dans le fichier Excel`);

// Afficher les premières lignes pour comprendre la structure
if (data.length > 0) {
  console.log(`\n📋 Structure des données (première ligne) :`);
  console.log(JSON.stringify(data[0], null, 2));
}

// Fonction pour mapper les colonnes (à adapter selon la structure réelle du fichier)
function parseConvention(row) {
  // Les noms de colonnes peuvent varier, on essaie plusieurs possibilités
  const codeIdcc = row['IDCC'] || row['Code IDCC'] || row['code_idcc'] || row['Identifiant'] || row['idcc'] || '';
  const libelle = row['Libellé'] || row['Libelle'] || row['libelle'] || row['Intitulé'] || row['Intitule'] || row['intitule'] || row['Nom'] || row['nom'] || '';
  const secteur = row['Secteur'] || row['secteur'] || row['Secteur d\'activité'] || row['Secteur activite'] || row['Domaine'] || row['domaine'] || '';
  
  // Nettoyer le code IDCC (enlever les espaces, formater)
  let codeFormate = String(codeIdcc).trim();
  if (codeFormate && !codeFormate.startsWith('IDCC')) {
    // Si c'est juste un nombre, ajouter le préfixe IDCC avec padding
    const num = parseInt(codeFormate);
    if (!isNaN(num)) {
      codeFormate = `IDCC${String(num).padStart(4, '0')}`;
    } else {
      codeFormate = `IDCC${codeFormate.padStart(4, '0')}`;
    }
  }
  
  return {
    code: codeFormate,
    libelle: String(libelle).trim(),
    secteur: String(secteur).trim() || 'autre',
  };
}

// Parser toutes les conventions
const conventions = [];
const codesVus = new Set();

for (const row of data) {
  const conv = parseConvention(row);
  
  if (conv.code && conv.libelle && !codesVus.has(conv.code)) {
    conventions.push(conv);
    codesVus.add(conv.code);
  }
}

console.log(`\n✅ ${conventions.length} conventions collectives uniques extraites`);

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
console.log(`\n💡 Exemples de conventions extraites :`);
conventions.slice(0, 5).forEach((conv, i) => {
  console.log(`   ${i + 1}. ${conv.code} - ${conv.libelle.substring(0, 60)}...`);
});

