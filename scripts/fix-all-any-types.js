/**
 * Script pour remplacer automatiquement tous les types 'any' par 'unknown'
 * dans les fichiers de pages
 */

import { readFileSync, writeFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function getAllTsxFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllTsxFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

const files = getAllTsxFiles(join(projectRoot, 'src', 'pages'));
let totalFixed = 0;

console.log('🔧 Correction automatique des types any...\n');

files.forEach(file => {
  try {
    let content = readFileSync(file, 'utf-8');
    let modified = false;
    const originalContent = content;
    
    // Remplacer catch (error: any) par catch (error: unknown)
    content = content.replace(/catch\s*\(\s*error\s*:\s*any\s*\)/g, 'catch (error: unknown)');
    if (content !== originalContent) modified = true;
    
    // Remplacer : any dans les paramètres de fonction (mais pas dans les types complexes)
    // On évite de remplacer les Record<string, any> car ils sont parfois nécessaires
    content = content.replace(/(\w+)\s*:\s*any\b(?!\s*[>,}])/g, '$1: unknown');
    if (content !== originalContent) modified = true;
    
    // Remplacer les as any par as unknown (plus sûr)
    content = content.replace(/\s+as\s+any\b/g, ' as unknown');
    if (content !== originalContent) modified = true;
    
    if (modified) {
      writeFileSync(file, content, 'utf-8');
      const relativePath = file.replace(projectRoot + '/', '');
      console.log(`✅ ${relativePath}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`❌ Erreur sur ${file}:`, error.message);
  }
});

console.log(`\n✅ ${totalFixed} fichier(s) corrigé(s) !`);




