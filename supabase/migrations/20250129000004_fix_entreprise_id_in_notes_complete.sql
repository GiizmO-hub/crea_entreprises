/*
  # CORRECTION : Récupérer entreprise_id depuis plusieurs sources
  
  Problème :
  - L'entreprise_id peut manquer dans les notes du paiement
  - La fonction creer_facture_et_abonnement_apres_paiement ne trouve pas l'entreprise_id
  
  Solution :
  - Vérifier d'abord la colonne entreprise_id du paiement lui-même
  - Ensuite vérifier les notes
  - En dernier recours, chercher via les clients ou autres relations
*/

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
  
  -- 3. ✅ PRIORITÉ 1 : Récupérer entreprise_id depuis la colonne entreprise_id du paiement
  v_entreprise_id := v_paiement.entreprise_id;
  
  -- 4. ✅ PRIORITÉ 2 : Si NULL, parser les notes pour récupérer entreprise_id
  IF v_entreprise_id IS NULL THEN
    BEGIN
      -- Parser les notes
      v_notes := CASE 
        WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN (v_paiement.notes::text)::jsonb
        WHEN pg_typeof(v_paiement.notes) = 'text'::regtype THEN (v_paiement.notes::text)::jsonb
        ELSE v_paiement.notes::jsonb
      END;
      
      v_entreprise_id := (v_notes->>'entreprise_id')::uuid;
      v_client_id := (v_notes->>'client_id')::uuid;
      v_auth_user_id := (v_notes->>'auth_user_id')::uuid;
      v_plan_id := (v_notes->>'plan_id')::uuid;
      
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] 📋 Notes parsées - Entreprise ID: %, Client ID: %, Plan ID: %', 
        v_entreprise_id, v_client_id, v_plan_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ⚠️ Erreur parsing notes: %', SQLERRM;
    END;
  ELSE
    -- Si entreprise_id existe déjà, parser quand même les notes pour les autres infos
    BEGIN
      v_notes := CASE 
        WHEN v_paiement.notes IS NULL THEN '{}'::jsonb
        WHEN jsonb_typeof(v_paiement.notes) = 'string' THEN (v_paiement.notes::text)::jsonb
        WHEN pg_typeof(v_paiement.notes) = 'text'::regtype THEN (v_paiement.notes::text)::jsonb
        ELSE v_paiement.notes::jsonb
      END;
      
      v_client_id := COALESCE(v_client_id, (v_notes->>'client_id')::uuid);
      v_auth_user_id := COALESCE(v_auth_user_id, (v_notes->>'auth_user_id')::uuid);
      v_plan_id := COALESCE(v_plan_id, (v_notes->>'plan_id')::uuid);
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ignorer si erreur parsing
    END;
  END IF;
  
  -- 5. ✅ PRIORITÉ 3 : Si toujours NULL, chercher via les factures liées
  IF v_entreprise_id IS NULL THEN
    SELECT f.entreprise_id INTO v_entreprise_id
    FROM factures f
    WHERE f.paiement_id = p_paiement_id
    LIMIT 1;
    
    IF v_entreprise_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé via facture: %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 6. ✅ PRIORITÉ 4 : Si toujours NULL, chercher via les abonnements liés
  IF v_entreprise_id IS NULL THEN
    SELECT a.entreprise_id INTO v_entreprise_id
    FROM abonnements a
    WHERE EXISTS (
      SELECT 1 FROM factures f 
      WHERE f.paiement_id = p_paiement_id 
      AND f.id = a.facture_id
    )
    LIMIT 1;
    
    IF v_entreprise_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé via abonnement: %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 7. ✅ PRIORITÉ 5 : Si toujours NULL, chercher via clients
  IF v_entreprise_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT entreprise_id INTO v_entreprise_id
    FROM clients
    WHERE id = v_client_id
    LIMIT 1;
    
    IF v_entreprise_id IS NOT NULL THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ✅ Entreprise ID trouvé via client: %', v_entreprise_id;
    END IF;
  END IF;
  
  -- 8. Si toujours NULL, erreur
  IF v_entreprise_id IS NULL THEN
    RAISE WARNING '[creer_facture_et_abonnement_apres_paiement] ❌ Entreprise ID non trouvé';
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ID d''entreprise manquant dans les notes du paiement et impossible à récupérer depuis les relations',
      'paiement_id', p_paiement_id,
      'paiement_entreprise_id', v_paiement.entreprise_id,
      'notes', v_paiement.notes
    );
  END IF;
  
  -- 9. Récupérer le plan si plan_id fourni
  IF v_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans_abonnement WHERE id = v_plan_id;
  END IF;
  
  -- 10. Récupérer le client si nécessaire
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients WHERE entreprise_id = v_entreprise_id LIMIT 1;
  END IF;
  
  -- 11. Récupérer auth_user_id si nécessaire
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
  
  -- 12. Créer la facture
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
  
  -- 13. Créer l'abonnement (utiliser auth.users.id pour client_id)
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
  
  -- 14. Créer ou mettre à jour l'espace membre client (SANS colonne role)
  SELECT id INTO v_espace_membre_id
  FROM espaces_membres_clients
  WHERE client_id = v_client_id AND entreprise_id = v_entreprise_id;
  
  IF v_espace_membre_id IS NULL THEN
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
  
  -- 15. Synchroniser modules si fonction existe
  BEGIN
    IF v_client_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
      PERFORM sync_client_modules_from_plan(v_client_id, v_plan_id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '[creer_facture_et_abonnement_apres_paiement] ⚠️ Fonction sync_client_modules_from_plan non disponible: %', SQLERRM;
  END;
  
  -- 16. Activer entreprise et client
  UPDATE entreprises
  SET statut = 'active'
  WHERE id = v_entreprise_id;
  
  UPDATE clients 
  SET statut = 'actif' 
  WHERE id = v_client_id;
  
  -- 17. Mettre à jour le rôle du client dans la table utilisateurs
  IF v_client_id IS NOT NULL AND v_auth_user_id IS NOT NULL THEN
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
  'Crée automatiquement la facture, l''abonnement et l''espace membre client après un paiement. Version améliorée qui cherche entreprise_id dans plusieurs sources : colonne paiement, notes, factures, abonnements, clients.';

