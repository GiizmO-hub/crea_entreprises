/*
  # Ajouter les champs pour convention collective et taux de cotisations
  
  Cette migration ajoute les champs nécessaires pour gérer les conventions collectives
  et récupérer automatiquement les taux de cotisations.
*/

-- 1. Ajouter convention collective à entreprises
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises' AND column_name = 'convention_collective'
  ) THEN
    ALTER TABLE entreprises ADD COLUMN convention_collective text;
    COMMENT ON COLUMN entreprises.convention_collective IS 'Code de la convention collective (ex: IDCC1486 pour Syntec)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprises' AND column_name = 'secteur_activite'
  ) THEN
    ALTER TABLE entreprises ADD COLUMN secteur_activite text;
    COMMENT ON COLUMN entreprises.secteur_activite IS 'Secteur d''activité principal de l''entreprise';
  END IF;
END $$;

-- 2. Ajouter convention collective et poste à collaborateurs_entreprise
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'convention_collective'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN convention_collective text;
    COMMENT ON COLUMN collaborateurs_entreprise.convention_collective IS 'Convention collective spécifique au collaborateur (hérite de l''entreprise si null)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'poste'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN poste text;
    COMMENT ON COLUMN collaborateurs_entreprise.poste IS 'Poste occupé (ex: Cadre, ETAM, Ouvrier)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaborateurs_entreprise' AND column_name = 'coefficient'
  ) THEN
    ALTER TABLE collaborateurs_entreprise ADD COLUMN coefficient integer;
    COMMENT ON COLUMN collaborateurs_entreprise.coefficient IS 'Coefficient de la grille de salaire conventionnelle';
  END IF;
END $$;

-- 3. Créer table conventions_collectives pour stocker les taux
CREATE TABLE IF NOT EXISTS conventions_collectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_idcc text UNIQUE NOT NULL,
  libelle text NOT NULL,
  secteur_activite text,
  annee integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  
  -- Taux salariaux (en %)
  taux_ss_maladie_sal numeric(5, 4) DEFAULT 0.0075,
  taux_ss_vieil_plaf_sal numeric(5, 4) DEFAULT 0.006,
  taux_ss_vieil_deplaf_sal numeric(5, 4) DEFAULT 0.004,
  taux_ass_chomage_sal numeric(5, 4) DEFAULT 0.024,
  taux_ret_compl_sal numeric(5, 4) DEFAULT 0.0315,
  taux_csg_ded_sal numeric(5, 4) DEFAULT 0.0525,
  taux_csg_non_ded_sal numeric(5, 4) DEFAULT 0.029,
  
  -- Taux patronaux (en %)
  taux_ss_maladie_pat numeric(5, 4) DEFAULT 0.07,
  taux_ss_vieil_plaf_pat numeric(5, 4) DEFAULT 0.0855,
  taux_ss_vieil_deplaf_pat numeric(5, 4) DEFAULT 0.019,
  taux_alloc_fam_pat numeric(5, 4) DEFAULT 0.0345,
  taux_at_mp_pat numeric(5, 4) DEFAULT 0.015,
  taux_ass_chomage_pat numeric(5, 4) DEFAULT 0.0405,
  taux_ret_compl_pat numeric(5, 4) DEFAULT 0.0472,
  
  -- Métadonnées
  source_url text,
  date_mise_a_jour date DEFAULT CURRENT_DATE,
  est_actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conventions_collectives_code ON conventions_collectives(code_idcc);
CREATE INDEX IF NOT EXISTS idx_conventions_collectives_secteur ON conventions_collectives(secteur_activite);
CREATE INDEX IF NOT EXISTS idx_conventions_collectives_annee ON conventions_collectives(annee);

