/*
  # Automatisation complète lors de la validation manuelle du paiement
  
  PROBLÈME:
  - Lors de la validation manuelle du paiement, l'utilisateur doit créer manuellement l'abonnement
  - Les droits d'administrateur doivent être créés manuellement
  - Le workflow n'est pas complètement automatisé
  
  SOLUTION:
  - Modifier valider_paiement_virement_manuel pour appeler automatiquement creer_facture_et_abonnement_apres_paiement
  - Cette fonction crée automatiquement : facture, abonnement, espace client, droits admin
  - Garantir que tout se fait automatiquement en une seule étape
*/

-- ============================================================================
-- FIX: valider_paiement_virement_manuel - Création automatique complète
-- ============================================================================

CREATE OR REPLACE FUNCTION valider_paiement_virement_manuel(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
  v_validation_result jsonb;
BEGIN
  RAISE NOTICE '🚀 [valider_paiement_virement_manuel] DÉBUT - Paiement ID: %', p_paiement_id;
  
  -- Vérifier que c'est bien un paiement par virement en attente
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE WARNING '❌ [valider_paiement_virement_manuel] Paiement non trouvé - ID: %', p_paiement_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé'
    );
  END IF;

  IF v_paiement.methode_paiement != 'virement' THEN
    RAISE WARNING '❌ [valider_paiement_virement_manuel] Ce n''est pas un paiement par virement - Méthode: %', v_paiement.methode_paiement;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce paiement n''est pas un virement'
    );
  END IF;

  IF v_paiement.statut = 'paye' THEN
    RAISE WARNING '⚠️ [valider_paiement_virement_manuel] Paiement déjà validé - Statut: %', v_paiement.statut;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce paiement a déjà été validé'
    );
  END IF;

  RAISE NOTICE '✅ [valider_paiement_virement_manuel] Paiement trouvé - Entreprise ID: %, Montant: %', 
    v_paiement.entreprise_id, v_paiement.montant_ttc;

  -- Marquer le paiement comme payé (validation manuelle)
  RAISE NOTICE '📝 [valider_paiement_virement_manuel] Marquage du paiement comme payé...';
  
  UPDATE paiements
  SET statut = 'paye',
      date_paiement = CURRENT_DATE,
      updated_at = now()
  WHERE id = p_paiement_id;

  RAISE NOTICE '✅ [valider_paiement_virement_manuel] Paiement marqué comme payé';

  -- ✅ AUTOMATISATION: Appeler directement creer_facture_et_abonnement_apres_paiement
  -- Cette fonction crée automatiquement :
  -- 1. La facture
  -- 2. L'abonnement
  -- 3. L'espace client avec droits d'administrateur (client_super_admin)
  -- 4. Synchronise les modules
  
  RAISE NOTICE '🏭 [valider_paiement_virement_manuel] Appel de creer_facture_et_abonnement_apres_paiement pour création automatique...';
  
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);

  IF NOT (v_result->>'success')::boolean THEN
    RAISE WARNING '❌ [valider_paiement_virement_manuel] Erreur lors de la création automatique: %', v_result->>'error';
    
    -- Même en cas d'erreur, le paiement reste marqué comme payé
    -- L'admin pourra relancer la création manuellement si nécessaire
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement validé mais erreur lors de la création automatique: ' || (v_result->>'error'),
      'paiement_valide', true,
      'details', v_result
    );
  END IF;

  RAISE NOTICE '✅ [valider_paiement_virement_manuel] Création automatique réussie !';
  RAISE NOTICE '   → Facture ID: %', v_result->>'facture_id';
  RAISE NOTICE '   → Abonnement ID: %', v_result->>'abonnement_id';
  RAISE NOTICE '   → Espace membre ID: %', v_result->>'espace_membre_id';

  -- Retourner un résultat détaillé
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Paiement validé et création automatique complète effectuée avec succès',
    'paiement_id', p_paiement_id,
    'facture_id', v_result->>'facture_id',
    'numero_facture', v_result->>'numero_facture',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id',
    'email', v_result->>'email',
    'password', v_result->>'password',
    'details', jsonb_build_object(
      'facture_creée', true,
      'abonnement_créé', true,
      'espace_client_créé', true,
      'droits_admin_créés', true,
      'modules_synchronisés', true
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ [valider_paiement_virement_manuel] ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM || ' (SQLSTATE: ' || SQLSTATE || ')',
      'paiement_valide', false
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_virement_manuel IS 
  'Valide manuellement un paiement par virement et crée AUTOMATIQUEMENT : facture, abonnement, espace client, droits admin. Version automatisée complète.';

-- Vérifier que la fonction existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'valider_paiement_virement_manuel') THEN
    RAISE NOTICE '✅ Fonction valider_paiement_virement_manuel créée/mise à jour avec succès';
  ELSE
    RAISE WARNING '⚠️  Fonction valider_paiement_virement_manuel non trouvée après création';
  END IF;
END $$;

-- Vérifier que creer_facture_et_abonnement_apres_paiement existe et fonctionne
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'creer_facture_et_abonnement_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement disponible';
  ELSE
    RAISE WARNING '⚠️  Fonction creer_facture_et_abonnement_apres_paiement non trouvée';
  END IF;
END $$;

-- Vérifier que finaliser_creation_apres_paiement existe (crée les droits admin)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finaliser_creation_apres_paiement') THEN
    RAISE NOTICE '✅ Fonction finaliser_creation_apres_paiement disponible (crée droits admin)';
  ELSE
    RAISE WARNING '⚠️  Fonction finaliser_creation_apres_paiement non trouvée';
  END IF;
END $$;


