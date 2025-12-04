/**
 * Script pour importer tous les codes APE/NAF depuis un fichier CSV
 * 
 * Pour obtenir la liste complète des 732 codes APE/NAF :
 * 1. Téléchargez le fichier CSV depuis le site de l'INSEE
 * 2. Placez-le dans le dossier scripts/ avec le nom "naf_rev_2.csv"
 * 3. Exécutez ce script : node scripts/import-all-ape-naf.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, 'naf_rev_2.csv');
const outputPath = path.join(__dirname, '../supabase/migrations/20250202000008_seed_codes_ape_naf.sql');

// Vérifier si le fichier CSV existe
if (!fs.existsSync(csvPath)) {
  console.log('⚠️  Fichier CSV non trouvé :', csvPath);
  console.log('📥 Pour obtenir tous les codes APE/NAF :');
  console.log('   1. Téléchargez le fichier depuis : https://www.insee.fr/fr/information/2120875');
  console.log('   2. Placez-le dans scripts/ avec le nom "naf_rev_2.csv"');
  console.log('   3. Relancez ce script');
  process.exit(1);
}

// Lire le fichier CSV
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Parser le CSV (format attendu : code,libelle,section,division,groupe,classe,sous_classe)
const codes = [];
for (let i = 1; i < lines.length; i++) { // Skip header
  const line = lines[i];
  if (!line.trim()) continue;
  
  // Parser la ligne CSV (gérer les guillemets)
  const parts = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  
  if (parts.length >= 2) {
    const code = parts[0].replace(/"/g, '');
    const libelle = parts[1].replace(/"/g, '').replace(/'/g, "''");
    const section = parts[2]?.replace(/"/g, '') || '';
    const division = parts[3]?.replace(/"/g, '') || '';
    const groupe = parts[4]?.replace(/"/g, '') || '';
    const classe = parts[5]?.replace(/"/g, '') || '';
    const sous_classe = parts[6]?.replace(/"/g, '') || code;
    
    if (code && libelle) {
      codes.push({
        code,
        libelle,
        section,
        division,
        groupe,
        classe,
        sous_classe
      });
    }
  }
}

// Générer le fichier SQL
const sqlContent = `/*
  # Seed des codes APE/NAF - Liste complète
  
  Ce fichier contient ${codes.length} codes APE/NAF officiels français.
  Source : INSEE - Nomenclature d'activités française (NAF) révision 2
*/

INSERT INTO codes_ape_naf (
  code,
  libelle,
  section,
  division,
  groupe,
  classe,
  sous_classe,
  est_actif
) VALUES
${codes.map((item, index) => {
  return `  ('${item.code}', '${item.libelle}', '${item.section}', '${item.division}', '${item.groupe}', '${item.classe}', '${item.sous_classe}', true)${index < codes.length - 1 ? ',' : ''}`;
}).join('\n')}
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  section = EXCLUDED.section,
  division = EXCLUDED.division,
  groupe = EXCLUDED.groupe,
  classe = EXCLUDED.classe,
  sous_classe = EXCLUDED.sous_classe,
  updated_at = now();
`;

// Écrire le fichier
fs.writeFileSync(outputPath, sqlContent, 'utf8');

console.log(`✅ Fichier SQL généré : ${outputPath}`);
console.log(`📊 ${codes.length} codes APE/NAF inclus`);
console.log(`🚀 Vous pouvez maintenant appliquer la migration avec : node scripts/apply-all-migrations-auto.mjs`);

