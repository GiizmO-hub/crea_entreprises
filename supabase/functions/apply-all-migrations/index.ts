import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Détecter automatiquement toutes les migrations dans supabase/migrations/
    const migrationsDir = './supabase/migrations';
    let migrationFiles: Array<{ name: string; file: string }> = [];
    
    try {
      // Lire le dossier migrations
      const files = [];
      for await (const dirEntry of Deno.readDir(migrationsDir)) {
        if (dirEntry.isFile && dirEntry.name.endsWith('.sql')) {
          files.push(dirEntry.name);
        }
      }
      
      // Trier par nom (les timestamps garantissent l'ordre)
      files.sort();
      
      migrationFiles = files.map(file => ({
        name: file.replace('.sql', '').replace(/_/g, ' '),
        file: `${migrationsDir}/${file}`,
      }));
      
      console.log(`✅ ${migrationFiles.length} migration(s) trouvée(s)`);
    } catch (error) {
      console.error('⚠️  Erreur lecture dossier migrations:', error);
      // Fallback sur les fichiers APPLY_*_NOW.sql à la racine
      const fallbackFiles = [
        'APPLY_FIX_CLIENTS_RLS_NOW.sql',
        'APPLY_CLIENT_CONTACTS_MIGRATION_NOW.sql',
        'APPLY_FIX_FACTURES_RLS_NOW.sql',
        'APPLY_FIX_FACTURE_LIGNES_RLS_NOW.sql',
        'APPLY_ADD_SOURCE_TO_FACTURES_NOW.sql',
        'APPLY_FACTURE_ARTICLES_MIGRATION_NOW.sql',
      ];
      
      migrationFiles = fallbackFiles.map(file => ({
        name: file.replace('APPLY_', '').replace('_NOW.sql', '').replace(/_/g, ' '),
        file: `./${file}`,
      }));
    }
    
    const migrations = migrationFiles;

    const results = [];

    for (const migration of migrations) {
      try {
        console.log(`📄 Application: ${migration.name}`);
        
        // Read the SQL file
        let sqlContent: string;
        try {
          sqlContent = await Deno.readTextFile(migration.file);
        } catch (fileError) {
          console.log(`   ⚠️  Fichier non trouvé: ${migration.file}, ignoré`);
          results.push({
            migration: migration.name,
            status: 'skipped',
            message: 'Fichier non trouvé',
          });
          continue;
        }
        
        // Nettoyer le SQL (enlever les commentaires de bloc)
        let cleanSQL = sqlContent
          .replace(/\/\*[\s\S]*?\*\//g, '') // Enlever les commentaires /* */
          .trim();
        
        // Utiliser la méthode directe via pg (si disponible) ou via RPC
        // Pour Supabase Edge Functions, on doit utiliser l'API REST avec service_role
        // On va utiliser une approche différente : exécuter via l'API REST
        
        // Diviser en instructions individuelles (en respectant les blocs DO $$)
        const statements: string[] = [];
        let currentStatement = '';
        let inDoBlock = false;
        let dollarTag = '';
        
        const lines = cleanSQL.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Ignorer les lignes vides et commentaires
          if (!trimmed || trimmed.startsWith('--')) {
            continue;
          }
          
          // Détecter début de bloc DO $$
          if (trimmed.match(/^\s*DO\s+\$\$/i)) {
            inDoBlock = true;
            dollarTag = '$$';
            currentStatement = line + '\n';
            continue;
          }
          
          // Détecter fin de bloc DO $$
          if (inDoBlock && trimmed.endsWith('$$;')) {
            currentStatement += line;
            statements.push(currentStatement);
            currentStatement = '';
            inDoBlock = false;
            dollarTag = '';
            continue;
          }
          
          if (inDoBlock) {
            currentStatement += line + '\n';
            continue;
          }
          
          // Instructions normales
          currentStatement += line;
          
          if (trimmed.endsWith(';')) {
            statements.push(currentStatement);
            currentStatement = '';
          } else {
            currentStatement += '\n';
          }
        }
        
        // Exécuter chaque instruction via l'API REST Supabase
        // Note: Supabase Edge Functions ne peuvent pas exécuter SQL directement
        // Il faut utiliser une fonction RPC ou l'API REST avec service_role
        // Pour l'instant, on va simplement logger et retourner success
        // L'utilisateur devra appliquer manuellement ou via le script Node.js
        
        console.log(`   ✅ Migration préparée (${statements.length} instructions)`);
        
        results.push({
          migration: migration.name,
          status: 'prepared',
          statementsCount: statements.length,
          message: 'Migration préparée, à appliquer via script Node.js',
        });
      } catch (error) {
        console.error(`❌ Erreur migration ${migration.name}:`, error);
        results.push({
          migration: migration.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

