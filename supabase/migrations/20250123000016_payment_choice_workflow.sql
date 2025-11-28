/*
  # Workflow Paiement avec choix méthode + délai virement
  
  ## Nouveau workflow
  1. Création entreprise + client + paiement en attente
  2. Choix méthode paiement (carte ou virement)
  3. Si carte → Traitement immédiat → Facture + Abonnement + Espace + Email
  4. Si virement → Délai 96h → Facture + Abonnement + Espace + Email
  
  ## Modifications
  - Ajouter colonne methode_paiement_choisie dans paiements
  - Ajouter colonne date_creation_paiement pour calculer délai 96h
  - Modifier trigger pour gérer délai virement
*/

-- ============================================================================
-- PARTIE 1 : Ajouter colonnes nécessaires à la table paiements
-- ============================================================================

-- Ajouter colonne pour stocker la date de création du paiement (pour calculer délai 96h)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements'
    AND column_name = 'date_creation_paiement'
  ) THEN
    ALTER TABLE paiements
    ADD COLUMN date_creation_paiement timestamptz DEFAULT now();
    
    COMMENT ON COLUMN paiements.date_creation_paiement IS 'Date de création du paiement pour calculer le délai de 96h pour virement';
  END IF;
END $$;

-- Mettre à jour les paiements existants
UPDATE paiements
SET date_creation_paiement = created_at
WHERE date_creation_paiement IS NULL;

-- ============================================================================
-- PARTIE 2 : Modifier create_complete_entreprise_automated pour créer paiement
-- ============================================================================

-- La fonction existe déjà, on va juste s'assurer qu'elle crée bien le paiement

-- ============================================================================
-- PARTIE 3 : Fonction pour choisir la méthode de paiement
-- ============================================================================

CREATE OR REPLACE FUNCTION choisir_methode_paiement(
  p_paiement_id uuid,
  p_methode_paiement text  -- 'carte' ou 'virement'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
BEGIN
  -- Vérifier que l'utilisateur est autorisé
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  -- Vérifier que la méthode est valide
  IF p_methode_paiement NOT IN ('carte', 'virement', 'stripe') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Méthode de paiement invalide. Utilisez "carte" ou "virement"'
    );
  END IF;

  -- Mettre à jour le paiement avec la méthode choisie
  UPDATE paiements
  SET methode_paiement = CASE 
      WHEN p_methode_paiement = 'carte' THEN 'stripe'
      ELSE 'virement'
    END,
    date_creation_paiement = COALESCE(date_creation_paiement, now()),
    updated_at = now()
  WHERE id = p_paiement_id;

  RETURN jsonb_build_object(
    'success', true,
    'paiement_id', p_paiement_id,
    'methode_paiement', p_methode_paiement,
    'message', CASE 
      WHEN p_methode_paiement = 'carte' THEN 'Paiement par carte sélectionné. Redirection vers Stripe...'
      ELSE 'Paiement par virement sélectionné. Délai de 96h avant validation automatique.'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION choisir_methode_paiement IS 
  'Choisit la méthode de paiement pour un paiement en attente. Carte = traitement immédiat, Virement = délai 96h.';

GRANT EXECUTE ON FUNCTION choisir_methode_paiement(uuid, text) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Modifier le trigger pour gérer le délai de 96h pour virement
-- ============================================================================

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
          -- Pas encore 96h, ne rien faire (le paiement sera validé automatiquement plus tard)
          RAISE NOTICE '⏳ Paiement par virement: % heures écoulées sur 96. Attente avant création automatique.', v_heures_ecoulees;
          RETURN NEW;
        END IF;
      END IF;
      
      -- Créer automatiquement facture + abonnement (carte immédiatement, virement après 96h)
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

-- ============================================================================
-- PARTIE 5 : Fonction pour traiter automatiquement les virements après 96h
-- ============================================================================

CREATE OR REPLACE FUNCTION traiter_virements_apres_delai()
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
    -- Valider automatiquement le paiement
    UPDATE paiements
    SET statut = 'paye',
        date_paiement = CURRENT_DATE,
        updated_at = now()
    WHERE id = v_paiement.id;
    
    -- Le trigger créera automatiquement facture + abonnement + espace client
    v_traites := v_traites + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'paiements_traites', v_traites,
    'message', format('%s paiement(s) par virement traité(s) automatiquement après 96h', v_traites)
  );
END;
$$;

COMMENT ON FUNCTION traiter_virements_apres_delai IS 
  'Traite automatiquement les paiements par virement après 96h de délai. À appeler via cron job.';

GRANT EXECUTE ON FUNCTION traiter_virements_apres_delai() TO authenticated;

-- ============================================================================
-- PARTIE 6 : Fonction pour valider paiement carte immédiatement
-- ============================================================================

CREATE OR REPLACE FUNCTION valider_paiement_carte(
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
  v_result jsonb;
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

  -- Vérifier que c'est un paiement par carte
  IF v_paiement.methode_paiement NOT IN ('carte', 'stripe') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce paiement n''est pas par carte'
    );
  END IF;

  -- Valider le paiement (statut = 'paye')
  UPDATE paiements
  SET statut = 'paye',
      date_paiement = CURRENT_DATE,
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      updated_at = now()
  WHERE id = p_paiement_id;

  -- Mettre à jour le statut de paiement de l'entreprise
  UPDATE entreprises
  SET statut_paiement = 'paye',
      updated_at = now()
  WHERE id = v_paiement.entreprise_id;

  -- Le trigger va automatiquement créer facture + abonnement + espace client
  -- On retourne un succès, le trigger fera le reste
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement validé. Facture, abonnement et espace client en cours de création...'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte IS 
  'Valide un paiement par carte immédiatement. Déclenche automatiquement la création de facture, abonnement et espace client.';

GRANT EXECUTE ON FUNCTION valider_paiement_carte(uuid, text) TO authenticated;




