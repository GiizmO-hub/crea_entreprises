/**
 * Script pour corriger automatiquement certaines erreurs ESLint
 * 
 * Ce script corrige :
 * - Variables non utilisées (préfixe avec _)
 * - prefer-const
 * - no-empty-pattern
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const filesToFix = [
  'src/pages/Auth.tsx',
  'src/lib/pdfGenerator.ts',
  'src/pages/Modules.tsx',
  'src/pages/Parametres.tsx',
  'src/pages/Abonnements.tsx',
  'src/pages/Entreprises.tsx',
  'src/pages/GestionPlans.tsx',
  'src/pages/Collaborateurs.tsx',
];

console.log('🔧 Correction automatique des erreurs ESLint...\n');

filesToFix.forEach(file => {
  const filePath = join(projectRoot, file);
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    // Corriger 'err' non utilisé dans Auth.tsx
    if (file.includes('Auth.tsx')) {
      content = content.replace(/} catch \(err\) {/g, '} catch (_err) {');
      modified = true;
    }

    // Corriger 'docInfoX' let -> const dans pdfGenerator.ts
    if (file.includes('pdfGenerator.ts')) {
      content = content.replace(/let docInfoX =/g, 'const docInfoX =');
      modified = true;
    }

    // Corriger 'active' let -> const dans Modules.tsx
    if (file.includes('Modules.tsx')) {
      content = content.replace(/let active =/g, 'const active =');
      modified = true;
    }

    // Corriger empty pattern dans Parametres.tsx
    if (file.includes('Parametres.tsx')) {
      content = content.replace(/export default function Parametres\(\{\}: ParametresProps\)/g, 
        'export default function Parametres(_props: ParametresProps)');
      modified = true;
    }

    // Corriger _onNavigate non utilisé
    if (file.includes('Abonnements.tsx') || file.includes('Entreprises.tsx') || 
        file.includes('GestionPlans.tsx') || file.includes('Collaborateurs.tsx')) {
      content = content.replace(/onNavigate: _onNavigate/g, '_onNavigate');
      modified = true;
    }

    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ ${file} corrigé`);
    }
  } catch (error) {
    console.error(`❌ Erreur sur ${file}:`, error.message);
  }
});

console.log('\n✅ Correction automatique terminée !');

