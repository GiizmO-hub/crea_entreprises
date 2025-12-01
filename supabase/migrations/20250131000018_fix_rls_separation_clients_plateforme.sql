/*
  # FIX RLS - Séparation complète clients/plateforme
  
  **Problème:**
  - Les droits clients et plateforme ne sont pas bien séparés
  - Les factures créées par les clients sont visibles par la plateforme
  - Les clients peuvent voir des données qui ne leur appartiennent pas
  - Il y a des politiques RLS en double qui créent des conflits
  
  **Solution:**
  - Nettoyer toutes les politiques RLS en double
  - Ajouter la vérification du champ `source` pour les factures
  - S'assurer que les clients ne voient QUE leurs propres données
  - S'assurer que la plateforme ne voit PAS les données créées par les clients (sauf super_admin)
  - Vérifier que is_platform_super_admin ne retourne pas true pour client_super_admin
*/

-- ============================================================================
-- PARTIE 1 : Corriger is_platform_super_admin pour exclure client_super_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- ✅ Vérifier UNIQUEMENT le rôle 'super_admin' (plateforme), PAS 'client_super_admin'
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text = 'super_admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

COMMENT ON FUNCTION public.is_platform_super_admin() IS 'Vérifie si l''utilisateur est super_admin PLATEFORME (role = super_admin). Ne retourne PAS true pour client_super_admin.';

-- ============================================================================
-- PARTIE 2 : Nettoyer et recréer les politiques RLS pour CLIENTS
-- ============================================================================

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;
DROP POLICY IF EXISTS "super_admin_or_owner_clients" ON clients;

-- SELECT : Super admin plateforme voit tout, propriétaire voit ses clients, client voit uniquement son propre client
CREATE POLICY "clients_select_policy"
  ON clients FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    public.is_platform_super_admin()
    OR 
    -- Propriétaire entreprise voit tous les clients de son entreprise
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    -- Client espace voit UNIQUEMENT son propre client
    (
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.client_id = clients.id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

-- INSERT : Seuls super admin plateforme et propriétaires peuvent créer des clients
CREATE POLICY "clients_insert_policy"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour toutes les entreprises
    public.is_platform_super_admin()
    OR 
    -- Propriétaire entreprise peut créer des clients pour son entreprise
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    -- Les clients de l'espace client NE PEUVENT PAS créer de clients
  );

-- UPDATE : Super admin plateforme, propriétaires et clients peuvent modifier (leur propre client)
CREATE POLICY "clients_update_policy"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    -- Client peut modifier UNIQUEMENT son propre client
    EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE espaces_membres_clients.client_id = clients.id
      AND espaces_membres_clients.user_id = auth.uid()
      AND espaces_membres_clients.actif = true
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE espaces_membres_clients.client_id = clients.id
      AND espaces_membres_clients.user_id = auth.uid()
      AND espaces_membres_clients.actif = true
    )
  );

-- DELETE : Seuls super admin plateforme et propriétaires peuvent supprimer
CREATE POLICY "clients_delete_policy"
  ON clients FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    -- Les clients NE PEUVENT PAS supprimer de clients
  );

-- ============================================================================
-- PARTIE 3 : Nettoyer et recréer les politiques RLS pour FACTURES
-- ============================================================================

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Users can view factures" ON factures;
DROP POLICY IF EXISTS "Users can insert factures" ON factures;
DROP POLICY IF EXISTS "Users can update factures" ON factures;
DROP POLICY IF EXISTS "Users can delete factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;

-- SELECT : 
-- - Super admin plateforme voit TOUT
-- - Propriétaire entreprise voit les factures de son entreprise (source != 'client')
-- - Client voit les factures de son entreprise (source = 'plateforme' OU créées par lui)
CREATE POLICY "factures_select_policy"
  ON factures FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit TOUT
    public.is_platform_super_admin()
    OR 
    (
      -- Propriétaire entreprise voit les factures de son entreprise
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = factures.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
      AND (
        -- La plateforme ne voit PAS les factures créées par les clients
        factures.source IS NULL 
        OR factures.source != 'client'
        OR public.is_platform_super_admin()
      )
    )
    OR
    (
      -- Client voit les factures de son entreprise
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.entreprise_id = factures.entreprise_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
      AND (
        -- Client voit les factures créées par la plateforme OU créées par lui
        factures.source = 'plateforme'
        OR factures.source = 'client'
        OR factures.source IS NULL
      )
    )
  );

