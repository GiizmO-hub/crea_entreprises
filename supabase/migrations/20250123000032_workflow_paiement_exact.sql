/*
  # Workflow de paiement EXACT selon spécifications
  
  WORKFLOW DEMANDÉ:
  1. Création entreprise → remplissage formulaire → validation par bouton paiement → deux choix
  2. Choix 1 : Carte bancaire → paiement validé → TOUT SE GÉNÈRE AUTOMATIQUEMENT
  3. Choix 2 : Virement → délai 2-5 jours ouvrés → VALIDATION ÉQUIPE TECHNIQUE → création complète
  
  MODIFICATIONS:
  - Fonction pour valider paiement carte immédiatement (génération automatique complète)
  - Fonction pour enregistrer choix virement avec délai 2-5 jours ouvrés
  - Fonction pour VALIDATION MANUELLE par équipe technique pour virements
  - Trigger pour traitement automatique après délai (si pas encore validé manuellement)
*/

-- ============================================================================
-- PARTIE 1 : Fonction pour valider paiement CARTE (génération automatique complète)
-- ============================================================================

DROP FUNCTION IF EXISTS valider_paiement_carte_immediat(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Marquer le paiement comme payé
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;
  
  -- Le trigger va automatiquement créer facture + abonnement + espace client
  -- via creer_facture_et_abonnement_apres_paiement
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement par carte validé. Génération automatique en cours...'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
  'Valide un paiement par carte immédiatement. Déclenche automatiquement la création complète (facture, abonnement, espace client).';

GRANT EXECUTE ON FUNCTION valider_paiement_carte_immediat(uuid, text) TO authenticated;

-- ============================================================================
-- PARTIE 2 : Fonction pour choisir virement (avec délai 2-5 jours ouvrés)
-- ============================================================================

DROP FUNCTION IF EXISTS choisir_paiement_virement(uuid) CASCADE;

CREATE OR REPLACE FUNCTION choisir_paiement_virement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_date_fin_delai timestamptz;
  v_jours_ouvres integer := 3; -- Délai par défaut: 3 jours ouvrés (entre 2 et 5)
BEGIN
  -- Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  -- Calculer la date de fin du délai (3 jours ouvrés = environ 96h)
  -- Note: Pour un calcul précis des jours ouvrés, on utiliserait une fonction spécialisée
  -- Ici on utilise 3 jours calendaires comme approximation
  v_date_fin_delai := now() + (v_jours_ouvres || ' days')::interval;

  -- Mettre à jour le paiement avec la méthode virement
  UPDATE paiements
  SET methode_paiement = 'virement',
      statut = 'en_attente_validation',  -- ✅ NOUVEAU STATUT pour virements
      date_creation_paiement = COALESCE(date_creation_paiement, now()),
      date_echeance = v_date_fin_delai::date,
      updated_at = now()
  WHERE id = p_paiement_id;

  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', p_paiement_id,
    'date_fin_delai', v_date_fin_delai,
    'message', format('Paiement par virement enregistré. Délai: 2-5 jours ouvrés. Un membre de l''équipe technique validera manuellement après réception du virement.')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION choisir_paiement_virement IS 
  'Enregistre le choix du paiement par virement. Statut: en_attente_validation. L''équipe technique doit valider manuellement.';

GRANT EXECUTE ON FUNCTION choisir_paiement_virement(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Fonction pour VALIDATION MANUELLE par équipe technique
-- ============================================================================

DROP FUNCTION IF EXISTS valider_paiement_virement_manuel(uuid) CASCADE;

CREATE OR REPLACE FUNCTION valider_paiement_virement_manuel(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Vérifier que c'est bien un paiement par virement en attente
  IF NOT EXISTS (
    SELECT 1 FROM paiements
    WHERE id = p_paiement_id
    AND methode_paiement = 'virement'
    AND statut = 'en_attente_validation'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé ou déjà traité'
    );
  END IF;

  -- Marquer le paiement comme payé (validation manuelle)
  UPDATE paiements
  SET statut = 'paye',
      date_paiement = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_paiement_id;
  
  -- Le trigger va automatiquement créer facture + abonnement + espace client
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement par virement validé manuellement. Génération automatique en cours...'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_virement_manuel IS 
  'Valide manuellement un paiement par virement. À utiliser par l''équipe technique après vérification. Déclenche la génération automatique complète.';

GRANT EXECUTE ON FUNCTION valider_paiement_virement_manuel(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Mettre à jour les statuts de paiement possibles
-- ============================================================================

-- Ajouter le statut 'en_attente_validation' si nécessaire
DO $$
BEGIN
  -- Vérifier si la contrainte CHECK existe et la modifier si nécessaire
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'paiements_statut_check'
  ) THEN
    -- La contrainte existe, on doit la recréer
    ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_statut_check;
  END IF;
  
  -- Recréer la contrainte avec le nouveau statut
  ALTER TABLE paiements 
  ADD CONSTRAINT paiements_statut_check 
  CHECK (statut IN ('en_attente', 'en_attente_validation', 'paye', 'echec', 'rembourse', 'annule'));
  
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorer si la contrainte existe déjà avec les bonnes valeurs
    NULL;
END $$;

-- ============================================================================
-- PARTIE 5 : Fonction pour traitement automatique après délai (optionnel)
-- ============================================================================

DROP FUNCTION IF EXISTS traiter_virements_apres_delai() CASCADE;

CREATE OR REPLACE FUNCTION traiter_virements_apres_delai()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_traites integer := 0;
BEGIN
  -- Trouver tous les paiements par virement en attente depuis plus de 5 jours ouvrés
  -- (au cas où la validation manuelle n'a pas été faite)
  FOR v_paiement IN
    SELECT *
    FROM paiements
    WHERE methode_paiement = 'virement'
      AND statut = 'en_attente_validation'
      AND entreprise_id IS NOT NULL
      AND date_echeance <= CURRENT_DATE
      AND EXTRACT(EPOCH FROM (now() - COALESCE(date_creation_paiement, created_at))) / 3600 >= 120  -- 5 jours = 120h
  LOOP
    -- Marquer comme payé (le trigger créera facture + abonnement)
    UPDATE paiements
    SET statut = 'paye',
        date_paiement = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_paiement.id;
    
    v_traites := v_traites + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'paiements_traites', v_traites,
    'message', format('%s paiement(s) par virement traité(s) automatiquement après délai', v_traites)
  );
END;
$$;

COMMENT ON FUNCTION traiter_virements_apres_delai IS 
  'Traite automatiquement les paiements par virement après 5 jours ouvrés si non validés manuellement. À appeler via cron job.';

GRANT EXECUTE ON FUNCTION traiter_virements_apres_delai() TO authenticated;




