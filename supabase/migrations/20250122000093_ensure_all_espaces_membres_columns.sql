/*
  # ASSURER que TOUTES les colonnes existent dans espaces_membres_clients
  
  PROBLÈME:
  - Erreur: column "statut_compte" of relation "espaces_membres_clients" does not exist
  - Les colonnes utilisées dans create_espace_membre_from_client_unified n'existent pas toutes
  
  SOLUTION:
  - Vérifier et créer TOUTES les colonnes nécessaires
  - S'assurer que la table est complète
  
  MÉTHODOLOGIE: CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD
*/

-- 1. Vérifier et créer toutes les colonnes nécessaires pour espaces_membres_clients
DO $$
BEGIN
  -- statut_compte
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'statut_compte'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN statut_compte text DEFAULT 'en_attente';
    RAISE NOTICE '✅ Colonne statut_compte ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne statut_compte existe déjà';
  END IF;

  -- configuration_validee
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'configuration_validee'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN configuration_validee boolean DEFAULT false;
    RAISE NOTICE '✅ Colonne configuration_validee ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne configuration_validee existe déjà';
  END IF;

  -- email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN email text;
    RAISE NOTICE '✅ Colonne email ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne email existe déjà';
  END IF;

  -- abonnement_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'abonnement_id'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN abonnement_id uuid REFERENCES abonnements(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Colonne abonnement_id ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne abonnement_id existe déjà';
  END IF;

  -- password_temporaire (optionnel mais utile)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'password_temporaire'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN password_temporaire text;
    RAISE NOTICE '✅ Colonne password_temporaire ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne password_temporaire existe déjà';
  END IF;

  -- doit_changer_password
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'doit_changer_password'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN doit_changer_password boolean DEFAULT true;
    RAISE NOTICE '✅ Colonne doit_changer_password ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne doit_changer_password existe déjà';
  END IF;

  -- email_envoye
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'email_envoye'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD COLUMN email_envoye boolean DEFAULT false;
    RAISE NOTICE '✅ Colonne email_envoye ajoutée';
  ELSE
    RAISE NOTICE '✅ Colonne email_envoye existe déjà';
  END IF;
END $$;

-- 2. Créer/modifier la contrainte CHECK pour statut_compte
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  ALTER TABLE espaces_membres_clients 
  DROP CONSTRAINT IF EXISTS espaces_membres_clients_statut_compte_check;
  
  ALTER TABLE espaces_membres_clients 
  DROP CONSTRAINT IF EXISTS statut_compte_check;
  
  -- Créer la nouvelle contrainte
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'espaces_membres_clients' 
    AND column_name = 'statut_compte'
  ) THEN
    ALTER TABLE espaces_membres_clients 
    ADD CONSTRAINT espaces_membres_clients_statut_compte_check 
    CHECK (statut_compte IN ('en_attente', 'actif', 'suspendu', 'inactif'));
    
    RAISE NOTICE '✅ Contrainte statut_compte créée';
  END IF;
END $$;

-- 3. Créer les index si nécessaire
CREATE INDEX IF NOT EXISTS idx_espaces_membres_email 
ON espaces_membres_clients(email);

CREATE INDEX IF NOT EXISTS idx_espaces_membres_statut_compte 
ON espaces_membres_clients(statut_compte);

CREATE INDEX IF NOT EXISTS idx_espaces_membres_configuration_validee 
ON espaces_membres_clients(configuration_validee);

-- 4. Mettre à jour les valeurs par défaut pour les espaces existants
UPDATE espaces_membres_clients
SET statut_compte = COALESCE(statut_compte, 
  CASE 
    WHEN actif = true THEN 'actif'
    ELSE 'en_attente'
  END
)
WHERE statut_compte IS NULL;

UPDATE espaces_membres_clients
SET configuration_validee = COALESCE(configuration_validee, false)
WHERE configuration_validee IS NULL;

-- 5. Log de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅✅✅ TOUTES LES COLONNES DE espaces_membres_clients SONT PRÊTES! ✅✅✅';
END $$;




