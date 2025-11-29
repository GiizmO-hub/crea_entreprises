# 📋 GUIDE D'APPLICATION DES MIGRATIONS

## 🚀 Application via Dashboard Supabase

### Étape 1 : Ouvrir le SQL Editor
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Cliquez sur "SQL Editor" dans le menu de gauche

### Étape 2 : Migration 1 - Correction RLS

Copiez-collez le contenu suivant dans l'éditeur SQL :

/*
  # Correction RLS : Permettre aux clients de voir leur entreprise
  
  **Problème:**
  - Les clients ont un espace_membre_client avec entreprise_id
  - Mais ils ne peuvent pas voir l'entreprise car RLS vérifie user_id = auth.uid()
  - Les clients n'ont PAS user_id sur l'entreprise (elle appartient au propriétaire plateforme)
  
  **Solution:**
  - Ajouter une condition OR pour permettre aux clients de voir leur entreprise
  - via espaces_membres_clients (si user_id correspond)
*/

-- ✅ CORRECTION 1 : Permettre aux clients de voir leur entreprise
-- Supprimer l'ancienne politique qui utilise FOR ALL (elle sera remplacée)
DROP POLICY IF EXISTS "super_admin_or_owner_entreprises" ON entreprises;
DROP POLICY IF EXISTS "Clients can view their enterprise" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_or_client_entreprises" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_entreprises_all" ON entreprises;

-- Créer une politique SELECT séparée qui permet :
-- 1. Super admin plateforme : voir toutes les entreprises
-- 2. Propriétaire (user_id) : voir ses entreprises
-- 3. Client : voir son entreprise via espaces_membres_clients
CREATE POLICY "super_admin_or_owner_or_client_entreprises_select"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    public.is_super_admin_check()
    OR 
    -- Propriétaire voit ses entreprises
    user_id = auth.uid()
    OR 
    -- Client voit son entreprise via espaces_membres_clients
    EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE espaces_membres_clients.entreprise_id = entreprises.id
      AND espaces_membres_clients.user_id = auth.uid()
      AND espaces_membres_clients.actif = true
    )
  );

-- Pour les autres opérations (INSERT, UPDATE, DELETE), garder la logique actuelle
-- (seuls super admin et propriétaires peuvent modifier)
CREATE POLICY "super_admin_or_owner_entreprises_insert"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  );

CREATE POLICY "super_admin_or_owner_entreprises_update"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  );

CREATE POLICY "super_admin_or_owner_entreprises_delete"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin_check()
    OR user_id = auth.uid()
  );

-- ✅ CORRECTION 2 : S'assurer que les fonctions helper existent
-- Vérifier si is_super_admin_check existe
DO $$
BEGIN
  -- Cette fonction devrait déjà exister, mais on vérifie
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_super_admin_check'
  ) THEN
    RAISE NOTICE '⚠️ Fonction is_super_admin_check() non trouvée, création...';
    
    CREATE OR REPLACE FUNCTION public.is_super_admin_check()
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      -- Vérifier dans utilisateurs table
      RETURN EXISTS (
        SELECT 1 FROM utilisateurs
        WHERE id = auth.uid()
        AND role = 'super_admin'
      );
    END;
    $$;
  END IF;
END $$;

COMMENT ON POLICY "super_admin_or_owner_or_client_entreprises_select" ON entreprises IS 
'Permet aux super admins, propriétaires et clients de voir les entreprises';


---

### Étape 3 : Migration 2 - Synchronisation des modules

Copiez-collez le contenu suivant dans l'éditeur SQL :

/*
  # Synchronisation automatique des modules pour tous les clients actifs
  
  **Problème:**
  - Les clients ont des modules activés dans leur abonnement (plan_modules)
  - Mais ces modules ne sont pas tous synchronisés dans modules_actifs de espaces_membres_clients
  - Certains modules comme "gestion-projets" ne s'affichent pas dans l'interface client
  
  **Solution:**
  - Créer une fonction qui synchronise automatiquement tous les modules
  - depuis plan_modules (via l'abonnement) vers modules_actifs
  - Appeler cette fonction pour tous les clients actifs avec abonnement
*/

