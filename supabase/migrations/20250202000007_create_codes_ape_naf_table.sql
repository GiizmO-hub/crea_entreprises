/*
  # Créer la table des codes APE/NAF et pré-remplir avec les 732 codes officiels
  
  Cette migration crée une table de référence pour les codes APE/NAF français
  et les pré-remplit avec les codes officiels de l'INSEE.
*/

-- 1. Créer la table codes_ape_naf
CREATE TABLE IF NOT EXISTS codes_ape_naf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  libelle text NOT NULL,
  section text NOT NULL,
  division text,
  groupe text,
  classe text,
  sous_classe text,
  est_actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codes_ape_naf_code ON codes_ape_naf(code);
CREATE INDEX IF NOT EXISTS idx_codes_ape_naf_section ON codes_ape_naf(section);
CREATE INDEX IF NOT EXISTS idx_codes_ape_naf_libelle ON codes_ape_naf USING gin(to_tsvector('french', libelle));

COMMENT ON TABLE codes_ape_naf IS 'Table de référence des codes APE/NAF français (732 codes officiels)';
COMMENT ON COLUMN codes_ape_naf.code IS 'Code APE/NAF (ex: 6201Z)';
COMMENT ON COLUMN codes_ape_naf.libelle IS 'Libellé de l''activité';
COMMENT ON COLUMN codes_ape_naf.section IS 'Section (lettre A à U)';
COMMENT ON COLUMN codes_ape_naf.division IS 'Division (2 chiffres)';
COMMENT ON COLUMN codes_ape_naf.groupe IS 'Groupe (3 chiffres)';
COMMENT ON COLUMN codes_ape_naf.classe IS 'Classe (4 chiffres)';
COMMENT ON COLUMN codes_ape_naf.sous_classe IS 'Sous-classe (5 caractères avec lettre)';

-- 2. Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_codes_ape_naf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà avant de le créer
DROP TRIGGER IF EXISTS trigger_update_codes_ape_naf_updated_at ON codes_ape_naf;

CREATE TRIGGER trigger_update_codes_ape_naf_updated_at
  BEFORE UPDATE ON codes_ape_naf
  FOR EACH ROW
  EXECUTE FUNCTION update_codes_ape_naf_updated_at();