-- 4. Créer table taux_cotisations_poste pour les taux spécifiques par poste
CREATE TABLE IF NOT EXISTS taux_cotisations_poste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_collective_id uuid REFERENCES conventions_collectives(id) ON DELETE CASCADE,
  poste text NOT NULL, -- Ex: 'Cadre', 'ETAM', 'Ouvrier', 'Agent de maîtrise'
  coefficient_min integer,
  coefficient_max integer,
  
  -- Taux spécifiques pour ce poste (peuvent surcharger ceux de la convention)
  taux_ss_maladie_sal numeric(5, 4),
  taux_ss_vieil_plaf_sal numeric(5, 4),
  taux_ss_vieil_deplaf_sal numeric(5, 4),
  taux_ass_chomage_sal numeric(5, 4),
  taux_ret_compl_sal numeric(5, 4),
  taux_csg_ded_sal numeric(5, 4),
  taux_csg_non_ded_sal numeric(5, 4),
  
  taux_ss_maladie_pat numeric(5, 4),
  taux_ss_vieil_plaf_pat numeric(5, 4),
  taux_ss_vieil_deplaf_pat numeric(5, 4),
  taux_alloc_fam_pat numeric(5, 4),
  taux_at_mp_pat numeric(5, 4),
  taux_ass_chomage_pat numeric(5, 4),
  taux_ret_compl_pat numeric(5, 4),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(convention_collective_id, poste, coefficient_min, coefficient_max)
);

CREATE INDEX IF NOT EXISTS idx_taux_cotisations_poste_convention ON taux_cotisations_poste(convention_collective_id);
CREATE INDEX IF NOT EXISTS idx_taux_cotisations_poste_poste ON taux_cotisations_poste(poste);

