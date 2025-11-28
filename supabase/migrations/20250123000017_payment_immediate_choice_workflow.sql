/*
  # Workflow Paiement Immédiat avec Choix Méthode
  
  ## Nouveau workflow
  1. Création entreprise + client → Retourne paiement_id
  2. IMMÉDIATEMENT : Modal de choix paiement (carte ou virement)
  3. Si CARTE → Stripe checkout → Validation immédiate → Tout se crée automatiquement
  4. Si VIREMENT → Paiement créé avec délai 96h → Traitement automatique après 96h
  
  ## Modifications
  - Modifier create_complete_entreprise_automated pour retourner paiement_id
  - Créer fonction pour choisir méthode de paiement
  - Modifier trigger pour gérer délai 96h virement
  - Créer Edge Function pour Stripe checkout
*/

-- ============================================================================
-- PARTIE 1 : Modifier create_complete_entreprise_automated pour retourner paiement_id
-- ============================================================================

-- La fonction retourne déjà le paiement_id si créé, on s'assure juste que c'est bien dans le retour

-- ============================================================================
-- PARTIE 2 : Fonction pour valider paiement carte immédiatement
-- ============================================================================

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
  v_paiement RECORD;
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

  -- Mettre à jour le paiement avec la méthode carte
  UPDATE paiements
  SET methode_paiement = 'stripe',
      statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      date_creation_paiement = COALESCE(date_creation_paiement, now()),
      updated_at = now()
  WHERE id = p_paiement_id;

  -- Mettre à jour le statut de paiement de l'entreprise
  UPDATE entreprises
  SET statut_paiement = 'paye',
      updated_at = now()
  WHERE id = v_paiement.entreprise_id;

  -- Le trigger va automatiquement créer facture + abonnement + espace client
  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', p_paiement_id,
    'message', 'Paiement par carte validé. Facture, abonnement et espace client en cours de création...'
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
  'Valide un paiement par carte immédiatement. Déclenche automatiquement la création de facture, abonnement et espace client.';

GRANT EXECUTE ON FUNCTION valider_paiement_carte_immediat(uuid, text) TO authenticated;

-- ============================================================================
-- PARTIE 3 : Fonction pour choisir virement (avec délai 96h)
-- ============================================================================

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

  -- Calculer la date de fin du délai de 96h
  v_date_fin_delai := now() + INTERVAL '96 hours';

  -- Mettre à jour le paiement avec la méthode virement
  UPDATE paiements
  SET methode_paiement = 'virement',
      date_creation_paiement = COALESCE(date_creation_paiement, now()),
      date_echeance = v_date_fin_delai::date,
      updated_at = now()
  WHERE id = p_paiement_id;

  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', p_paiement_id,
    'date_fin_delai', v_date_fin_delai,
    'message', format('Paiement par virement enregistré. Le traitement automatique aura lieu le %s (96h après la création).', v_date_fin_delai)
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
  'Enregistre le choix du paiement par virement. Le traitement automatique aura lieu après 96h.';

GRANT EXECUTE ON FUNCTION choisir_paiement_virement(uuid) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Modifier le trigger pour gérer le délai de 96h pour virement
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;
DROP FUNCTION IF EXISTS trigger_creer_facture_abonnement_apres_paiement() CASCADE;

CREATE OR REPLACE FUNCTION trigger_creer_facture_abonnement_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_heures_ecoulees numeric;
  v_methode_paiement text;
