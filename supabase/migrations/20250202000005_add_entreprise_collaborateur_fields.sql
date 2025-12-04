/*
  # Ajouter les champs pour entreprises et collaborateurs
  
  Cette migration ajoute les champs demandés :
  - Pour entreprises : code APE/NAF, convention collective
  - Pour collaborateurs : n° sécurité sociale, code URSSAF, emploi, statut professionnel, 
    échelon, date entrée, ancienneté, convention collective, matricule
*/

-- 1. Ajouter code APE/NAF à entreprises
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises' AND column_name = 'code_ape'
  ) THEN
    ALTER TABLE entreprises ADD COLUMN code_ape text;
    COMMENT ON COLUMN entreprises.code_ape IS 'Code APE (Activité Principale Exercée) / NAF';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises' AND column_name = 'code_naf'
  ) THEN
    ALTER TABLE entreprises ADD COLUMN code_naf text;
    COMMENT ON COLUMN entreprises.code_naf IS 'Code NAF (Nomenclature d''Activités Française)';
  END IF;
END $$;

-- 2. Ajouter les champs détaillés aux collaborateurs
DO $$
BEGIN
  -- Numéro de sécurité sociale
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'numero_securite_sociale'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN numero_securite_sociale text;
    COMMENT ON COLUMN collaborateurs_entreprise.numero_securite_sociale IS 'Numéro de sécurité sociale (15 chiffres)';
  END IF;

  -- Code URSSAF
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'code_urssaf'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN code_urssaf text;
    COMMENT ON COLUMN collaborateurs_entreprise.code_urssaf IS 'Code URSSAF de l''établissement';
  END IF;

  -- Emploi
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'emploi'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN emploi text;
    COMMENT ON COLUMN collaborateurs_entreprise.emploi IS 'Intitulé du poste/emploi';
  END IF;

  -- Statut professionnel
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'statut_professionnel'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN statut_professionnel text;
    COMMENT ON COLUMN collaborateurs_entreprise.statut_professionnel IS 'Statut professionnel (CDI, CDD, Stage, etc.)';
  END IF;

  -- Échelon
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'echelon'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN echelon text;
    COMMENT ON COLUMN collaborateurs_entreprise.echelon IS 'Échelon dans la grille de salaire';
  END IF;

  -- Date d'entrée (si date_embauche n'existe pas déjà)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'date_entree'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN date_entree date;
    COMMENT ON COLUMN collaborateurs_entreprise.date_entree IS 'Date d''entrée dans l''entreprise';
  END IF;

  -- Ancienneté (calculée ou stockée)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'anciennete_annees'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN anciennete_annees numeric(5, 2);
    COMMENT ON COLUMN collaborateurs_entreprise.anciennete_annees IS 'Ancienneté en années (peut être calculée automatiquement)';
  END IF;

  -- Convention collective (numéro)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'convention_collective_numero'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN convention_collective_numero text;
    COMMENT ON COLUMN collaborateurs_entreprise.convention_collective_numero IS 'Numéro de la convention collective (ex: IDCC1486)';
  END IF;

  -- Convention collective (nom)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'convention_collective_nom'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN convention_collective_nom text;
    COMMENT ON COLUMN collaborateurs_entreprise.convention_collective_nom IS 'Nom de la convention collective';
  END IF;

  -- Matricule
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'matricule'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN matricule text;
    COMMENT ON COLUMN collaborateurs_entreprise.matricule IS 'Matricule du collaborateur dans l''entreprise';
  END IF;
END $$;

-- 3. Créer index pour recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_collaborateurs_matricule ON collaborateurs_entreprise(entreprise_id, matricule) WHERE matricule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collaborateurs_numero_secu ON collaborateurs_entreprise(numero_securite_sociale) WHERE numero_securite_sociale IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entreprises_code_ape ON entreprises(code_ape) WHERE code_ape IS NOT NULL;

-- 4. Fonction pour calculer l'ancienneté automatiquement
CREATE OR REPLACE FUNCTION calculer_anciennete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_entree IS NOT NULL THEN
    NEW.anciennete_annees := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_entree)) + 
                            EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.date_entree)) / 12.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer l'ancienneté automatiquement
DROP TRIGGER IF EXISTS trigger_calculer_anciennete ON collaborateurs_entreprise;
CREATE TRIGGER trigger_calculer_anciennete
  BEFORE INSERT OR UPDATE OF date_entree ON collaborateurs_entreprise
  FOR EACH ROW
  EXECUTE FUNCTION calculer_anciennete();

-- 5. Fonction pour mettre à jour l'ancienneté périodiquement (optionnel)
CREATE OR REPLACE FUNCTION mettre_a_jour_anciennete()
RETURNS void AS $$
BEGIN
  UPDATE collaborateurs_entreprise
  SET anciennete_annees = EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_entree)) + 
                          EXTRACT(MONTH FROM AGE(CURRENT_DATE, date_entree)) / 12.0
  WHERE date_entree IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

