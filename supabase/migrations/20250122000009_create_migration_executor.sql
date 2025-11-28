/*
  # Fonction pour exécuter des migrations SQL de manière sécurisée
  
  Cette fonction permet d'exécuter des migrations SQL pré-définies
  de manière sécurisée via l'API Supabase.
  
  ⚠️ ATTENTION: Cette fonction ne doit être accessible qu'avec la Service Role Key
*/

-- Table pour suivre les migrations appliquées
CREATE TABLE IF NOT EXISTS schema_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text NOT NULL UNIQUE,
  applied_at timestamptz DEFAULT now(),
  checksum text,
  created_at timestamptz DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);

-- Fonction pour vérifier si une migration a été appliquée
CREATE OR REPLACE FUNCTION migration_applied(p_migration_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schema_migrations 
    WHERE migration_name = p_migration_name
  );
END;
$$;

-- Fonction pour marquer une migration comme appliquée
CREATE OR REPLACE FUNCTION mark_migration_applied(p_migration_name text, p_checksum text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO schema_migrations (migration_name, checksum)
  VALUES (p_migration_name, p_checksum)
  ON CONFLICT (migration_name) DO NOTHING;
END;
$$;

-- Fonction pour corriger date_activation (migration spécifique)
CREATE OR REPLACE FUNCTION apply_fix_date_activation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier si déjà appliquée
  IF migration_applied('fix_date_activation') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Migration déjà appliquée'
    );
  END IF;

  -- Ajouter la colonne date_activation si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'abonnement_options' 
    AND column_name = 'date_activation'
  ) THEN
    ALTER TABLE abonnement_options 
    ADD COLUMN date_activation date DEFAULT CURRENT_DATE;
  END IF;

  -- Marquer comme appliquée
  PERFORM mark_migration_applied('fix_date_activation');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Colonne date_activation ajoutée avec succès'
  );
END;
$$;

-- Fonction pour corriger mode_paiement (migration spécifique)
CREATE OR REPLACE FUNCTION apply_fix_mode_paiement()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier si déjà appliquée
  IF migration_applied('fix_mode_paiement') THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Migration déjà appliquée'
    );
  END IF;

  -- Créer la table abonnements si elle n'existe pas
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

  -- Ajouter la colonne mode_paiement si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'abonnements' 
    AND column_name = 'mode_paiement'
  ) THEN
    ALTER TABLE abonnements 
    ADD COLUMN mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel'));
  END IF;

  -- Marquer comme appliquée
  PERFORM mark_migration_applied('fix_mode_paiement');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Table abonnements et colonne mode_paiement corrigées'
  );
END;
$$;

COMMENT ON FUNCTION apply_fix_date_activation IS 'Ajoute la colonne date_activation à la table abonnement_options si elle manque';
COMMENT ON FUNCTION apply_fix_mode_paiement IS 'Crée la table abonnements et ajoute la colonne mode_paiement si nécessaire';




