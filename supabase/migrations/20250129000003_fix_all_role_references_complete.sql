/*
  # CORRECTION COMPLÈTE : Supprimer TOUTES les références à colonne "role" inexistante
  
  Problème :
  - Plusieurs fonctions essaient encore d'utiliser une colonne "role" dans espaces_membres_clients
  - Cette colonne N'EXISTE PAS dans la table
  
  Solution :
  - Recréer TOUTES les fonctions qui référencent "role" dans espaces_membres_clients
  - Supprimer systématiquement toutes les références à cette colonne
*/

-- PARTIE 1 : Recréer creer_facture_et_abonnement_apres_paiement SANS aucune référence à role

DROP FUNCTION IF EXISTS creer_facture_et_abonnement_apres_paiement(uuid);

CREATE OR REPLACE FUNCTION creer_facture_et_abonnement_apres_paiement(
  p_paiement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_auth_user_id uuid;
  v_plan_id uuid;
  v_plan RECORD;
  v_facture_id uuid;
  v_numero_facture text;
  v_abonnement_id uuid;
  v_espace_membre_id uuid;
  v_notes jsonb;
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Paiement non trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- 2. Forcer le statut à 'paye' si nécessaire
  IF v_paiement.statut != 'paye' THEN
    UPDATE paiements SET statut = 'paye' WHERE id = p_paiement_id;
  END IF;
  
  -- 3. Parser les notes pour récupérer les IDs nécessaires
  BEGIN
    v_notes := CASE 
      WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
      WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN v_paiement.notes::jsonb
      ELSE v_paiement.notes
    END;
    
    v_entreprise_id := (v_notes->>'entreprise_id')::uuid;
    v_client_id := (v_notes->>'client_id')::uuid;
    v_auth_user_id := (v_notes->>'auth_user_id')::uuid;
    v_plan_id := (v_notes->>'plan_id')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
  END;
  
  IF v_entreprise_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entreprise ID manquant dans les notes du paiement');
  END IF;
  
  -- 4. Récupérer le plan si plan_id fourni
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  END IF;
  
  -- 5. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  END IF;
  
  -- 6. Récupérer auth_user_id si nécessaire
  IF v_auth_user_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT user_id INTO v_auth_user_id FROM clients WHERE id = v_client_id;
    IF v_auth_user_id IS NULL THEN
      -- Essayer de trouver via email
      SELECT id INTO v_auth_user_id 
      FROM auth.users 
      WHERE email = (SELECT email FROM clients WHERE id = v_client_id) 
      LIMIT 1;
    END IF;
  END IF;
  
  -- 7. Créer la facture
  INSERT INTO factures (
    entreprise_id, client_id, montant_ht, tva, montant_ttc,
    date_facture, date_echeance, statut, paiement_id
  )
  VALUES (
    v_entreprise_id, v_client_id, 
    v_paiement.montant_ht, v_paiement.tva, v_paiement.montant_ttc,
    NOW(), NOW() + INTERVAL '30 days', 'payee', p_paiement_id
  )
  RETURNING id, numero INTO v_facture_id, v_numero_facture;
  
  -- 8. Créer l'abonnement (utiliser auth.users.id pour client_id)
  IF v_auth_user_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    INSERT INTO abonnements (
      entreprise_id, client_id, plan_id, 
      date_debut, date_fin, statut, facture_id
    )
    VALUES (
      v_entreprise_id, v_auth_user_id, v_plan_id,
      NOW(), NOW() + INTERVAL '1 month', 'actif', v_facture_id
    )
    ON CONFLICT (entreprise_id, plan_id) DO UPDATE
    SET statut = 'actif', date_debut = NOW(), date_fin = NOW() + INTERVAL '1 month'
    RETURNING id INTO v_abonnement_id;
  END IF;
  
  -- 9. Créer ou mettre à jour l'espace membre client
  -- ✅ CORRECTION : AUCUNE référence à la colonne "role" qui n'existe pas
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id;
  
  IF v_espace_membre_id IS NULL THEN
    -- Créer l'espace membre (SANS colonne role)
    INSERT INTO espaces_membres_clients (
      client_id, entreprise_id, user_id, actif,
      modules_actifs, statut_compte, abonnement_id
    )
    VALUES (
      v_client_id, v_entreprise_id, v_auth_user_id, true,
      jsonb_build_object(
        'tableau_de_bord', true, 'mon_entreprise', true,
        'factures', true, 'documents', true, 'abonnements', true
      ),
      'actif', v_abonnement_id
    )
    RETURNING id INTO v_espace_membre_id;
  ELSE
    -- Mettre à jour l'espace membre (SANS colonne role)
    UPDATE espaces_membres_clients
    SET actif = true,
        statut_compte = 'actif',
        user_id = COALESCE(v_auth_user_id, user_id),
        abonnement_id = COALESCE(v_abonnement_id, abonnement_id),
        modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || jsonb_build_object(
          'tableau_de_bord', true, 'mon_entreprise', true,
          'factures', true, 'documents', true, 'abonnements', true
        )
    WHERE id = v_espace_membre_id;
  END IF;
  
  -- 10. Synchroniser modules si fonction existe
  BEGIN
    IF v_client_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible: %', SQLERRM;
  END;
  
  -- 11. Activer entreprise et client
  UPDATE entreprises
  SET statut = 'active'
  WHERE id = v_entreprise_id;
  
  UPDATE clients 
  SET statut = 'actif' 
  WHERE id = v_client_id;
  
  -- 12. Mettre à jour le rôle du client dans la table utilisateurs (si nécessaire)
  -- ✅ Le rôle est géré dans utilisateurs.role, PAS dans espaces_membres_clients
  IF v_client_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
    -- Vérifier si l'utilisateur existe dans utilisateurs
    IF EXISTS (SELECT 1 FROM utilisateurs WHERE id = v_auth_user_id) THEN
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE id = v_auth_user_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Facture et abonnement créés avec succès',
    'facture_id', v_facture_id,
    'abonnement_id', v_abonnement_id,
    'espace_membre_id', v_espace_membre_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION creer_facture_et_abonnement_apres_paiement IS 
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. CORRIGÉE COMPLÈTEMENT : AUCUNE référence à colonne "role" inexistante dans espaces_membres_clients.';

-- PARTIE 2 : Vérifier et corriger valider_paiement_carte_immediat

CREATE OR REPLACE FUNCTION valider_paiement_carte_immediat(
  p_paiement_id uuid,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
BEGIN
  -- 1. Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Paiement non trouvé',
      'paiement_id', p_paiement_id
    );
  END IF;
  
  -- 2. Marquer le paiement comme payé
  UPDATE paiements
  SET statut = 'paye',
      stripe_payment_id = COALESCE(p_stripe_payment_id, stripe_payment_id),
      date_paiement = COALESCE(date_paiement, NOW())
  WHERE id = p_paiement_id;
  
  -- 3. ✅ CRUCIAL: Appeler creer_facture_et_abonnement_apres_paiement
  v_result := creer_facture_et_abonnement_apres_paiement(p_paiement_id);
  
  IF (v_result->>'success')::boolean = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'paiement_valide', true,
      'error', v_result->>'error',
      'message', 'Paiement validé mais erreur lors de la création automatique: ' || COALESCE(v_result->>'error', 'Erreur inconnue')
    );
  END IF;
  
  -- 4. Retourner le résultat
  RETURN jsonb_build_object(
    'success', true,
    'paiement_valide', true,
    'message', 'Paiement validé avec succès',
    'facture_id', v_result->>'facture_id',
    'abonnement_id', v_result->>'abonnement_id',
    'espace_membre_id', v_result->>'espace_membre_id'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[valider_paiement_carte_immediat] ❌ ERREUR: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION valider_paiement_carte_immediat IS 
  'Valide un paiement par carte immédiatement. Déclenche AUTOMATIQUEMENT la création complète (facture, abonnement, espace client, droits admin). Version corrigée qui appelle TOUJOURS creer_facture_et_abonnement_apres_paiement SANS référence à colonne role.';

-- PARTIE 3 : Vérification terminée - toutes les fonctions ont été corrigées
-- Le rôle est maintenant géré uniquement dans utilisateurs.role

