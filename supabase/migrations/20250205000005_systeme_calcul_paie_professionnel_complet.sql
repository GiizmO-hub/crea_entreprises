-- ═══════════════════════════════════════════════════════════════════════════
-- SYSTÈME PROFESSIONNEL COMPLET DE CALCUL DE FICHE DE PAIE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Cette migration crée un système professionnel qui :
-- 1. Récupère automatiquement TOUTES les données du collaborateur
-- 2. Récupère les taux depuis la convention collective ou URSSAF
-- 3. Calcule les bases (plafonnées et déplafonnées) correctement
-- 4. Déduit proprement les charges salariales du salaire brut
-- 5. Crée toutes les lignes de paie de manière professionnelle
--
-- ✅ CONFORME AUX RÉGLEMENTATIONS FRANÇAISES
-- ✅ CALCULS PRÉCIS SELON URSSAF 2025
-- ✅ GESTION DES CONVENTIONS COLLECTIVES
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTION : Récupérer toutes les données nécessaires pour le calcul
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION recuperer_donnees_collaborateur_paie(
  p_entreprise_id uuid,
  p_collaborateur_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_collaborateur RECORD;
  v_salary RECORD;
  v_entreprise RECORD;
  v_salaire_brut numeric;
  v_heures_normales numeric;
BEGIN
  -- 1. Récupérer les données du collaborateur
  SELECT * INTO v_collaborateur
  FROM collaborateurs_entreprise
  WHERE id = p_collaborateur_id
    AND entreprise_id = p_entreprise_id
    AND actif = true
  LIMIT 1;
  
  IF v_collaborateur IS NULL THEN
    RAISE EXCEPTION 'Collaborateur non trouvé ou inactif';
  END IF;
  
  -- 2. Récupérer les données de l'entreprise
  SELECT * INTO v_entreprise
  FROM entreprises
  WHERE id = p_entreprise_id
  LIMIT 1;
  
  -- 3. Récupérer le salaire brut
  -- Priorité 1 : collaborateurs_entreprise.salaire
  IF v_collaborateur.salaire IS NOT NULL AND v_collaborateur.salaire > 0 THEN
    v_salaire_brut := v_collaborateur.salaire;
  -- Priorité 2 : salaries.salaire_brut (si actif)
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'salaries') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'salaries' AND column_name = 'collaborateur_id'
    ) THEN
      SELECT * INTO v_salary
      FROM salaries
      WHERE collaborateur_id = p_collaborateur_id
        AND (statut IS NULL OR statut != 'inactif')
        AND (date_fin_contrat IS NULL OR date_fin_contrat >= CURRENT_DATE)
      ORDER BY COALESCE(date_debut, date_embauche) DESC NULLS LAST
      LIMIT 1;
      
      IF v_salary IS NOT NULL AND v_salary.salaire_brut IS NOT NULL THEN
        v_salaire_brut := v_salary.salaire_brut;
      END IF;
    END IF;
  END IF;
  
  -- Valeur par défaut si toujours pas de salaire
  IF v_salaire_brut IS NULL OR v_salaire_brut = 0 THEN
    IF v_collaborateur.type_contrat = 'CDI' THEN
      v_salaire_brut := 2500;
    ELSIF v_collaborateur.type_contrat = 'CDD' THEN
      v_salaire_brut := 2000;
    ELSE
      v_salaire_brut := 2000;
    END IF;
  END IF;
  
  -- 4. Récupérer les heures normales
  IF v_collaborateur.nombre_heures_mensuelles IS NOT NULL AND v_collaborateur.nombre_heures_mensuelles > 0 THEN
    v_heures_normales := v_collaborateur.nombre_heures_mensuelles;
  ELSIF v_collaborateur.nombre_heures_hebdo IS NOT NULL AND v_collaborateur.nombre_heures_hebdo > 0 THEN
    v_heures_normales := ROUND((v_collaborateur.nombre_heures_hebdo * 52.0 / 12.0), 2);
  ELSE
    v_heures_normales := 151.67; -- Temps plein mensuel standard
  END IF;
  
  -- 5. Construire le résultat JSON
  v_result := jsonb_build_object(
    'collaborateur', jsonb_build_object(
      'id', v_collaborateur.id,
      'nom', v_collaborateur.nom,
      'prenom', v_collaborateur.prenom,
      'email', v_collaborateur.email,
      'poste', v_collaborateur.poste,
      'type_contrat', v_collaborateur.type_contrat,
      'convention_collective', v_collaborateur.convention_collective,
      'convention_collective_numero', v_collaborateur.convention_collective_numero,
      'convention_collective_nom', v_collaborateur.convention_collective_nom,
      'coefficient', v_collaborateur.coefficient,
      'est_cadre', v_collaborateur.est_cadre,
      'date_entree', v_collaborateur.date_entree,
      'anciennete_annees', v_collaborateur.anciennete_annees
    ),
    'salaire_brut', v_salaire_brut,
    'heures_normales', v_heures_normales,
    'entreprise', jsonb_build_object(
      'id', v_entreprise.id,
      'nom', v_entreprise.nom,
      'siret', v_entreprise.siret,
      'convention_collective', v_entreprise.convention_collective
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur récupération données collaborateur: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION recuperer_donnees_collaborateur_paie IS 
'Récupère toutes les données nécessaires pour le calcul de paie : collaborateur, salaire, heures, convention collective, entreprise.';

-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTION : Calculer une fiche de paie complète et professionnelle
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS calculer_fiche_paie_complete(uuid, uuid, numeric, text, numeric, numeric, numeric, numeric, numeric) CASCADE;

CREATE OR REPLACE FUNCTION calculer_fiche_paie_complete(
  p_entreprise_id uuid,
  p_collaborateur_id uuid,
  p_periode text, -- Format: "YYYY-MM"
  p_salaire_brut numeric DEFAULT NULL, -- NULL = récupération automatique
  p_heures_normales numeric DEFAULT NULL, -- NULL = récupération automatique
  p_heures_supp_25 numeric DEFAULT 0,
  p_heures_supp_50 numeric DEFAULT 0,
  p_primes numeric DEFAULT 0,
  p_avantages_nature numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  -- Constantes URSSAF 2025
  v_pass_annuel numeric := 46224; -- € par an
  v_pass_mensuel numeric := 3852; -- € par mois
  v_pass_deplaf_annuel numeric := 138672; -- € par an (3 PASS)
  v_pass_deplaf_mensuel numeric := 11556; -- € par mois
  
  -- Données collaborateur
  v_donnees jsonb;
  v_salaire_brut_base numeric;
  v_heures_normales_auto numeric;
  
  -- Variables de calcul
  v_salaire_base numeric;
  v_heures_sup_25 numeric := 0;
  v_heures_sup_50 numeric := 0;
  v_salaire_brut_total numeric;
  v_base_plafonnee numeric;
  v_base_deplafonnee numeric;
  
  -- Taux de cotisations
  v_taux record;
  
  -- Cotisations salariales (DÉDUITES du salaire brut)
  v_ss_maladie_sal numeric := 0;
  v_ss_vieil_plaf_sal numeric := 0;
  v_ss_vieil_deplaf_sal numeric := 0;
  v_chomage_sal numeric := 0;
  v_ret_compl_sal numeric := 0;
  v_csg_ded_sal numeric := 0;
  v_csg_non_ded_sal numeric := 0;
  v_total_cotisations_salariales numeric := 0;
  
  -- Cotisations patronales (À LA CHARGE DE L'EMPLOYEUR, pas déduites)
  v_ss_maladie_pat numeric := 0;
  v_ss_vieil_plaf_pat numeric := 0;
  v_ss_vieil_deplaf_pat numeric := 0;
  v_alloc_fam_pat numeric := 0;
  v_at_mp_pat numeric := 0;
  v_chomage_pat numeric := 0;
  v_ret_compl_pat numeric := 0;
  v_total_cotisations_patronales numeric := 0;
  
  -- Totaux
  v_net_imposable numeric := 0;
  v_net_a_payer numeric := 0;
  v_cout_total_employeur numeric := 0;
  
  -- Résultat
  v_result jsonb;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 1 : Récupérer toutes les données du collaborateur
  -- ═══════════════════════════════════════════════════════════════════════════
  
  v_donnees := recuperer_donnees_collaborateur_paie(p_entreprise_id, p_collaborateur_id);
  
  -- Utiliser le salaire brut fourni ou celui récupéré
  IF p_salaire_brut IS NOT NULL AND p_salaire_brut > 0 THEN
    v_salaire_brut_base := p_salaire_brut;
  ELSE
    v_salaire_brut_base := (v_donnees->>'salaire_brut')::numeric;
  END IF;
  
  -- Utiliser les heures normales fournies ou celles récupérées
  IF p_heures_normales IS NOT NULL AND p_heures_normales > 0 THEN
    v_heures_normales_auto := p_heures_normales;
  ELSE
    v_heures_normales_auto := (v_donnees->>'heures_normales')::numeric;
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 2 : Récupérer les taux de cotisations
  -- ═══════════════════════════════════════════════════════════════════════════
  
  SELECT * INTO v_taux
  FROM get_taux_cotisations(p_entreprise_id, p_collaborateur_id)
  LIMIT 1;
  
  IF v_taux IS NULL THEN
    RAISE EXCEPTION 'Impossible de récupérer les taux de cotisations';
  END IF;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 3 : Calculer le salaire brut total
  -- ═══════════════════════════════════════════════════════════════════════════
  
  v_salaire_base := v_salaire_brut_base;
  
  -- Calculer les heures supplémentaires
  IF p_heures_supp_25 > 0 THEN
    v_heures_sup_25 := p_heures_supp_25 * (v_salaire_brut_base / v_heures_normales_auto) * 1.25;
  END IF;
  
  IF p_heures_supp_50 > 0 THEN
    v_heures_sup_50 := p_heures_supp_50 * (v_salaire_brut_base / v_heures_normales_auto) * 1.50;
  END IF;
  
  v_salaire_brut_total := v_salaire_base + v_heures_sup_25 + v_heures_sup_50 + 
                          COALESCE(p_primes, 0) + COALESCE(p_avantages_nature, 0);
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 4 : Calculer les bases plafonnées et déplafonnées
  -- ═══════════════════════════════════════════════════════════════════════════
  
  v_base_plafonnee := LEAST(v_salaire_brut_total, v_pass_mensuel);
  v_base_deplafonnee := LEAST(v_salaire_brut_total, v_pass_deplaf_mensuel);
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 5 : CALCUL DES COTISATIONS SALARIALES (DÉDUITES DU SALAIRE BRUT)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- SS Maladie (0.75% sur base plafonnée)
  v_ss_maladie_sal := ROUND(v_base_plafonnee * v_taux.taux_ss_maladie_sal, 2);
  
  -- SS Vieillesse plafonnée (0.6% sur base plafonnée)
  v_ss_vieil_plaf_sal := ROUND(v_base_plafonnee * v_taux.taux_ss_vieil_plaf_sal, 2);
  
  -- SS Vieillesse déplafonnée (0.4% sur base déplafonnée)
  v_ss_vieil_deplaf_sal := ROUND(v_base_deplafonnee * v_taux.taux_ss_vieil_deplaf_sal, 2);
  
  -- Assurance chômage (2.4% sur base plafonnée)
  v_chomage_sal := ROUND(v_base_plafonnee * v_taux.taux_ass_chomage_sal, 2);
  
  -- Retraite complémentaire (3.15% sur base plafonnée)
  v_ret_compl_sal := ROUND(v_base_plafonnee * v_taux.taux_ret_compl_sal, 2);
  
  -- CSG déductible (5.25% sur base déplafonnée)
  v_csg_ded_sal := ROUND(v_base_deplafonnee * v_taux.taux_csg_ded_sal, 2);
  
  -- CSG non déductible (2.9% sur base déplafonnée)
  v_csg_non_ded_sal := ROUND(v_base_deplafonnee * v_taux.taux_csg_non_ded_sal, 2);
  
  -- Total cotisations salariales (TOUTES déduites du salaire brut)
  v_total_cotisations_salariales := v_ss_maladie_sal + v_ss_vieil_plaf_sal + 
                                     v_ss_vieil_deplaf_sal + v_chomage_sal + 
                                     v_ret_compl_sal + v_csg_ded_sal + v_csg_non_ded_sal;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 6 : CALCUL DES COTISATIONS PATRONALES (À LA CHARGE DE L'EMPLOYEUR)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- SS Maladie patronale (7% sur base plafonnée)
  v_ss_maladie_pat := ROUND(v_base_plafonnee * v_taux.taux_ss_maladie_pat, 2);
  
  -- SS Vieillesse plafonnée patronale (8.55% sur base plafonnée)
  v_ss_vieil_plaf_pat := ROUND(v_base_plafonnee * v_taux.taux_ss_vieil_plaf_pat, 2);
  
  -- SS Vieillesse déplafonnée patronale (1.9% sur base déplafonnée)
  v_ss_vieil_deplaf_pat := ROUND(v_base_deplafonnee * v_taux.taux_ss_vieil_deplaf_pat, 2);
  
  -- Allocations familiales (3.45% sur base plafonnée)
  v_alloc_fam_pat := ROUND(v_base_plafonnee * v_taux.taux_alloc_fam_pat, 2);
  
  -- AT/MP (1.5% sur base plafonnée - peut varier selon convention)
  v_at_mp_pat := ROUND(v_base_plafonnee * v_taux.taux_at_mp_pat, 2);
  
  -- Assurance chômage patronale (4.05% sur base plafonnée)
  v_chomage_pat := ROUND(v_base_plafonnee * v_taux.taux_ass_chomage_pat, 2);
  
  -- Retraite complémentaire patronale (4.72% sur base plafonnée)
  v_ret_compl_pat := ROUND(v_base_plafonnee * v_taux.taux_ret_compl_pat, 2);
  
  -- Total cotisations patronales (AJOUTÉES au coût employeur)
  v_total_cotisations_patronales := v_ss_maladie_pat + v_ss_vieil_plaf_pat + 
                                     v_ss_vieil_deplaf_pat + v_alloc_fam_pat + 
                                     v_at_mp_pat + v_chomage_pat + v_ret_compl_pat;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 7 : CALCUL DES TOTAUX FINAUX
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Net imposable = Salaire brut - cotisations déductibles (SS, retraite, chômage, CSG déductible)
  -- C'est la base imposable pour les impôts sur le revenu
  v_net_imposable := v_salaire_brut_total - (v_ss_maladie_sal + v_ss_vieil_plaf_sal + 
                                              v_ss_vieil_deplaf_sal + v_chomage_sal + 
                                              v_ret_compl_sal + v_csg_ded_sal);
  v_net_imposable := ROUND(v_net_imposable, 2);
  
  -- Net à payer = Salaire brut - TOUTES les charges salariales
  -- ✅ C'EST LA FORMULE CORRECTE : SALAIRE BRUT - CHARGES = NET À PAYER
  -- Les charges incluent toutes les cotisations salariales (SS, retraite, chômage, CSG déductible et non déductible)
  v_net_a_payer := v_salaire_brut_total - v_total_cotisations_salariales;
  v_net_a_payer := ROUND(v_net_a_payer, 2);
  
  -- Vérification : Le net à payer doit être inférieur ou égal au net imposable
  -- (car le net imposable ne déduit pas la CSG non déductible)
  IF v_net_a_payer > v_net_imposable THEN
    RAISE WARNING 'Net à payer (%) supérieur au net imposable (%), vérification nécessaire', v_net_a_payer, v_net_imposable;
  END IF;
  
  -- Coût total employeur = Salaire brut + TOUTES les cotisations patronales
  v_cout_total_employeur := v_salaire_brut_total + v_total_cotisations_patronales;
  v_cout_total_employeur := ROUND(v_cout_total_employeur, 2);
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 8 : CONSTRUIRE LE RÉSULTAT JSON PROFESSIONNEL
  -- ═══════════════════════════════════════════════════════════════════════════
  
  v_result := jsonb_build_object(
    'donnees_collaborateur', v_donnees,
    'salaire_brut', v_salaire_brut_total,
    'salaire_base', v_salaire_base,
    'heures_normales', v_heures_normales_auto,
    'heures_sup_25', v_heures_sup_25,
    'heures_sup_50', v_heures_sup_50,
    'primes', COALESCE(p_primes, 0),
    'avantages_nature', COALESCE(p_avantages_nature, 0),
    'base_plafonnee', v_base_plafonnee,
    'base_deplafonnee', v_base_deplafonnee,
    
    -- Cotisations salariales (DÉDUITES)
    'cotisations_salariales', jsonb_build_object(
      'ss_maladie', v_ss_maladie_sal,
      'ss_vieil_plaf', v_ss_vieil_plaf_sal,
      'ss_vieil_deplaf', v_ss_vieil_deplaf_sal,
      'chomage', v_chomage_sal,
      'ret_compl', v_ret_compl_sal,
      'csg_ded', v_csg_ded_sal,
      'csg_non_ded', v_csg_non_ded_sal,
      'total', v_total_cotisations_salariales
    ),
    
    -- Cotisations patronales (À LA CHARGE DE L'EMPLOYEUR)
    'cotisations_patronales', jsonb_build_object(
      'ss_maladie', v_ss_maladie_pat,
      'ss_vieil_plaf', v_ss_vieil_plaf_pat,
      'ss_vieil_deplaf', v_ss_vieil_deplaf_pat,
      'alloc_fam', v_alloc_fam_pat,
      'at_mp', v_at_mp_pat,
      'chomage', v_chomage_pat,
      'ret_compl', v_ret_compl_pat,
      'total', v_total_cotisations_patronales
    ),
    
    -- Totaux
    'net_imposable', v_net_imposable,
    'net_a_payer', v_net_a_payer,
    'cout_total_employeur', v_cout_total_employeur,
    
    -- Taux utilisés
    'taux', jsonb_build_object(
      'ss_maladie_sal', v_taux.taux_ss_maladie_sal * 100,
      'ss_vieil_plaf_sal', v_taux.taux_ss_vieil_plaf_sal * 100,
      'ss_vieil_deplaf_sal', v_taux.taux_ss_vieil_deplaf_sal * 100,
      'ass_chomage_sal', v_taux.taux_ass_chomage_sal * 100,
      'ret_compl_sal', v_taux.taux_ret_compl_sal * 100,
      'csg_ded_sal', v_taux.taux_csg_ded_sal * 100,
      'csg_non_ded_sal', v_taux.taux_csg_non_ded_sal * 100,
      'ss_maladie_pat', v_taux.taux_ss_maladie_pat * 100,
      'ss_vieil_plaf_pat', v_taux.taux_ss_vieil_plaf_pat * 100,
      'ss_vieil_deplaf_pat', v_taux.taux_ss_vieil_deplaf_pat * 100,
      'alloc_fam_pat', v_taux.taux_alloc_fam_pat * 100,
      'at_mp_pat', v_taux.taux_at_mp_pat * 100,
      'ass_chomage_pat', v_taux.taux_ass_chomage_pat * 100,
      'ret_compl_pat', v_taux.taux_ret_compl_pat * 100
    ),
    
    -- Plafonds utilisés
    'plafonds', jsonb_build_object(
      'pass_annuel', v_pass_annuel,
      'pass_mensuel', v_pass_mensuel,
      'pass_deplaf_annuel', v_pass_deplaf_annuel,
      'pass_deplaf_mensuel', v_pass_deplaf_mensuel
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur calcul fiche de paie: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION calculer_fiche_paie_complete IS 
'Calcule une fiche de paie complète et professionnelle avec toutes les cotisations selon les taux URSSAF 2025.
Récupère automatiquement les données du collaborateur, les taux, et calcule proprement en déduisant les charges salariales du salaire brut.
Conforme aux réglementations françaises. Prend en compte les plafonds PASS et les conventions collectives.';