-- 5. Fonction pour récupérer les taux d'un collaborateur
CREATE OR REPLACE FUNCTION get_taux_cotisations(
  p_entreprise_id uuid,
  p_collaborateur_id uuid
)
RETURNS TABLE (
  taux_ss_maladie_sal numeric,
  taux_ss_vieil_plaf_sal numeric,
  taux_ss_vieil_deplaf_sal numeric,
  taux_ass_chomage_sal numeric,
  taux_ret_compl_sal numeric,
  taux_csg_ded_sal numeric,
  taux_csg_non_ded_sal numeric,
  taux_ss_maladie_pat numeric,
  taux_ss_vieil_plaf_pat numeric,
  taux_ss_vieil_deplaf_pat numeric,
  taux_alloc_fam_pat numeric,
  taux_at_mp_pat numeric,
  taux_ass_chomage_pat numeric,
  taux_ret_compl_pat numeric
) AS $$
DECLARE
  v_convention_code text;
  v_poste text;
  v_coefficient integer;
  v_convention_id uuid;
  v_annee integer := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  -- Récupérer les infos du collaborateur et de l'entreprise
  SELECT 
    COALESCE(c.convention_collective, e.convention_collective),
    c.poste,
    c.coefficient
  INTO v_convention_code, v_poste, v_coefficient
  FROM collaborateurs_entreprise c
  JOIN entreprises e ON e.id = c.entreprise_id
  WHERE c.id = p_collaborateur_id AND c.entreprise_id = p_entreprise_id;
  
  -- Si pas de convention, retourner les taux par défaut (généraux URSSAF)
  IF v_convention_code IS NULL THEN
    RETURN QUERY SELECT
      0.0075::numeric,  -- SS Maladie salariale
      0.006::numeric,   -- SS Vieillesse plafonnée salariale
      0.004::numeric,   -- SS Vieillesse déplafonnée salariale
      0.024::numeric,   -- Assurance chômage salariale
      0.0315::numeric,  -- Retraite complémentaire salariale
      0.0525::numeric,  -- CSG déductible salariale
      0.029::numeric,   -- CSG non déductible salariale
      0.07::numeric,    -- SS Maladie patronale
      0.0855::numeric,  -- SS Vieillesse plafonnée patronale
      0.019::numeric,   -- SS Vieillesse déplafonnée patronale
      0.0345::numeric,  -- Allocations familiales patronale
      0.015::numeric,   -- AT/MP patronale
      0.0405::numeric,  -- Assurance chômage patronale
      0.0472::numeric;  -- Retraite complémentaire patronale
    RETURN;
  END IF;
  
  -- Trouver la convention collective
  SELECT id INTO v_convention_id
  FROM conventions_collectives
  WHERE code_idcc = v_convention_code
    AND annee = v_annee
    AND est_actif = true
  ORDER BY date_mise_a_jour DESC
  LIMIT 1;
  
  -- Si convention trouvée et poste spécifié, chercher des taux spécifiques au poste
  IF v_convention_id IS NOT NULL AND v_poste IS NOT NULL THEN
    RETURN QUERY SELECT
      COALESCE(tcp.taux_ss_maladie_sal, cc.taux_ss_maladie_sal),
      COALESCE(tcp.taux_ss_vieil_plaf_sal, cc.taux_ss_vieil_plaf_sal),
      COALESCE(tcp.taux_ss_vieil_deplaf_sal, cc.taux_ss_vieil_deplaf_sal),
      COALESCE(tcp.taux_ass_chomage_sal, cc.taux_ass_chomage_sal),
      COALESCE(tcp.taux_ret_compl_sal, cc.taux_ret_compl_sal),
      COALESCE(tcp.taux_csg_ded_sal, cc.taux_csg_ded_sal),
      COALESCE(tcp.taux_csg_non_ded_sal, cc.taux_csg_non_ded_sal),
      COALESCE(tcp.taux_ss_maladie_pat, cc.taux_ss_maladie_pat),
      COALESCE(tcp.taux_ss_vieil_plaf_pat, cc.taux_ss_vieil_plaf_pat),
      COALESCE(tcp.taux_ss_vieil_deplaf_pat, cc.taux_ss_vieil_deplaf_pat),
      COALESCE(tcp.taux_alloc_fam_pat, cc.taux_alloc_fam_pat),
      COALESCE(tcp.taux_at_mp_pat, cc.taux_at_mp_pat),
      COALESCE(tcp.taux_ass_chomage_pat, cc.taux_ass_chomage_pat),
      COALESCE(tcp.taux_ret_compl_pat, cc.taux_ret_compl_pat)
    FROM conventions_collectives cc
    LEFT JOIN taux_cotisations_poste tcp ON tcp.convention_collective_id = cc.id
      AND tcp.poste = v_poste
      AND (v_coefficient IS NULL OR (tcp.coefficient_min IS NULL OR tcp.coefficient_min <= v_coefficient)
        AND (tcp.coefficient_max IS NULL OR tcp.coefficient_max >= v_coefficient))
    WHERE cc.id = v_convention_id
    LIMIT 1;
    
    -- Si des résultats trouvés, retourner
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  
  -- Sinon, retourner les taux de la convention générale
  IF v_convention_id IS NOT NULL THEN
    RETURN QUERY SELECT
      cc.taux_ss_maladie_sal,
      cc.taux_ss_vieil_plaf_sal,
      cc.taux_ss_vieil_deplaf_sal,
      cc.taux_ass_chomage_sal,
      cc.taux_ret_compl_sal,
      cc.taux_csg_ded_sal,
      cc.taux_csg_non_ded_sal,
      cc.taux_ss_maladie_pat,
      cc.taux_ss_vieil_plaf_pat,
      cc.taux_ss_vieil_deplaf_pat,
      cc.taux_alloc_fam_pat,
      cc.taux_at_mp_pat,
      cc.taux_ass_chomage_pat,
      cc.taux_ret_compl_pat
    FROM conventions_collectives cc
    WHERE cc.id = v_convention_id;
    RETURN;
  END IF;
  
  -- Fallback : taux par défaut
  RETURN QUERY SELECT
    0.0075::numeric, 0.006::numeric, 0.004::numeric, 0.024::numeric,
    0.0315::numeric, 0.0525::numeric, 0.029::numeric,
    0.07::numeric, 0.0855::numeric, 0.019::numeric, 0.0345::numeric,
    0.015::numeric, 0.0405::numeric, 0.0472::numeric;
END;
$$ LANGUAGE plpgsql;

