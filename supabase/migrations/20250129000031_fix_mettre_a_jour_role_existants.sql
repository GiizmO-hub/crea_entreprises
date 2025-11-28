/*
  # CORRECTION : Mettre à jour les rôles existants et améliorer la détection
  
  Problème :
  - Les paiements sont payés mais le rôle reste "client" au lieu de "client_super_admin"
  - Le statut reste "Non requis" car le rôle n'est pas détecté
  - Il faut mettre à jour les rôles pour les paiements déjà traités
  
  Solution :
  - Créer une fonction pour mettre à jour tous les rôles manquants
  - Corriger les rôles pour les paiements déjà traités
  - Forcer la mise à jour même si le workflow a déjà été traité
*/

-- ========================================
-- Fonction pour mettre à jour les rôles manquants
-- ========================================

CREATE OR REPLACE FUNCTION corriger_roles_client_super_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_client RECORD;
  v_updated_utilisateurs integer := 0;
  v_updated_auth_users integer := 0;
  v_total_count integer := 0;
BEGIN
  RAISE NOTICE '[corriger_roles_client_super_admin] 🚀 DÉBUT correction des rôles';
  
  -- Parcourir tous les clients qui ont un paiement payé mais pas le rôle client_super_admin
  FOR v_client IN
    SELECT DISTINCT
      c.id as client_id,
      c.email as client_email,
      u.id as user_id,
      u.role as current_role,
      e.id as entreprise_id
    FROM clients c
    INNER JOIN entreprises e ON e.id = c.entreprise_id
    INNER JOIN paiements p ON p.entreprise_id = e.id
    LEFT JOIN utilisateurs u ON u.email = c.email
    WHERE p.statut = 'paye'
      AND (u.role IS NULL OR u.role != 'client_super_admin')
      AND c.statut = 'actif'
  LOOP
    v_total_count := v_total_count + 1;
    
    RAISE NOTICE '[corriger_roles_client_super_admin] 🔍 Client: % (Email: %), Role actuel: %', 
      v_client.client_id, v_client.client_email, v_client.current_role;
    
    -- Mettre à jour dans utilisateurs
    IF v_client.user_id IS NOT NULL THEN
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE id = v_client.user_id AND (role IS NULL OR role != 'client_super_admin');
      
      GET DIAGNOSTICS v_updated_utilisateurs = ROW_COUNT;
      
      IF v_updated_utilisateurs > 0 THEN
        RAISE NOTICE '[corriger_roles_client_super_admin] ✅ utilisateurs mis à jour: %', v_client.user_id;
      END IF;
      
      -- Mettre à jour dans auth.users
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"client_super_admin"'::jsonb,
        true
      )
      WHERE id = v_client.user_id;
      
      GET DIAGNOSTICS v_updated_auth_users = ROW_COUNT;
      
      IF v_updated_auth_users > 0 THEN
        RAISE NOTICE '[corriger_roles_client_super_admin] ✅ auth.users mis à jour: %', v_client.user_id;
      END IF;
      
      v_updated_utilisateurs := v_updated_utilisateurs + v_updated_auth_users;
    ELSE
      -- Si pas d'utilisateur trouvé, essayer par email
      UPDATE utilisateurs
      SET role = 'client_super_admin'
      WHERE email = v_client.client_email AND (role IS NULL OR role != 'client_super_admin');
      
      GET DIAGNOSTICS v_updated_utilisateurs = ROW_COUNT;
      
      UPDATE auth.users
      SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"client_super_admin"'::jsonb,
        true
      )
      WHERE email = v_client.client_email;
      
      GET DIAGNOSTICS v_updated_auth_users = ROW_COUNT;
      
      IF v_updated_utilisateurs > 0 OR v_updated_auth_users > 0 THEN
        RAISE NOTICE '[corriger_roles_client_super_admin] ✅ Rôle mis à jour pour % (par email)', v_client.client_email;
      END IF;
      
      v_updated_utilisateurs := v_updated_utilisateurs + v_updated_auth_users;
    END IF;
  END LOOP;
  
  RAISE NOTICE '[corriger_roles_client_super_admin] ✅ TERMINÉ - % clients vérifiés, % rôles mis à jour', v_total_count, v_updated_utilisateurs;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_checked', v_total_count,
    'updated_utilisateurs', v_updated_utilisateurs,
    'updated_auth_users', v_updated_auth_users,
    'message', format('Rôles corrigés: %s clients mis à jour', v_updated_utilisateurs)
  );
END;
$$;

-- ========================================
-- Appeler la fonction maintenant pour corriger les rôles existants
-- ========================================

DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := corriger_roles_client_super_admin();
  RAISE NOTICE '✅ Correction des rôles effectuée: %', v_result;
END $$;

COMMENT ON FUNCTION corriger_roles_client_super_admin IS 
  'Met à jour tous les rôles manquants pour les clients ayant un paiement payé. À appeler manuellement si besoin.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000031 appliquée';
  RAISE NOTICE '📋 Fonction corriger_roles_client_super_admin créée et exécutée';
  RAISE NOTICE '📋 Rôles mis à jour pour les paiements déjà traités';
END $$;
