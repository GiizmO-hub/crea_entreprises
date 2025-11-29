/*
  # Fix RLS Factures - Permettre création depuis espace client
  
  ⚠️ IMPORTANT: Appliquez ce fichier dans Supabase SQL Editor
  
  Cette migration met à jour les politiques RLS pour la table factures
  afin de permettre aux clients de l'espace client de créer des factures
  pour leur entreprise.
  
  Les utilisateurs peuvent créer des factures si :
  1. Ils sont super_admin plateforme
  2. Ils sont propriétaires de l'entreprise (entreprises.user_id = auth.uid())
  3. Ils ont un espace membre client pour l'entreprise (espaces_membres_clients)
*/

-- ✅ Mettre à jour les politiques RLS pour les factures

-- 1. SELECT : 
--    - Super admin : voit tout
--    - Propriétaire entreprise : voit toutes les factures de son entreprise
--    - Client espace : voit les factures de son entreprise (via espaces_membres_clients)
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut voir factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can see all factures" ON factures;
DROP POLICY IF EXISTS "super_admin_all_access_factures" ON factures;
DROP POLICY IF EXISTS "super_admin_or_owner_factures" ON factures;

CREATE POLICY "Users can view factures"
  ON factures FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise voit toutes les factures de son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace voit les factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = auth.uid()
        AND entreprise_id = factures.entreprise_id
        AND actif = true
      )
    )
  );

-- 2. INSERT : 
--    - Super admin : peut créer pour toutes les entreprises
--    - Propriétaire entreprise : peut créer des factures pour son entreprise
--    - Client espace : peut créer des factures pour son entreprise
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut créer factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can create all factures" ON factures;

CREATE POLICY "Users can insert factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour toutes les entreprises
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut créer des factures pour son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut créer des factures pour son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = auth.uid()
        AND entreprise_id = factures.entreprise_id
        AND actif = true
      )
    )
  );

-- 3. UPDATE :
--    - Super admin : peut modifier toutes les factures
--    - Propriétaire entreprise : peut modifier les factures de son entreprise
--    - Client espace : peut modifier les factures de son entreprise
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut modifier factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can update all factures" ON factures;

CREATE POLICY "Users can update factures"
  ON factures FOR UPDATE
  TO authenticated
  USING (
    -- Super admin plateforme peut modifier toutes les factures
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut modifier les factures de son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut modifier les factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = auth.uid()
        AND entreprise_id = factures.entreprise_id
        AND actif = true
      )
    )
  )
  WITH CHECK (
    -- Mêmes conditions pour WITH CHECK
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    public.user_owns_entreprise(entreprise_id)
    OR
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = auth.uid()
        AND entreprise_id = factures.entreprise_id
        AND actif = true
      )
    )
  );

-- 4. DELETE :
--    - Super admin : peut supprimer toutes les factures
--    - Propriétaire entreprise : peut supprimer les factures de son entreprise
--    - Client espace : peut supprimer les factures de son entreprise
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut supprimer factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete factures" ON factures;
DROP POLICY IF EXISTS "Platform super_admin can delete all factures" ON factures;

CREATE POLICY "Users can delete factures"
  ON factures FOR DELETE
  TO authenticated
  USING (
    -- Super admin plateforme peut supprimer toutes les factures
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut supprimer les factures de son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut supprimer les factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE user_id = auth.uid()
        AND entreprise_id = factures.entreprise_id
        AND actif = true
      )
    )
  );

-- ✅ Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS factures mises à jour avec succès !';
  RAISE NOTICE '   → Les clients de l''espace client peuvent maintenant créer, modifier et supprimer des factures';
  RAISE NOTICE '   → Les factures sont limitées à leur entreprise (via espaces_membres_clients)';
END $$;