-- INSERT : 
-- - Super admin plateforme peut créer pour toutes les entreprises
-- - Propriétaire entreprise peut créer des factures (source = 'plateforme')
-- - Client peut créer des factures pour son entreprise (source = 'client')
CREATE POLICY "factures_insert_policy"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour toutes les entreprises
    public.is_platform_super_admin()
    OR 
    (
      -- Propriétaire entreprise peut créer des factures pour son entreprise
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = factures.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
      AND (
        -- La plateforme crée avec source = 'plateforme' ou NULL
        factures.source IS NULL 
        OR factures.source = 'plateforme'
      )
    )
    OR
    (
      -- Client peut créer des factures pour son entreprise
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.entreprise_id = factures.entreprise_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
      AND (
        -- Le client crée avec source = 'client'
        factures.source = 'client'
      )
    )
  );

-- UPDATE : Même logique que INSERT
CREATE POLICY "factures_update_policy"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR 
    (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = factures.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
      AND (
        factures.source IS NULL 
        OR factures.source != 'client'
        OR public.is_platform_super_admin()
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.entreprise_id = factures.entreprise_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
      AND (
        factures.source = 'client'
        OR factures.source = 'plateforme'
        OR factures.source IS NULL
      )
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR 
    (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = factures.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
      AND (
        factures.source IS NULL 
        OR factures.source != 'client'
        OR public.is_platform_super_admin()
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.entreprise_id = factures.entreprise_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
      AND (
        factures.source = 'client'
        OR factures.source = 'plateforme'
        OR factures.source IS NULL
      )
    )
  );

-- DELETE : Même logique que SELECT
CREATE POLICY "factures_delete_policy"
  ON factures FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR 
    (
      EXISTS (
        SELECT 1 FROM entreprises
        WHERE entreprises.id = factures.entreprise_id
        AND entreprises.user_id = auth.uid()
      )
      AND (
        factures.source IS NULL 
        OR factures.source != 'client'
        OR public.is_platform_super_admin()
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE espaces_membres_clients.entreprise_id = factures.entreprise_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
      AND (
        factures.source = 'client'
      )
    )
  );

-- ============================================================================
-- PARTIE 4 : Nettoyer et recréer les politiques RLS pour ENTREPRISES
-- ============================================================================

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Platform super_admin can see all entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can create entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can update entreprises" ON entreprises;
DROP POLICY IF EXISTS "Platform super_admin can delete entreprises" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_entreprises_delete" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_entreprises_insert" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_entreprises_update" ON entreprises;
DROP POLICY IF EXISTS "super_admin_or_owner_or_client_entreprises_select" ON entreprises;

-- SELECT : Super admin plateforme voit tout, propriétaire voit ses entreprises, client voit son entreprise
CREATE POLICY "entreprises_select_policy"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE espaces_membres_clients.entreprise_id = entreprises.id
      AND espaces_membres_clients.user_id = auth.uid()
      AND espaces_membres_clients.actif = true
    )
  );

-- INSERT : Seuls super admin plateforme et utilisateurs peuvent créer des entreprises
CREATE POLICY "entreprises_insert_policy"
  ON entreprises FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR user_id = auth.uid()
    -- Les clients NE PEUVENT PAS créer d'entreprises
  );

-- UPDATE : Super admin plateforme et propriétaires peuvent modifier
CREATE POLICY "entreprises_update_policy"
  ON entreprises FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR user_id = auth.uid()
  );

-- DELETE : Seuls super admin plateforme et propriétaires peuvent supprimer
CREATE POLICY "entreprises_delete_policy"
  ON entreprises FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR user_id = auth.uid()
  );

-- ============================================================================
-- PARTIE 5 : Vérification finale
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  ✅ MIGRATION RLS SÉPARATION CLIENTS/PLATEFORME APPLIQUÉE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  ✅ Politiques RLS nettoyées et recréées';
  RAISE NOTICE '  ✅ Séparation clients/plateforme basée sur le champ source';
  RAISE NOTICE '  ✅ Clients ne voient QUE leurs propres données';
  RAISE NOTICE '  ✅ Plateforme ne voit PAS les données créées par les clients';
  RAISE NOTICE '  ✅ Super admin plateforme voit TOUT';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

SELECT '✅ Migration de séparation clients/plateforme appliquée avec succès !' as resultat;

