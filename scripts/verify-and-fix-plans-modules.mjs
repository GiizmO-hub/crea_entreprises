#!/usr/bin/env node

import { config } from 'dotenv';
import pg from 'pg';

const { Client } = pg;
config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non défini');
  process.exit(1);
}

async function verifyAndFix() {
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');
    
    // Vérifier les modules pour chaque plan
    const plans = await client.query(`
      SELECT id, nom FROM plans_abonnement WHERE actif = true ORDER BY ordre
    `);
    
    for (const plan of plans.rows) {
      const count = await client.query(`
        SELECT COUNT(*) as total 
        FROM plan_modules 
        WHERE plan_id = $1 AND activer = true
      `, [plan.id]);
      
      console.log(`Plan "${plan.nom}": ${count.rows[0].total} module(s)`);
      
      if (count.rows[0].total === 0) {
        console.log(`  ⚠️ Aucun module - Correction en cours...`);
        
        // Insérer les modules selon le plan
        if (plan.nom === 'Starter') {
          await client.query(`
            INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
            ($1, 'dashboard', 'Tableau de bord', true),
            ($1, 'clients', 'Gestion des clients', true),
            ($1, 'facturation', 'Facturation', true),
            ($1, 'factures', 'Factures', true),
            ($1, 'documents', 'Gestion de documents', true),
            ($1, 'tableau_de_bord', 'Tableau de bord client', true),
            ($1, 'mon_entreprise', 'Mon entreprise', true),
            ($1, 'abonnements', 'Mes abonnements', true),
            ($1, 'settings', 'Paramètres', true)
            ON CONFLICT (plan_id, module_code) DO UPDATE
            SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer
          `, [plan.id]);
          console.log(`  ✅ 9 modules ajoutés au plan Starter`);
        } else if (plan.nom === 'Business') {
          await client.query(`
            INSERT INTO plan_modules (plan_id, module_code, module_nom, activer) VALUES
            ($1, 'dashboard', 'Tableau de bord', true),
            ($1, 'clients', 'Gestion des clients', true),
            ($1, 'facturation', 'Facturation', true),
            ($1, 'factures', 'Factures', true),
            ($1, 'documents', 'Gestion de documents', true),
            ($1, 'tableau_de_bord', 'Tableau de bord client', true),
            ($1, 'mon_entreprise', 'Mon entreprise', true),
            ($1, 'abonnements', 'Mes abonnements', true),
            ($1, 'settings', 'Paramètres', true),
            ($1, 'comptabilite', 'Comptabilité', true),
            ($1, 'salaries', 'Gestion des salariés', true),
            ($1, 'automatisations', 'Automatisations', true),
            ($1, 'messagerie', 'Messagerie interne', true)
            ON CONFLICT (plan_id, module_code) DO UPDATE
            SET module_nom = EXCLUDED.module_nom, activer = EXCLUDED.activer
          `, [plan.id]);
          console.log(`  ✅ 13 modules ajoutés au plan Business`);
        }
      }
    }
    
    console.log('\n✅ Vérification et correction terminées');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyAndFix().catch(console.error);

