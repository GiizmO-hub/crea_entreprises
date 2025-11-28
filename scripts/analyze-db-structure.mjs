import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDatabase() {
  try {
    console.log('🔍 ANALYSE DE LA BASE DE DONNÉES\n');
    console.log('='.repeat(80));

    // 1. Analyser les triggers sur entreprises
    console.log('\n📋 TRIGGERS SUR ENTREPRISES:');
    console.log('-'.repeat(80));
    const { data: triggersE, error: e1 } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          tgname as trigger_name,
          pg_get_triggerdef(oid) as trigger_definition
        FROM pg_trigger
        WHERE tgrelid = 'entreprises'::regclass
        AND NOT tgisinternal
        ORDER BY tgname;
      `
    });
    
    // Utiliser une requête directe via SQL
    const { data: triggersEntreprises, error: err1 } = await supabase
      .from('pg_trigger')
      .select('*')
      .eq('tgrelid', 'entreprises'::regclass);
    
    // Utiliser une fonction SQL personnalisée
    const { data: result1, error: error1 } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          tgname as trigger_name,
          CASE 
            WHEN tgtype & 2 = 2 THEN 'BEFORE'
            WHEN tgtype & 4 = 4 THEN 'AFTER'
            ELSE 'INSTEAD OF'
          END as timing,
          CASE 
            WHEN tgtype & 16 = 16 THEN 'DELETE'
            WHEN tgtype & 8 = 8 THEN 'UPDATE'
            WHEN tgtype & 4 = 4 THEN 'INSERT'
            ELSE 'UNKNOWN'
          END as event,
          pg_get_triggerdef(oid) as definition
        FROM pg_trigger
        WHERE tgrelid = 'entreprises'::regclass::oid
        AND NOT tgisinternal;
      `
    });

    // Utiliser une approche différente : lire directement depuis les migrations
    console.log('\n📋 ANALYSE DES MIGRATIONS POUR IDENTIFIER LES TRIGGERS:');
    console.log('-'.repeat(80));
    
    // Chercher tous les triggers BEFORE DELETE dans les migrations
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    const triggersFound = {
      entreprises: [],
      clients: [],
      espaces: []
    };
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Chercher les triggers BEFORE DELETE
      const beforeDeleteRegex = /CREATE\s+TRIGGER\s+(\w+)\s+BEFORE\s+DELETE\s+ON\s+(\w+)/gi;
      let match;
      while ((match = beforeDeleteRegex.exec(content)) !== null) {
        const triggerName = match[1];
        const tableName = match[2];
        if (tableName === 'entreprises') {
          triggersFound.entreprises.push({ file, trigger: triggerName });
        } else if (tableName === 'clients') {
          triggersFound.clients.push({ file, trigger: triggerName });
        } else if (tableName === 'espaces_membres_clients') {
          triggersFound.espaces.push({ file, trigger: triggerName });
        }
      }
    }
    
    console.log('\n⚠️  TRIGGERS BEFORE DELETE TROUVÉS DANS LES MIGRATIONS:');
    if (triggersFound.entreprises.length > 0) {
      console.log('\n  ENTREPRISES:');
      triggersFound.entreprises.forEach(t => {
        console.log(`    - ${t.trigger} (dans ${t.file})`);
      });
    }
    if (triggersFound.clients.length > 0) {
      console.log('\n  CLIENTS:');
      triggersFound.clients.forEach(t => {
        console.log(`    - ${t.trigger} (dans ${t.file})`);
      });
    }
    if (triggersFound.espaces.length > 0) {
      console.log('\n  ESPACES_MEMBRES_CLIENTS:');
      triggersFound.espaces.forEach(t => {
        console.log(`    - ${t.trigger} (dans ${t.file})`);
      });
    }
    
    if (triggersFound.entreprises.length === 0 && 
        triggersFound.clients.length === 0 && 
        triggersFound.espaces.length === 0) {
      console.log('  ✅ Aucun trigger BEFORE DELETE trouvé dans les migrations');
    }
    
    // Chercher les contraintes CASCADE
    console.log('\n📋 CONTRAINTES CASCADE VERS ENTREPRISES:');
    console.log('-'.repeat(80));
    const cascadeConstraints = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const cascadeRegex = /REFERENCES\s+entreprises\(id\)\s+ON\s+DELETE\s+CASCADE/gi;
      if (cascadeRegex.test(content)) {
        // Extraire le nom de la table
        const tableMatch = content.match(/(?:CREATE\s+TABLE|ALTER\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        if (tableMatch) {
          cascadeConstraints.push({ table: tableMatch[1], file });
        }
      }
    }
    
    if (cascadeConstraints.length > 0) {
      cascadeConstraints.forEach(c => {
        console.log(`  - ${c.table} (dans ${c.file})`);
      });
    } else {
      console.log('  Aucune contrainte CASCADE trouvée');
    }
    
    console.log('\n✅ Analyse terminée\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

analyzeDatabase();


