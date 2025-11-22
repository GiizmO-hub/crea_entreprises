/**
 * Système de détection et correction automatique des problèmes de base de données
 * 
 * Ce module détecte les erreurs courantes et suggère les migrations à appliquer
 */

import { supabase } from './supabase';

interface DatabaseError {
  code: string;
  message: string;
  migrationFile?: string;
  sqlFix?: string;
}

/**
 * Détecter le type d'erreur et retourner la solution
 */
export function detectDatabaseError(error: any): DatabaseError | null {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';

  // Erreur: colonne manquante
  if (
    errorMessage.includes('does not exist') &&
    (errorMessage.includes('column') || errorMessage.includes('mode_paiement'))
  ) {
    if (errorMessage.includes('mode_paiement') || errorMessage.includes('abonnements')) {
      return {
        code: 'MISSING_COLUMN_MODE_PAIEMENT',
        message: 'La colonne "mode_paiement" est manquante dans la table "abonnements"',
        migrationFile: 'supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql',
        sqlFix: `
-- Ajouter la colonne mode_paiement
ALTER TABLE abonnements 
ADD COLUMN IF NOT EXISTS mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));
        `.trim(),
      };
    }
  }

  // Erreur: table manquante
  if (
    errorMessage.includes('does not exist') &&
    (errorMessage.includes('relation') || errorMessage.includes('table'))
  ) {
    if (errorMessage.includes('abonnements')) {
      return {
        code: 'MISSING_TABLE_ABONNEMENTS',
        message: 'La table "abonnements" n\'existe pas',
        migrationFile: 'supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql',
        sqlFix: `
-- Créer la table abonnements
CREATE TABLE IF NOT EXISTS abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES plans_abonnement(id) ON DELETE RESTRICT NOT NULL,
  statut text DEFAULT 'actif',
  date_debut date DEFAULT CURRENT_DATE,
  date_fin date,
  date_prochain_paiement date,
  montant_mensuel numeric DEFAULT 0,
  mode_paiement text DEFAULT 'mensuel',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;
        `.trim(),
      };
    }
  }

  // Erreur: fonction gen_salt
  if (errorMessage.includes('gen_salt') || errorMessage.includes('function') && errorMessage.includes('does not exist')) {
    return {
      code: 'MISSING_PGCRYPTO',
      message: 'L\'extension pgcrypto n\'est pas activée',
      migrationFile: 'supabase/migrations/20250122000006_fix_pgcrypto_extension.sql',
      sqlFix: `
-- Activer l'extension pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;
      `.trim(),
    };
  }

  // Erreur: fonction RPC manquante
  if (errorMessage.includes('function') && errorMessage.includes('does not exist')) {
    if (errorMessage.includes('create_espace_membre_from_client')) {
      return {
        code: 'MISSING_RPC_FUNCTION',
        message: 'La fonction create_espace_membre_from_client n\'existe pas',
        migrationFile: 'supabase/migrations/20250122000005_create_espace_membre_from_client.sql',
      };
    }
  }

  return null;
}

/**
 * Afficher un message d'erreur avec la solution
 */
export function showDatabaseErrorFix(error: any): string {
  const dbError = detectDatabaseError(error);

  if (!dbError) {
    return `Erreur: ${error?.message || 'Erreur inconnue'}`;
  }

  let message = `🔧 ${dbError.message}\n\n`;

  if (dbError.sqlFix) {
    message += `📋 SOLUTION RAPIDE - Copiez et exécutez dans Supabase SQL Editor:\n\n`;
    message += '```sql\n';
    message += dbError.sqlFix;
    message += '\n```\n\n';
  }

  if (dbError.migrationFile) {
    message += `📁 Migration complète disponible dans:\n`;
    message += `   ${dbError.migrationFile}\n\n`;
  }

  message += `💡 Pour appliquer la migration complète:\n`;
  message += `   1. Ouvrez Supabase SQL Editor\n`;
  message += `   2. Copiez le contenu de ${dbError.migrationFile || 'la migration'}\n`;
  message += `   3. Exécutez le SQL\n`;

  return message;
}

/**
 * Vérifier la structure de la base de données (à appeler au démarrage)
 */
export async function checkDatabaseStructure(): Promise<{
  ok: boolean;
  errors: string[];
  fixes: string[];
}> {
  const errors: string[] = [];
  const fixes: string[] = [];

  // Vérifier la table abonnements
  try {
    const { error } = await supabase
      .from('abonnements')
      .select('id, mode_paiement')
      .limit(0);

    if (error) {
      if (error.message.includes('does not exist')) {
        errors.push('Table abonnements manquante');
        fixes.push('Exécutez: supabase/migrations/20250122000008_fix_abonnements_mode_paiement.sql');
      } else if (error.message.includes('mode_paiement')) {
        errors.push('Colonne mode_paiement manquante');
        fixes.push('Ajoutez: ALTER TABLE abonnements ADD COLUMN mode_paiement text DEFAULT \'mensuel\';');
      }
    }
  } catch (error: any) {
    errors.push(`Erreur vérification abonnements: ${error.message}`);
  }

  // Vérifier la fonction create_espace_membre_from_client
  try {
    const { error } = await supabase.rpc('create_espace_membre_from_client', {
      p_client_id: '00000000-0000-0000-0000-000000000000' as any,
      p_entreprise_id: '00000000-0000-0000-0000-000000000000' as any,
      p_password: 'test',
      p_plan_id: '00000000-0000-0000-0000-000000000000' as any,
      p_options_ids: [],
    });

    // On s'attend à une erreur de validation, pas une erreur "function does not exist"
    if (error && error.message.includes('function') && error.message.includes('does not exist')) {
      errors.push('Fonction create_espace_membre_from_client manquante');
      fixes.push('Exécutez: supabase/migrations/20250122000005_create_espace_membre_from_client.sql');
    }
  } catch (error: any) {
    // Ignorer les erreurs de validation
    if (!error.message.includes('validation') && !error.message.includes('does not exist')) {
      // Erreur autre que "function does not exist" -> la fonction existe
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    fixes,
  };
}

