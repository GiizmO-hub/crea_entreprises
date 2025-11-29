#!/usr/bin/env node

/**
 * Script d'audit complet des modules
 * Analyse chaque module pour détecter les erreurs potentielles
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const modulesDir = './src/pages';
const issues = [];

function analyzeFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Vérifier les imports Supabase
  if (content.includes("from('supabase')") || content.includes('from("supabase")')) {
    issues.push({ type: 'import', message: 'Import Supabase incorrect - devrait être from "../lib/supabase"' });
  }
  
  // Vérifier les requêtes sans gestion d'erreur
  const supabaseQueries = content.match(/supabase\.(from|rpc)\([^)]+\)/g) || [];
  supabaseQueries.forEach((query, index) => {
    const lines = content.split('\n');
    const queryLine = lines.findIndex(line => line.includes(query));
    if (queryLine !== -1) {
      // Vérifier si une gestion d'erreur suit
      const nextLines = lines.slice(queryLine, queryLine + 10).join('\n');
      if (!nextLines.includes('if (error)') && !nextLines.includes('catch')) {
        issues.push({ 
          type: 'error-handling', 
          line: queryLine + 1,
          message: 'Requête Supabase sans gestion d\'erreur explicite' 
        });
      }
    }
  });
  
  // Vérifier les types any
  const anyMatches = content.match(/:\s*any\b/g);
  if (anyMatches) {
    issues.push({ 
      type: 'type', 
      count: anyMatches.length,
      message: `${anyMatches.length} utilisation(s) de type 'any' trouvée(s)` 
    });
  }
  
  // Vérifier les console.log en production
  const consoleLogs = (content.match(/console\.(log|warn|error)/g) || []).length;
  if (consoleLogs > 10) {
    issues.push({ 
      type: 'console', 
      count: consoleLogs,
      message: `${consoleLogs} console.log trouvés (à nettoyer en production)` 
    });
  }
  
  return issues;
}

function scanDirectory(dir, basePath = '') {
  const files = readdirSync(dir);
  const results = {};
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      const subResults = scanDirectory(fullPath, join(basePath, file));
      Object.assign(results, subResults);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const relativePath = join(basePath, file);
      const issues = analyzeFile(fullPath);
      if (issues.length > 0) {
        results[relativePath] = issues;
      }
    }
  }
  
  return results;
}

console.log('🔍 Audit des modules en cours...\n');
const results = scanDirectory(modulesDir);

let totalIssues = 0;
for (const [file, issues] of Object.entries(results)) {
  if (issues.length > 0) {
    console.log(`\n📄 ${file}:`);
    issues.forEach(issue => {
      console.log(`  ⚠️  ${issue.type}: ${issue.message}`);
      totalIssues++;
    });
  }
}

console.log(`\n✅ Audit terminé: ${totalIssues} problème(s) trouvé(s) dans ${Object.keys(results).length} fichier(s)`);

