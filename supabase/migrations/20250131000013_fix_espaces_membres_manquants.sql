/*
  # CORRECTION : Créer les espaces membres manquants pour les abonnements existants
  
  PROBLÈME:
  - Des abonnements existent mais les espaces membres n'ont pas été créés
  - La fonction creer_facture_et_abonnement_apres_paiement crée maintenant l'espace membre
  - Mais les abonnements créés avant cette correction n'ont pas d'espace membre
  
  SOLUTION:
  - Créer automatiquement les espaces membres manquants pour tous les abonnements actifs
*/

-- ============================================================================
-- PARTIE 1 : Créer les espaces membres manquants
-- ============================================================================

DO $$
DECLARE
  v_abonnement RECORD;
  v_client RECORD;
  v_espace_membre_id uuid;
  v_count_created INTEGER := 0;
BEGIN
  RAISE NOTICE '🔍 Recherche des abonnements sans espace membre...';
  
  FOR v_abonnement IN
    SELECT 
      a.id as abonnement_id,
      a.entreprise_id,
      a.client_id as auth_user_id,
      a.plan_id,
      a.statut
    FROM abonnements a
    WHERE a.statut = 'actif'
      AND a.entreprise_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM espaces_membres_clients emc
        WHERE emc.entreprise_id = a.entreprise_id
          AND emc.abonnement_id = a.id
      )
  LOOP
    BEGIN
      -- Trouver le client (clients.id) pour cette entreprise
      SELECT * INTO v_client
      FROM clients
      WHERE entreprise_id = v_abonnement.entreprise_id
      ORDER BY created_at ASC
      LIMIT 1;
      
      IF v_client.id IS NOT NULL THEN
        -- Vérifier si un espace membre existe déjà pour ce client et cette entreprise
        SELECT id INTO v_espace_membre_id
        FROM espaces_membres_clients
        WHERE client_id = v_client.id
          AND entreprise_id = v_abonnement.entreprise_id
        LIMIT 1;
        
        IF v_espace_membre_id IS NULL THEN
          -- Créer l'espace membre
          INSERT INTO espaces_membres_clients (
            client_id,
            entreprise_id,
            user_id,
            abonnement_id,
            actif,
            statut_compte,
            modules_actifs
          )
          VALUES (
            v_client.id,
            v_abonnement.entreprise_id,
            v_abonnement.auth_user_id,
            v_abonnement.abonnement_id,
            true,
            'actif',
            jsonb_build_object(
              'tableau_de_bord', true,
              'mon_entreprise', true,
              'factures', true,
              'documents', true,
              'abonnements', true
            )
          )
          RETURNING id INTO v_espace_membre_id;
          
          RAISE NOTICE '✅ Espace membre créé: % pour abonnement %', v_espace_membre_id, v_abonnement.abonnement_id;
          
          -- Synchroniser les modules depuis le plan
          BEGIN
            PERFORM sync_client_modules_from_plan(v_espace_membre_id);
            RAISE NOTICE '✅ Modules synchronisés pour espace membre %', v_espace_membre_id;
          EXCEPTION
            WHEN OTHERS THEN
              RAISE WARNING '⚠️ Erreur synchronisation modules: %', SQLERRM;
          END;
          
          v_count_created := v_count_created + 1;
        ELSE
          -- Mettre à jour l'espace membre existant avec l'abonnement
          UPDATE espaces_membres_clients
          SET abonnement_id = v_abonnement.abonnement_id,
              user_id = COALESCE(v_abonnement.auth_user_id, user_id),
              actif = true,
              statut_compte = 'actif',
              updated_at = now()
          WHERE id = v_espace_membre_id;
          
          RAISE NOTICE '✅ Espace membre % mis à jour avec abonnement %', v_espace_membre_id, v_abonnement.abonnement_id;
        END IF;
      ELSE
        RAISE WARNING '⚠️ Aucun client trouvé pour entreprise % (abonnement %)', v_abonnement.entreprise_id, v_abonnement.abonnement_id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '❌ Erreur création espace membre pour abonnement %: %', v_abonnement.abonnement_id, SQLERRM;
    END;
  END LOOP;
  
  IF v_count_created > 0 THEN
    RAISE NOTICE '✅ % espace(s) membre(s) créé(s) avec succès', v_count_created;
  ELSE
    RAISE NOTICE 'ℹ️ Aucun espace membre manquant trouvé';
  END IF;
END $$;

SELECT '✅ Migration de correction des espaces membres manquants appliquée avec succès !' as resultat;