-- ✅ FONCTION : Synchroniser les modules d'un client depuis son abonnement
CREATE OR REPLACE FUNCTION sync_client_modules_from_subscription(
  p_client_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_espace_membre_id uuid;
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_modules_json jsonb := '{}'::jsonb;
  v_module_record RECORD;
  v_modules_count integer := 0;
  v_client_id uuid;
BEGIN
  RAISE NOTICE '[sync_client_modules_from_subscription] 🚀 DÉBUT - User ID: %', p_client_user_id;
  
  -- 1. Récupérer l'espace membre du client
  SELECT id, client_id, abonnement_id
  INTO v_espace_membre_id, v_client_id, v_abonnement_id
  FROM espaces_membres_clients
  WHERE user_id = p_client_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_subscription] ❌ Espace membre non trouvé pour user: %', p_client_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'Espace membre non trouvé');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Espace membre trouvé: %', v_espace_membre_id;
  
  -- 2. Récupérer l'abonnement actif
  IF v_abonnement_id IS NULL THEN
    -- Chercher l'abonnement actif le plus récent
    SELECT id, plan_id INTO v_abonnement_id, v_plan_id
    FROM abonnements
    WHERE client_id = (
      SELECT id FROM auth.users WHERE id = p_client_user_id
    )::text::uuid
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    -- Récupérer le plan_id depuis l'abonnement lié
    SELECT plan_id INTO v_plan_id
    FROM abonnements
    WHERE id = v_abonnement_id AND statut = 'actif'
    LIMIT 1;
  END IF;
  
  -- Si toujours pas d'abonnement, essayer via client_id
  IF v_plan_id IS NULL AND v_client_id IS NOT NULL THEN
    SELECT id, plan_id INTO v_abonnement_id, v_plan_id
    FROM abonnements
    WHERE client_id = v_client_id
    AND statut = 'actif'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_plan_id IS NULL THEN
    RAISE WARNING '[sync_client_modules_from_subscription] ❌ Aucun abonnement actif trouvé';
    RETURN jsonb_build_object('success', false, 'error', 'Aucun abonnement actif');
  END IF;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Plan trouvé: %', v_plan_id;
  
  -- 3. Récupérer TOUS les modules activés du plan
  FOR v_module_record IN
    SELECT DISTINCT 
      COALESCE(pm.module_code, pm.module_id, m.code) as module_code,
      COALESCE(pm.module_nom, m.nom) as module_nom
    FROM plan_modules pm
    LEFT JOIN modules m ON m.id = pm.module_id OR m.code = pm.module_code
    WHERE pm.plan_id = v_plan_id 
    AND (
      pm.actif = true 
      OR pm.activer = true
      OR (pm.actif IS NULL AND pm.activer IS NULL AND pm.inclus = true)
    )
    ORDER BY module_code
  LOOP
    IF v_module_record.module_code IS NOT NULL THEN
      -- Normaliser le code (tirets vs underscores)
      v_modules_json := v_modules_json || jsonb_build_object(
        lower(replace(v_module_record.module_code, '_', '-')), 
        true
      );
      v_modules_json := v_modules_json || jsonb_build_object(
        lower(replace(v_module_record.module_code, '-', '_')), 
        true
      );
      v_modules_count := v_modules_count + 1;
      RAISE NOTICE '[sync_client_modules_from_subscription] 📦 Module ajouté: %', v_module_record.module_code;
    END IF;
  END LOOP;
  
  -- 4. Modules de base toujours présents
  v_modules_json := v_modules_json || jsonb_build_object(
    'dashboard', true,
    'tableau_de_bord', true,
    'tableau-de-bord', true,
    'entreprises', true,
    'mon_entreprise', true,
    'mon-entreprise', true,
    'settings', true,
    'parametres', true,
    'paramètres', true
  );
  
  -- 5. Mettre à jour l'espace membre
  UPDATE espaces_membres_clients
  SET 
    modules_actifs = v_modules_json,
    abonnement_id = v_abonnement_id,
    updated_at = now()
  WHERE id = v_espace_membre_id;
  
  RAISE NOTICE '[sync_client_modules_from_subscription] ✅ Modules synchronisés: % modules', v_modules_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'modules_count', v_modules_count,
    'modules', v_modules_json
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[sync_client_modules_from_subscription] ❌ Erreur: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ✅ SYNCHRONISER TOUS LES CLIENTS ACTIFS
DO $$
DECLARE
  v_client_record RECORD;
  v_result jsonb;
  v_synced_count integer := 0;
  v_error_count integer := 0;
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔄 DÉBUT DE LA SYNCHRONISATION DES MODULES POUR TOUS LES CLIENTS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- Parcourir tous les espaces membres clients actifs
  FOR v_client_record IN
    SELECT DISTINCT emc.user_id, emc.client_id, emc.id as espace_id
    FROM espaces_membres_clients emc
    WHERE emc.actif = true
    AND emc.user_id IS NOT NULL
    ORDER BY emc.created_at DESC
  LOOP
    BEGIN
      v_result := sync_client_modules_from_subscription(v_client_record.user_id);
      
      IF (v_result->>'success')::boolean = true THEN
        v_synced_count := v_synced_count + 1;
        RAISE NOTICE '✅ Client %: % modules synchronisés', 
          v_client_record.user_id, 
          v_result->>'modules_count';
      ELSE
        v_error_count := v_error_count + 1;
        RAISE WARNING '❌ Client %: %', 
          v_client_record.user_id, 
          v_result->>'error';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING '❌ Erreur pour client %: %', 
        v_client_record.user_id, 
        SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ SYNCHRONISATION TERMINÉE';
  RAISE NOTICE '   → % clients synchronisés avec succès', v_synced_count;
  RAISE NOTICE '   → % erreurs', v_error_count;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END;
$$;

-- ✅ COMMENTAIRES
COMMENT ON FUNCTION sync_client_modules_from_subscription(uuid) IS 
'Synchronise automatiquement les modules actifs depuis l''abonnement du client vers modules_actifs de espaces_membres_clients';


---

## ✅ Vérification

Après avoir appliqué les migrations, vérifiez que :

1. ✅ Les clients peuvent voir leur entreprise
2. ✅ Tous les modules de l'abonnement sont synchronisés dans `modules_actifs`
3. ✅ Le module "gestion-projets" apparaît pour les clients qui l'ont dans leur abonnement

## 🔍 Test

Connectez-vous avec le compte client (`groupemclem@gmail.com`) et vérifiez que :
- L'entreprise s'affiche dans "Mon Entreprise"
- Tous les modules de l'abonnement apparaissent dans la sidebar
- Le module "Gestion Projets" est visible si activé dans l'abonnement