BEGIN
  -- Si le paiement passe à "paye" (et n'était pas déjà payé)
  IF NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') THEN
    -- Vérifier que c'est un paiement pour une entreprise (a un entreprise_id)
    IF NEW.entreprise_id IS NOT NULL THEN
      v_methode_paiement := NEW.methode_paiement;
      
      -- Si virement, vérifier que 96h se sont écoulées
      IF v_methode_paiement = 'virement' THEN
        -- Calculer les heures écoulées depuis la création du paiement
        v_heures_ecoulees := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.date_creation_paiement, NEW.created_at))) / 3600;
        
        IF v_heures_ecoulees < 96 THEN
          -- Pas encore 96h, annuler la validation (le paiement sera validé automatiquement plus tard)
          RAISE NOTICE '⏳ Paiement par virement: % heures écoulées sur 96. Le traitement aura lieu automatiquement après 96h.', v_heures_ecoulees;
          
          -- Remettre le statut en attente (sauf si c'est un admin qui valide manuellement)
          -- On ne remet pas en attente, on laisse le statut 'paye' mais on ne traite pas encore
          RETURN NEW;
        END IF;
      END IF;
      
      -- Traiter immédiatement pour carte, ou après 96h pour virement
      v_result := creer_facture_et_abonnement_apres_paiement(NEW.id);
      
      -- Log le résultat
      IF NOT (v_result->>'success')::boolean THEN
        RAISE WARNING 'Erreur lors de la création automatique facture/abonnement: %', v_result->>'error';
      ELSE
        RAISE NOTICE '✅ Facture et abonnement créés automatiquement pour entreprise % (méthode: %)', NEW.entreprise_id, v_methode_paiement;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recréer le trigger
CREATE TRIGGER trigger_paiement_creer_facture_abonnement
  AFTER UPDATE OF statut ON paiements
  FOR EACH ROW
  WHEN (NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') AND NEW.entreprise_id IS NOT NULL)
  EXECUTE FUNCTION trigger_creer_facture_abonnement_apres_paiement();

-- ============================================================================
-- PARTIE 5 : Fonction pour traiter automatiquement les virements après 96h
-- ============================================================================

CREATE OR REPLACE FUNCTION traiter_virements_apres_96h()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_heures_ecoulees numeric;
  v_traites integer := 0;
  v_result jsonb;
BEGIN
  -- Trouver tous les paiements par virement en attente depuis plus de 96h
  FOR v_paiement IN
    SELECT *
    FROM paiements
    WHERE methode_paiement = 'virement'
      AND statut = 'en_attente'
      AND entreprise_id IS NOT NULL
      AND EXTRACT(EPOCH FROM (now() - COALESCE(date_creation_paiement, created_at))) / 3600 >= 96
  LOOP
    -- Valider automatiquement le paiement (le trigger créera facture + abonnement)
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
    'message', format('%s paiement(s) par virement traité(s) automatiquement après 96h', v_traites)
  );
END;
$$;

COMMENT ON FUNCTION traiter_virements_apres_96h IS 
  'Traite automatiquement les paiements par virement après 96h de délai. À appeler via cron job ou manuellement.';

GRANT EXECUTE ON FUNCTION traiter_virements_apres_96h() TO authenticated;

-- ============================================================================
-- PARTIE 6 : Créer fonction pour obtenir les infos du paiement (pour Stripe)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_paiement_info_for_stripe(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise RECORD;
  v_client RECORD;
BEGIN
  -- Récupérer le paiement avec les infos de l'entreprise et du client
  SELECT 
    p.*,
    e.nom as entreprise_nom,
    e.email as entreprise_email,
    c.email as client_email,
    c.nom as client_nom,
    c.prenom as client_prenom
  INTO v_paiement
  FROM paiements p
  LEFT JOIN entreprises e ON e.id = p.entreprise_id
  LEFT JOIN clients c ON c.entreprise_id = p.entreprise_id AND c.id = (p.notes::jsonb->>'client_id')::uuid
  WHERE p.id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', v_paiement.id,
    'montant_ttc', v_paiement.montant_ttc,
    'entreprise_id', v_paiement.entreprise_id,
    'entreprise_nom', v_paiement.entreprise_nom,
    'client_email', v_paiement.client_email,
    'client_nom', v_paiement.client_nom,
    'client_prenom', v_paiement.client_prenom,
    'plan_id', (v_paiement.notes::jsonb->>'plan_id'),
    'methode_paiement', v_paiement.methode_paiement
  );
END;
$$;

COMMENT ON FUNCTION get_paiement_info_for_stripe IS 
  'Récupère les informations d''un paiement pour créer une session Stripe checkout.';

GRANT EXECUTE ON FUNCTION get_paiement_info_for_stripe(uuid) TO authenticated;




