/*
  # Forcer l'ajout des modules manquants à tous les clients actifs
  
  **Problème:**
  - Les modules "gestion-projets", "documents", "gestion-equipe" sont créés et actifs
  - Mais ils ne sont pas dans modules_actifs des clients
  - La synchronisation ne les a pas inclus
  
  **Solution:**
  - Ajouter directement ces modules dans modules_actifs de tous les clients actifs
  - Utiliser les deux formats (tirets et underscores) pour compatibilité
*/

-- Forcer l'ajout des modules manquants à tous les clients actifs
DO $$
DECLARE
  v_client_record RECORD;
  v_modules_json jsonb;
  v_updated_count integer := 0;
  v_modules_to_add jsonb := jsonb_build_object(
    'gestion-projets', true,
    'gestion_projets', true,
    'gestion-de-projets', true,
    'gestion_de_projets', true,
    'documents', true,
    'gestion-documents', true,
    'gestion_documents', true,
    'gestion-de-documents', true,
    'gestion_de_documents', true,
    'gestion-equipe', true,
    'gestion_equipe', true,
    'gestion-d-equipe', true,
    'gestion-d-équipe', true,
    'gestion_dequipe', true,
    'gestion_d_equipe', true,
    'gestion_d_équipe', true
  );
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔄 AJOUT FORCÉ DES MODULES MANQUANTS À TOUS LES CLIENTS ACTIFS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  FOR v_client_record IN
    SELECT id, user_id, modules_actifs
    FROM espaces_membres_clients
    WHERE actif = true
    AND user_id IS NOT NULL
  LOOP
    BEGIN
      -- Fusionner les modules existants avec les nouveaux modules
      v_modules_json := COALESCE(v_client_record.modules_actifs, '{}'::jsonb) || v_modules_to_add;
      
      -- Mettre à jour l'espace membre
      UPDATE espaces_membres_clients
      SET 
        modules_actifs = v_modules_json,
        updated_at = now()
      WHERE id = v_client_record.id;
      
      v_updated_count := v_updated_count + 1;
      
      RAISE NOTICE '✅ Client %: Modules ajoutés (gestion-projets, documents, gestion-equipe)', 
        v_client_record.user_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Erreur pour client %: %', 
        v_client_record.user_id, 
        SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ MISE À JOUR TERMINÉE';
  RAISE NOTICE '   → % clients mis à jour', v_updated_count;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END;
$$;

-- Vérification : Afficher les modules après mise à jour
SELECT 
  user_id,
  modules_actifs->'gestion-projets' as gestion_projets,
  modules_actifs->'documents' as documents,
  modules_actifs->'gestion-equipe' as gestion_equipe,
  modules_actifs
FROM espaces_membres_clients
WHERE actif = true
LIMIT 5;

