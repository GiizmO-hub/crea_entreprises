import XLSX from 'xlsx';
import fs from 'fs';

const excelPath = '/Users/user/Downloads/Dares_donnes_Identifiant_convention_collective_Novembre25.xlsx';

console.log('📖 Analyse de la structure du fichier Excel...\n');

const workbook = XLSX.readFile(excelPath);
console.log(`📋 Feuilles disponibles : ${workbook.SheetNames.join(', ')}\n`);

// Analyser chaque feuille
workbook.SheetNames.forEach((sheetName, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Feuille ${index + 1}: "${sheetName}"`);
  console.log('='.repeat(60));
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  console.log(`\n📊 Nombre de lignes : ${data.length}`);
  console.log(`\n🔍 Premières lignes (10 premières) :\n`);
  
  // Afficher les 10 premières lignes
  data.slice(0, 10).forEach((row, i) => {
    console.log(`Ligne ${i + 1}:`, JSON.stringify(row, null, 2));
  });
  
  // Essayer de trouver les en-têtes
  if (data.length > 0) {
    console.log(`\n📝 En-têtes possibles (ligne 1) :`);
    console.log(JSON.stringify(data[0], null, 2));
    
    // Essayer avec header: 'A' pour voir les colonnes
    const dataWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 'A', defval: '' });
    if (dataWithHeaders.length > 0) {
      console.log(`\n📝 Première ligne avec colonnes A, B, C... :`);
      console.log(JSON.stringify(dataWithHeaders[0], null, 2));
    }
  }
});

