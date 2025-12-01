#!/usr/bin/env node

/**
 * Script pour vérifier le mapping des modules
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Vérification du mapping des modules\n');

// Lire le fichier moduleService.ts
const moduleServicePath = join(__dirname, '..', 'src', 'services', 'moduleService.ts');
const moduleServiceContent = readFileSync(moduleServicePath, 'utf-8');

// Extraire le mapping
const mappingMatch = moduleServiceContent.match(/export const moduleCodeToMenuId: Record<string, string> = \{([\s\S]*?)\};/);
if (!mappingMatch) {
  console.error('❌ Impossible de trouver le mapping dans moduleService.ts');
  process.exit(1);
}

const mappingContent = mappingMatch[1];
const mappings = {};

// Parser les lignes du mapping
mappingContent.split('\n').forEach(line => {
  const match = line.match(/'([^']+)':\s*'([^']+)'/);
  if (match) {
    const [, moduleCode, menuId] = match;
    mappings[moduleCode] = menuId;
  }
});

console.log('📋 Modules critiques à vérifier:');
console.log('='.repeat(60));

const criticalModules = [
  'gestion-plans',
  'gestion_plans',
  'gestionPlans',
  'modules',
  'abonnements',
  'dashboard',
  'clients',
  'factures',
  'facturation',
];

criticalModules.forEach(moduleCode => {
  const menuId = mappings[moduleCode];
  if (menuId) {
    const status = menuId === moduleCode ? '✅' : '⚠️';
    console.log(`${status} ${moduleCode.padEnd(20)} → ${menuId}`);
  } else {
    console.log(`❌ ${moduleCode.padEnd(20)} → NON MAPPÉ`);
  }
});

console.log('\n📊 Résumé:');
console.log(`   Total de mappings: ${Object.keys(mappings).length}`);
console.log(`   Modules critiques mappés: ${criticalModules.filter(m => mappings[m]).length}/${criticalModules.length}`);

// Vérifier le mapping de gestion-plans
if (mappings['gestion-plans'] === 'gestion-plans') {
  console.log('\n✅ Le module "gestion-plans" est correctement mappé vers "gestion-plans"');
} else {
  console.log(`\n❌ Le module "gestion-plans" est mappé vers "${mappings['gestion-plans'] || 'RIEN'}" au lieu de "gestion-plans"`);
}

