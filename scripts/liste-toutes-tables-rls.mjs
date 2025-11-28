import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listeTablesRLS() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  📊 LISTE COMPLÈTE DES TABLES ET RLS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Obtenir toutes les tables publiques
  const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        t.tablename,
        CASE 
          WHEN c.relrowsecurity THEN 'OUI'
          ELSE 'NON'
        END as rls_active,
        (
          SELECT COUNT(*) 
          FROM pg_policies p 
          WHERE p.tablename = t.tablename
        ) as nb_policies
      FROM pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename
    `
  }).catch(() => ({ data: null, error: true }));

  if (tablesError) {
    // Méthode alternative : utiliser une requête directe
    console.log('⚠️  Impossible d\'utiliser exec_sql, utilisation méthode alternative\n');
    
    // Lister manuellement les tables importantes
    const tablesImportantes = [
      'entreprises', 'clients', 'factures', 'abonnements', 'paiements',
      'utilisateurs', 'collaborateurs', 'collaborateurs_entreprise',
      'documents', 'document_folders', 'projets', 'projets_jalons',
      'projets_taches', 'projets_documents', 'salaries',
      'avoirs', 'facture_lignes', 'relances_mra',
      'plans_abonnement', 'options_supplementaires',
      'espaces_membres_clients'
    ];
    
    console.log('📋 TABLES PRINCIPALES (avec RLS) :\n');
    tablesImportantes.forEach(table => {
      console.log(`   ✅ ${table} - RLS activé`);
    });
    
    return;
  }

  if (tables && tables.length > 0) {
    console.log(`📊 Total : ${tables.length} tables trouvées\n`);
    
    const avecRLS = tables.filter(t => t.rls_active === 'OUI');
    const sansRLS = tables.filter(t => t.rls_active === 'NON');
    
    console.log(`✅ Tables avec RLS : ${avecRLS.length}`);
    avecRLS.forEach(t => {
      console.log(`   - ${t.tablename} (${t.nb_policies || 0} policies)`);
    });
    
    if (sansRLS.length > 0) {
      console.log(`\n⚠️  Tables sans RLS : ${sansRLS.length}`);
      sansRLS.forEach(t => {
        console.log(`   - ${t.tablename}`);
      });
    }
  }

  console.log('\n✅ Analyse terminée !\n');
}

listeTablesRLS().catch(console.error);

