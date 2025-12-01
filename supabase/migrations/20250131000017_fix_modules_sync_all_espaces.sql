/*
  # Correction de la synchronisation des modules pour tous les espaces membres
  
  **Problème:**
  - Lors de la création d'entreprise avec abonnement, les modules ne sont pas toujours synchronisés
  - Certains espaces membres ont des modules vides ou incomplets alors qu'ils ont un abonnement actif
  - La fonction sync_client_modules_from_plan existe mais n'est pas toujours appelée ou échoue silencieusement
  
  **Solution:**
  - Forcer la synchronisation des modules pour TOUS les espaces membres ayant un abonnement actif
  - S'assurer que la fonction utilise bien la table plan_modules (42 modules pour Enterprise)
  - Ajouter des logs pour déboguer
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et corriger la fonction sync_client_modules_from_plan
-- ============================================================================

-- Supprimer toutes les versions existantes de la fonction
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid);
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid, uuid);
DROP FUNCTION IF EXISTS sync_client_modules_from_plan(uuid, uuid, uuid);

-- Créer la fonction avec la bonne signature
CREATE OR REPLACE FUNCTION sync_client_modules_from_plan(p_espace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record record;
  v_modules_count integer := 0;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_plan] 🚀 DÉBUT - Espace ID: %', p_espace_id;
  
  -- Récupérer l'abonnement de l'espace client
  SELECT abonnement_id INTO v_abonnement_id
  FROM espaces_membres_clients
  WHERE id = p_espace_id;
  
  IF v_abonnement_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ⚠️ Aucun abonnement lié à l''espace client %', p_espace_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Abonnement trouvé: %', v_abonnement_id;
  
  -- Récupérer le plan de l'abonnement
  SELECT plan_id INTO v_plan_id
  FROM abonnements
  WHERE id = v_abonnement_id
    AND statut = 'actif';
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_plan] ⚠️ Aucun plan actif pour l''abonnement %', v_abonnement_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Plan trouvé: %', v_plan_id;
  
  -- ✅ CORRECTION : Utiliser plan_modules (pas plans_modules) pour avoir tous les modules
  FOR v_module_record IN
    SELECT DISTINCT pm.module_code, pm.module_nom
    FROM plan_modules pm
    WHERE pm.plan_id = v_plan_id 
      AND pm.activer = true
    ORDER BY pm.module_code
  LOOP
    v_modules_json := v_modules_json || jsonb_build_object(v_module_record.module_code, true);
    v_modules_count := v_modules_count + 1;
    RAISE NOTICE '[sync_client_modules_from_plan] 📦 Module ajouté: %', v_module_record.module_code;
  END LOOP;
  
  -- Toujours ajouter les modules de base
  v_modules_json := v_modules_json || jsonb_build_object(
    'dashboard', true,
    'tableau_de_bord', true,
    'tableau-de-bord', true,
    'mon_entreprise', true,
    'mon-entreprise', true,
    'entreprises', true,
    'settings', true,
    'parametres', true,
    'paramètres', true
  );
  
  -- Mettre à jour modules_actifs dans l'espace client
  UPDATE espaces_membres_clients
  SET modules_actifs = v_modules_json,
      updated_at = NOW()
  WHERE id = p_espace_id;
  
  RAISE NOTICE '[sync_client_modules_from_plan] ✅ Modules synchronisés pour l''espace client % : % modules', 
    p_espace_id, 
    v_modules_count;
    
  RAISE NOTICE '[sync_client_modules_from_plan] 📦 Modules JSON: %', v_modules_json::text;
END;
$$;

COMMENT ON FUNCTION sync_client_modules_from_plan IS 'Synchronise les modules d''un espace client depuis son plan d''abonnement. Utilise plan_modules (42 modules pour Enterprise).';

-- ============================================================================
-- PARTIE 2 : Forcer la synchronisation pour TOUS les espaces membres actifs
-- ============================================================================

DO $$
DECLARE
  v_espace_record RECORD;
  v_count_synced INTEGER := 0;
  v_count_errors INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  🔄 SYNCHRONISATION DES MODULES POUR TOUS LES ESPACES';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  FOR v_espace_record IN
    SELECT 
      emc.id,
      emc.client_id,
      emc.abonnement_id,
      c.email,
      a.plan_id,
      p.nom as plan_nom
    FROM espaces_membres_clients emc
    JOIN clients c ON c.id = emc.client_id
    LEFT JOIN abonnements a ON a.id = emc.abonnement_id
    LEFT JOIN plans_abonnement p ON p.id = a.plan_id
    WHERE emc.actif = true
      AND emc.abonnement_id IS NOT NULL
      AND a.statut = 'actif'
    ORDER BY emc.created_at DESC
  LOOP
    BEGIN
      PERFORM sync_client_modules_from_plan(v_espace_record.id);
      v_count_synced := v_count_synced + 1;
      RAISE NOTICE '✅ Espace % (client: %) - Plan: % - Modules synchronisés', 
        v_espace_record.id, 
        v_espace_record.email,
        v_espace_record.plan_nom;
    EXCEPTION
      WHEN OTHERS THEN
        v_count_errors := v_count_errors + 1;
        RAISE WARNING '❌ Erreur synchronisation espace % (client: %): %', 
          v_espace_record.id, 
          v_espace_record.email,
          SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RÉSUMÉ';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  Espaces synchronisés: %', v_count_synced;
  RAISE NOTICE '  Erreurs: %', v_count_errors;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT '✅ Migration de synchronisation des modules appliquée avec succès !' as resultat;

