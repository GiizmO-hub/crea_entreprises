#!/usr/bin/env node

/**
 * SCRIPT DE VALIDATION DES DONNÉES PARTAGÉES
 * 
 * Ce script analyse tous les fichiers qui utilisent des données communes
 * et vérifie la cohérence des champs utilisés.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ============================================================================
// CONVENTIONS DE DONNÉES
// ============================================================================

const CONVENTIONS = {
  factures: {
    requiredFields: ['id', 'numero', 'client_id', 'entreprise_id', 'montant_ht', 'montant_ttc', 'statut'],
    optionalFields: ['type', 'date_facturation', 'date_emission', 'date_echeance', 'montant_tva', 'tva', 'taux_tva', 'notes', 'source', 'created_at', 'updated_at'],
    sourceValues: ['plateforme', 'client'],
    statutValues: ['brouillon', 'envoyee', 'en_attente', 'payee', 'annulee', 'valide'],
    typeValues: ['facture', 'proforma'],
    defaultSource: 'plateforme', // Par défaut pour les factures existantes
  },
  clients: {
    requiredFields: ['id', 'entreprise_id', 'email'],
    optionalFields: ['nom', 'prenom', 'entreprise_nom', 'telephone', 'adresse', 'code_postal', 'ville', 'siret', 'created_at', 'updated_at'],
  },
  entreprises: {
    requiredFields: ['id', 'user_id', 'nom'],
    optionalFields: ['forme_juridique', 'siret', 'email', 'telephone', 'adresse', 'code_postal', 'ville', 'site_web', 'created_at', 'updated_at'],
  },
  notifications: {
    requiredFields: ['id', 'user_id', 'title', 'message', 'type', 'read'],
    optionalFields: ['link_url', 'link_text', 'read_at', 'metadata', 'expires_at', 'created_at'],
    typeValues: ['info', 'success', 'warning', 'error', 'invoice', 'client', 'payment', 'subscription', 'system'],
  },
};

// ============================================================================
// FONCTIONS DE VALIDATION
// ============================================================================

function findFilesWithPattern(pattern, directory = 'src') {
  const files = [];
  const dir = join(projectRoot, directory);
  
  function walkDir(currentDir) {
    try {
      const entries = readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Ignorer node_modules, .git, etc.
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            walkDir(fullPath);
          }
        } else if (stat.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry))) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            if (pattern.test(content)) {
              files.push(fullPath);
            }
          } catch (error) {
            // Ignorer les erreurs de lecture
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs d'accès
    }
  }
  
  walkDir(dir);
  return files;
}

function validateFactureSource(filePath, content) {
  const issues = [];
  
  // Vérifier les insertions de factures
  const insertMatches = content.matchAll(/\.from\(['"]factures['"]\)\s*\.insert\(\[?\{[\s\S]*?\}\)?/g);
  for (const match of insertMatches) {
    const insertBlock = match[0];
    
    // Vérifier si source est présent
    if (!insertBlock.includes('source:')) {
      issues.push({
        file: filePath,
        type: 'missing_source',
        message: 'Insertion de facture sans champ "source"',
        line: content.substring(0, match.index).split('\n').length,
        code: insertBlock.substring(0, 200),
      });
    } else {
      // Vérifier si source a une valeur valide
      const sourceMatch = insertBlock.match(/source:\s*['"]([^'"]+)['"]/);
      if (sourceMatch && !CONVENTIONS.factures.sourceValues.includes(sourceMatch[1])) {
        issues.push({
          file: filePath,
          type: 'invalid_source_value',
          message: `Valeur de source invalide: "${sourceMatch[1]}" (doit être 'plateforme' ou 'client')`,
          line: content.substring(0, match.index).split('\n').length,
          code: insertBlock.substring(0, 200),
        });
      }
    }
  }
  
  // Vérifier les mises à jour de factures
  const updateMatches = content.matchAll(/\.from\(['"]factures['"]\)\s*\.update\([\s\S]*?\)/g);
  for (const match of updateMatches) {
    const updateBlock = match[0];
    
    // Si source est modifié, vérifier qu'il a une valeur valide
    if (updateBlock.includes('source:')) {
      const sourceMatch = updateBlock.match(/source:\s*['"]([^'"]+)['"]/);
      if (sourceMatch && !CONVENTIONS.factures.sourceValues.includes(sourceMatch[1])) {
        issues.push({
          file: filePath,
          type: 'invalid_source_value',
          message: `Valeur de source invalide dans update: "${sourceMatch[1]}"`,
          line: content.substring(0, match.index).split('\n').length,
          code: updateBlock.substring(0, 200),
        });
      }
    }
  }
  
  return issues;
}

function validateFactureFiltering(filePath, content) {
  const issues = [];
  
  // Vérifier les filtres sur source
  const filterMatches = content.matchAll(/source\s*[!=]==?\s*['"]([^'"]+)['"]/g);
  for (const match of filterMatches) {
    const sourceValue = match[1];
    if (!CONVENTIONS.factures.sourceValues.includes(sourceValue)) {
      issues.push({
        file: filePath,
        type: 'invalid_filter',
        message: `Filtre avec valeur source invalide: "${sourceValue}"`,
        line: content.substring(0, match.index).split('\n').length,
        code: content.substring(Math.max(0, match.index - 50), match.index + 100),
      });
    }
  }
  
  return issues;
}

function validateDefaultSource(filePath, content) {
  const issues = [];
  
  // Vérifier les valeurs par défaut de source
  const defaultMatches = content.matchAll(/source:\s*[^,}\n]+\|\|\s*['"]([^'"]+)['"]/g);
  for (const match of defaultMatches) {
    const defaultValue = match[1];
    if (defaultValue !== CONVENTIONS.factures.defaultSource) {
      issues.push({
        file: filePath,
        type: 'invalid_default_source',
        message: `Valeur par défaut de source incorrecte: "${defaultValue}" (devrait être "${CONVENTIONS.factures.defaultSource}")`,
        line: content.substring(0, match.index).split('\n').length,
        code: content.substring(Math.max(0, match.index - 50), match.index + 100),
      });
    }
  }
  
  return issues;
}

// ============================================================================
// ANALYSE PRINCIPALE
// ============================================================================

function analyzeDataConsistency() {
  console.log('🔍 ANALYSE DE COHÉRENCE DES DONNÉES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allIssues = [];
  
  // 1. Trouver tous les fichiers qui utilisent factures
  console.log('📋 Recherche des fichiers utilisant "factures"...');
  const factureFiles = findFilesWithPattern(/\.from\(['"]factures['"]/);
  console.log(`   ✅ ${factureFiles.length} fichier(s) trouvé(s)\n`);
  
  // 2. Analyser chaque fichier
  for (const filePath of factureFiles) {
    const relativePath = filePath.replace(projectRoot + '/', '');
    console.log(`🔍 Analyse: ${relativePath}`);
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Valider les insertions/updates
      const sourceIssues = validateFactureSource(filePath, content);
      const filterIssues = validateFactureFiltering(filePath, content);
      const defaultIssues = validateDefaultSource(filePath, content);
      
      const fileIssues = [...sourceIssues, ...filterIssues, ...defaultIssues];
      
      if (fileIssues.length > 0) {
        console.log(`   ⚠️  ${fileIssues.length} problème(s) trouvé(s)`);
        allIssues.push(...fileIssues);
      } else {
        console.log(`   ✅ Aucun problème détecté`);
      }
    } catch (error) {
      console.log(`   ❌ Erreur lors de la lecture: ${error.message}`);
    }
  }
  
  // 3. Résumé
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ DE L\'ANALYSE\n');
  
  if (allIssues.length === 0) {
    console.log('✅ Aucun problème de cohérence détecté !');
    return;
  }
  
  console.log(`⚠️  ${allIssues.length} problème(s) détecté(s):\n`);
  
  // Grouper par type
  const issuesByType = {};
  for (const issue of allIssues) {
    if (!issuesByType[issue.type]) {
      issuesByType[issue.type] = [];
    }
    issuesByType[issue.type].push(issue);
  }
  
  for (const [type, issues] of Object.entries(issuesByType)) {
    console.log(`\n📌 ${type.toUpperCase()} (${issues.length} occurrence(s)):`);
    for (const issue of issues) {
      const relativePath = issue.file.replace(projectRoot + '/', '');
      console.log(`   - ${relativePath}:${issue.line}`);
      console.log(`     ${issue.message}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 RECOMMANDATIONS:');
  console.log('   1. Utiliser les types de src/types/shared.ts');
  console.log('   2. Toujours définir "source" lors de la création de factures');
  console.log('   3. Utiliser "plateforme" par défaut pour les factures existantes');
  console.log('   4. Vérifier les filtres pour utiliser les bonnes valeurs');
}

// Exécuter l'analyse
analyzeDataConsistency();

