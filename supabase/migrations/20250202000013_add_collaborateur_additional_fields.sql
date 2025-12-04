/*
  # Ajouter des champs supplémentaires pour les collaborateurs
  
  Cette migration ajoute des champs utiles pour la gestion complète des collaborateurs :
  - Informations de contrat (heures, forfait, type)
  - Mutuelle
  - Coordonnées bancaires
  - Informations personnelles (date de naissance, adresse)
  - Personne à contacter en cas d'urgence
  - Permis de conduire
  - Statut cadre/non-cadre
*/

-- Ajouter les nouveaux champs à collaborateurs_entreprise
DO $$
BEGIN
  -- Nombre d'heures hebdomadaires
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'nombre_heures_hebdo'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN nombre_heures_hebdo numeric(5,2) DEFAULT 35.00;
    COMMENT ON COLUMN collaborateurs_entreprise.nombre_heures_hebdo IS 'Nombre d''heures hebdomadaires (défaut: 35h)';
  END IF;

  -- Nombre d'heures mensuelles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'nombre_heures_mensuelles'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN nombre_heures_mensuelles numeric(6,2);
    COMMENT ON COLUMN collaborateurs_entreprise.nombre_heures_mensuelles IS 'Nombre d''heures mensuelles (calculé automatiquement si vide)';
  END IF;

  -- Type de contrat (déjà existe comme statut_professionnel, mais on ajoute un champ plus détaillé)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'type_contrat'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN type_contrat text CHECK (type_contrat IN ('CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Interim', 'Autre'));
    COMMENT ON COLUMN collaborateurs_entreprise.type_contrat IS 'Type de contrat de travail';
  END IF;

  -- Forfait jours (pour les cadres)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'forfait_jours'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN forfait_jours integer;
    COMMENT ON COLUMN collaborateurs_entreprise.forfait_jours IS 'Forfait jours annuel (pour cadres, ex: 218 jours)';
  END IF;

  -- Statut cadre/non-cadre
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'est_cadre'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN est_cadre boolean DEFAULT false;
    COMMENT ON COLUMN collaborateurs_entreprise.est_cadre IS 'Indique si le collaborateur est cadre';
  END IF;

  -- Mutuelle (oui/non)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'a_mutuelle'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN a_mutuelle boolean DEFAULT false;
    COMMENT ON COLUMN collaborateurs_entreprise.a_mutuelle IS 'Indique si le collaborateur a une mutuelle';
  END IF;

  -- Nom de la mutuelle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'mutuelle_nom'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN mutuelle_nom text;
    COMMENT ON COLUMN collaborateurs_entreprise.mutuelle_nom IS 'Nom de la mutuelle (ex: MGEN, Harmonie Mutuelle)';
  END IF;

  -- Numéro d'adhérent mutuelle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'mutuelle_numero_adherent'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN mutuelle_numero_adherent text;
    COMMENT ON COLUMN collaborateurs_entreprise.mutuelle_numero_adherent IS 'Numéro d''adhérent à la mutuelle';
  END IF;

  -- Date de naissance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'date_naissance'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN date_naissance date;
    COMMENT ON COLUMN collaborateurs_entreprise.date_naissance IS 'Date de naissance du collaborateur';
  END IF;

  -- Adresse postale
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'adresse'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN adresse text;
    COMMENT ON COLUMN collaborateurs_entreprise.adresse IS 'Adresse postale complète';
  END IF;

  -- Code postal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'code_postal'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN code_postal text;
    COMMENT ON COLUMN collaborateurs_entreprise.code_postal IS 'Code postal';
  END IF;

  -- Ville
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'ville'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN ville text;
    COMMENT ON COLUMN collaborateurs_entreprise.ville IS 'Ville';
  END IF;

  -- Coordonnées bancaires - IBAN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'iban'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN iban text;
    COMMENT ON COLUMN collaborateurs_entreprise.iban IS 'IBAN pour le virement de salaire';
  END IF;

  -- Coordonnées bancaires - BIC
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'bic'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN bic text;
    COMMENT ON COLUMN collaborateurs_entreprise.bic IS 'BIC (Bank Identifier Code)';
  END IF;

  -- Personne à contacter en cas d'urgence - Nom
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'contact_urgence_nom'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN contact_urgence_nom text;
    COMMENT ON COLUMN collaborateurs_entreprise.contact_urgence_nom IS 'Nom de la personne à contacter en cas d''urgence';
  END IF;

  -- Personne à contacter en cas d'urgence - Prénom
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'contact_urgence_prenom'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN contact_urgence_prenom text;
    COMMENT ON COLUMN collaborateurs_entreprise.contact_urgence_prenom IS 'Prénom de la personne à contacter en cas d''urgence';
  END IF;

  -- Personne à contacter en cas d'urgence - Téléphone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'contact_urgence_telephone'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN contact_urgence_telephone text;
    COMMENT ON COLUMN collaborateurs_entreprise.contact_urgence_telephone IS 'Téléphone de la personne à contacter en cas d''urgence';
  END IF;

  -- Personne à contacter en cas d'urgence - Lien
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'contact_urgence_lien'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN contact_urgence_lien text;
    COMMENT ON COLUMN collaborateurs_entreprise.contact_urgence_lien IS 'Lien avec la personne à contacter (ex: Conjoint, Parent, Ami)';
  END IF;

  -- Permis de conduire
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'a_permis_conduire'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN a_permis_conduire boolean DEFAULT false;
    COMMENT ON COLUMN collaborateurs_entreprise.a_permis_conduire IS 'Indique si le collaborateur a le permis de conduire';
  END IF;

  -- Catégorie du permis
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'permis_categorie'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN permis_categorie text;
    COMMENT ON COLUMN collaborateurs_entreprise.permis_categorie IS 'Catégorie du permis (A, B, C, D, etc.)';
  END IF;

  -- Date d'obtention du permis
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
    AND column_name = 'permis_date_obtention'
  ) THEN
    ALTER TABLE collaborateurs_entreprise
    ADD COLUMN permis_date_obtention date;
    COMMENT ON COLUMN collaborateurs_entreprise.permis_date_obtention IS 'Date d''obtention du permis de conduire';
  END IF;

  RAISE NOTICE '✅ Tous les champs supplémentaires ont été ajoutés à collaborateurs_entreprise';
END $$;

-- Créer un trigger pour calculer automatiquement les heures mensuelles si vide
CREATE OR REPLACE FUNCTION calculate_heures_mensuelles()
RETURNS TRIGGER AS $$
BEGIN
  -- Si nombre_heures_mensuelles est NULL et nombre_heures_hebdo est défini, calculer
  IF NEW.nombre_heures_mensuelles IS NULL AND NEW.nombre_heures_hebdo IS NOT NULL THEN
    -- Calcul approximatif : heures hebdo * 52 / 12 (ou plus précis : heures hebdo * 4.33)
    NEW.nombre_heures_mensuelles := ROUND((NEW.nombre_heures_hebdo * 52.0 / 12.0)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_heures_mensuelles ON collaborateurs_entreprise;
CREATE TRIGGER trigger_calculate_heures_mensuelles
  BEFORE INSERT OR UPDATE ON collaborateurs_entreprise
  FOR EACH ROW
  EXECUTE FUNCTION calculate_heures_mensuelles();

