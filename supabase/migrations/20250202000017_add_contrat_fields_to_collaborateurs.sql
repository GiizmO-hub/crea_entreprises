/*
  # Ajouter les champs pour le contrat détaillé à collaborateurs_entreprise
  
  Cette migration ajoute les champs nécessaires pour générer un contrat de travail détaillé (6-10 pages):
  - fonctions_poste: Description détaillée des fonctions
  - lieu_travail: Lieu de travail principal
  - periode_essai_jours: Durée de la période d'essai
  - horaires_travail: Horaires de travail
*/

-- Ajouter les colonnes si elles n'existent pas
DO $$
BEGIN
  -- Fonctions du poste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'fonctions_poste'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN fonctions_poste text;
    COMMENT ON COLUMN collaborateurs_entreprise.fonctions_poste IS 'Description détaillée des fonctions du poste pour le contrat de travail';
  END IF;

  -- Lieu de travail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'lieu_travail'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN lieu_travail text;
    COMMENT ON COLUMN collaborateurs_entreprise.lieu_travail IS 'Lieu de travail principal';
  END IF;

  -- Période d'essai
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'periode_essai_jours'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN periode_essai_jours integer;
    COMMENT ON COLUMN collaborateurs_entreprise.periode_essai_jours IS 'Durée de la période d''essai en jours';
  END IF;

  -- Horaires de travail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'horaires_travail'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN horaires_travail text;
    COMMENT ON COLUMN collaborateurs_entreprise.horaires_travail IS 'Horaires de travail détaillés';
  END IF;

  RAISE NOTICE '✅ Colonnes pour le contrat détaillé ajoutées à collaborateurs_entreprise';
END $$;

SELECT '✅ Migration terminée : colonnes pour contrat détaillé ajoutées' as resultat;

