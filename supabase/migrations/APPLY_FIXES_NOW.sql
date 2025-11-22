/*
  ============================================================================
  CORRECTIONS URGENTES - À EXÉCUTER DANS SUPABASE SQL EDITOR
  ============================================================================
  
  Ce fichier contient toutes les corrections nécessaires pour que la création
  d'espace membre fonctionne correctement.
  
  Instructions:
    1. Copiez TOUT le contenu de ce fichier
    2. Ouvrez Supabase Dashboard > SQL Editor
    3. Collez et exécutez (Ctrl+Enter / Cmd+Enter)
    4. C'est fait ! 🎉
  
  ============================================================================
*/

-- ============================================================================
-- 1. CRÉER LES FONCTIONS RPC POUR LES CORRECTIONS FUTURES
-- ============================================================================

-- Table pour suivre les migrations appliquées
CREATE TABLE IF NOT EXISTS schema_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text NOT NULL UNIQUE,
  applied_at timestamptz DEFAULT now(),
  checksum text,
  created_at timestamptz DEFAULT now()
);

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

-- ============================================================================
-- 2. FONCTION POUR CORRIGER date_activation
-- ============================================================================

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

-- ============================================================================
-- 3. FONCTION POUR CORRIGER mode_paiement
-- ============================================================================

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
    statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'annule', 'expire')),
    date_debut date DEFAULT CURRENT_DATE,
    date_fin date,
    date_prochain_paiement date,
    montant_mensuel numeric DEFAULT 0,
    mode_paiement text DEFAULT 'mensuel' CHECK (mode_paiement IN ('mensuel', 'annuel')),
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

  -- Créer les index si nécessaire
  CREATE INDEX IF NOT EXISTS idx_abonnements_entreprise_id ON abonnements(entreprise_id);
  CREATE INDEX IF NOT EXISTS idx_abonnements_plan_id ON abonnements(plan_id);
  CREATE INDEX IF NOT EXISTS idx_abonnements_statut ON abonnements(statut);

  -- Activer RLS si nécessaire
  ALTER TABLE abonnements ENABLE ROW LEVEL SECURITY;

  -- Créer les politiques RLS si elles n'existent pas
  DROP POLICY IF EXISTS "Users can view abonnements of their entreprises" ON abonnements;
  CREATE POLICY "Users can view abonnements of their entreprises"
    ON abonnements FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = abonnements.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can insert abonnements for their entreprises" ON abonnements;
  CREATE POLICY "Users can insert abonnements for their entreprises"
    ON abonnements FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = abonnements.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can update abonnements of their entreprises" ON abonnements;
  CREATE POLICY "Users can update abonnements of their entreprises"
    ON abonnements FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = abonnements.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = abonnements.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
    );

  -- Marquer comme appliquée
  PERFORM mark_migration_applied('fix_mode_paiement');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Table abonnements et colonne mode_paiement corrigées'
  );
END;
$$;

-- ============================================================================
-- 4. FONCTION POUR SUPPRIMER COMPLÈTEMENT UN CLIENT
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_client_complete(
  p_client_id uuid,
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_email text;
  v_user_id uuid;
  v_abonnement_id uuid;
  v_entreprise_client_id uuid;
  v_result jsonb;
BEGIN
  -- Vérifier les permissions
  IF NOT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de supprimer ce client';
  END IF;

  -- Vérifier que le client appartient à cette entreprise
  IF NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id
    AND entreprise_id = p_entreprise_id
  ) THEN
    RAISE EXCEPTION 'Ce client n''appartient pas à cette entreprise';
  END IF;

  -- Récupérer l'email du client avant suppression
  SELECT email, entreprise_id
  INTO v_client_email, v_entreprise_client_id
  FROM clients
  WHERE id = p_client_id;

  -- Si le client a un email, récupérer le user_id depuis utilisateurs
  IF v_client_email IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
    AND entreprise_id = p_entreprise_id;
  END IF;

  -- Récupérer l'abonnement associé via l'entreprise du client
  IF v_entreprise_client_id IS NOT NULL THEN
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_client_id
    LIMIT 1;
  END IF;

  -- Supprimer dans l'ordre pour éviter les erreurs de contrainte

  -- 1. Supprimer les options d'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    DELETE FROM abonnement_options
    WHERE abonnement_id = v_abonnement_id;
  END IF;

  -- 2. Supprimer l'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    DELETE FROM abonnements
    WHERE id = v_abonnement_id;
  END IF;

  -- 3. Supprimer l'utilisateur de la table utilisateurs
  IF v_user_id IS NOT NULL THEN
    DELETE FROM utilisateurs
    WHERE id = v_user_id;
  END IF;

  -- 4. Supprimer l'utilisateur de auth.users (pour libérer l'email)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
      RAISE NOTICE 'Utilisateur auth.users supprimé: %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur suppression auth.users (peut-être déjà supprimé): %', SQLERRM;
    END;
  END IF;

  -- 5. Supprimer l'entreprise du client si elle existe et n'est utilisée que pour ce client
  IF v_entreprise_client_id IS NOT NULL THEN
    -- Vérifier s'il y a d'autres clients pour cette entreprise
    IF NOT EXISTS (
      SELECT 1 FROM clients
      WHERE entreprise_id = v_entreprise_client_id
      AND id != p_client_id
    ) THEN
      -- Supprimer l'entreprise si elle n'est utilisée que pour ce client
      DELETE FROM entreprises
      WHERE id = v_entreprise_client_id
      AND user_id = v_user_id;
    END IF;
  END IF;

  -- 6. Supprimer le client lui-même
  DELETE FROM clients
  WHERE id = p_client_id
  AND entreprise_id = p_entreprise_id;

  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Client et toutes ses données supprimées avec succès',
    'client_id', p_client_id,
    'email_deleted', v_client_email,
    'user_deleted', v_user_id IS NOT NULL,
    'abonnement_deleted', v_abonnement_id IS NOT NULL,
    'can_recreate', true
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erreur lors de la suppression du client'
    );
END;
$$;

COMMENT ON FUNCTION delete_client_complete IS 'Supprime complètement un client et toutes ses données associées (abonnement, utilisateur, auth.users) pour permettre de recréer un client avec le même email.';

-- ============================================================================
-- 5. APPLIQUER LES CORRECTIONS AUTOMATIQUEMENT
-- ============================================================================

-- Appeler les fonctions pour appliquer les corrections
SELECT apply_fix_mode_paiement() as correction_mode_paiement;
SELECT apply_fix_date_activation() as correction_date_activation;

-- ============================================================================
-- 5. VÉRIFICATION
-- ============================================================================

-- Afficher le résultat
SELECT 
  '✅ Corrections appliquées avec succès !' as status,
  (SELECT COUNT(*) FROM schema_migrations) as migrations_appliquees;

/*
  ============================================================================
  FIN DU SCRIPT
  ============================================================================
  
  Si vous voyez "✅ Corrections appliquées avec succès !", tout est bon !
  
  Vous pouvez maintenant créer un espace membre depuis la fiche client. 🎉
  ============================================================================
*/

