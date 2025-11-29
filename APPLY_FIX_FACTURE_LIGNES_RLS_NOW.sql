/*
  # Fix RLS facture_lignes - Permettre création depuis espace client
  
  ⚠️ IMPORTANT: Appliquez ce fichier dans Supabase SQL Editor
  
  Cette migration met à jour les politiques RLS pour la table facture_lignes
  afin de permettre aux clients de l'espace client de créer des lignes de facture
  pour les factures de leur entreprise.
  
  Les utilisateurs peuvent créer des lignes de facture si :
  1. Ils sont super_admin plateforme
  2. Ils sont propriétaires de l'entreprise
  3. Ils ont un espace membre client pour l'entreprise ET la facture appartient à leur entreprise
*/

-- ✅ Mettre à jour les politiques RLS pour facture_lignes

-- 1. SELECT : 
--    - Super admin : voit tout
--    - Propriétaire entreprise : voit toutes les lignes des factures de son entreprise
--    - Client espace : voit les lignes des factures de son entreprise
DROP POLICY IF EXISTS "Users can view facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Platform super_admin can see all facture_lignes" ON facture_lignes;

CREATE POLICY "Users can view facture_lignes"
  ON facture_lignes FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise voit les lignes des factures de son entreprise
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND public.user_owns_entreprise(factures.entreprise_id)
    )
    OR
    -- Client espace voit les lignes des factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM factures
        INNER JOIN espaces_membres_clients ON espaces_membres_clients.entreprise_id = factures.entreprise_id
        WHERE factures.id = facture_lignes.facture_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

-- 2. INSERT : 
--    - Super admin : peut créer pour toutes les factures
--    - Propriétaire entreprise : peut créer des lignes pour les factures de son entreprise
--    - Client espace : peut créer des lignes pour les factures de son entreprise
DROP POLICY IF EXISTS "Users can insert facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Platform super_admin can create facture_lignes" ON facture_lignes;

CREATE POLICY "Users can insert facture_lignes"
  ON facture_lignes FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour toutes les factures
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut créer des lignes pour les factures de son entreprise
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND public.user_owns_entreprise(factures.entreprise_id)
    )
    OR
    -- Client espace peut créer des lignes pour les factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM factures
        INNER JOIN espaces_membres_clients ON espaces_membres_clients.entreprise_id = factures.entreprise_id
        WHERE factures.id = facture_lignes.facture_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

-- 3. UPDATE :
--    - Super admin : peut modifier toutes les lignes
--    - Propriétaire entreprise : peut modifier les lignes des factures de son entreprise
--    - Client espace : peut modifier les lignes des factures de son entreprise
DROP POLICY IF EXISTS "Users can update facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Platform super_admin can update facture_lignes" ON facture_lignes;

CREATE POLICY "Users can update facture_lignes"
  ON facture_lignes FOR UPDATE
  TO authenticated
  USING (
    -- Super admin plateforme peut modifier toutes les lignes
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut modifier les lignes des factures de son entreprise
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND public.user_owns_entreprise(factures.entreprise_id)
    )
    OR
    -- Client espace peut modifier les lignes des factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM factures
        INNER JOIN espaces_membres_clients ON espaces_membres_clients.entreprise_id = factures.entreprise_id
        WHERE factures.id = facture_lignes.facture_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  )
  WITH CHECK (
    -- Mêmes conditions pour WITH CHECK
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND public.user_owns_entreprise(factures.entreprise_id)
    )
    OR
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM factures
        INNER JOIN espaces_membres_clients ON espaces_membres_clients.entreprise_id = factures.entreprise_id
        WHERE factures.id = facture_lignes.facture_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

-- 4. DELETE :
--    - Super admin : peut supprimer toutes les lignes
--    - Propriétaire entreprise : peut supprimer les lignes des factures de son entreprise
--    - Client espace : peut supprimer les lignes des factures de son entreprise
DROP POLICY IF EXISTS "Users can delete facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Platform super_admin can delete facture_lignes" ON facture_lignes;

CREATE POLICY "Users can delete facture_lignes"
  ON facture_lignes FOR DELETE
  TO authenticated
  USING (
    -- Super admin plateforme peut supprimer toutes les lignes
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut supprimer les lignes des factures de son entreprise
    EXISTS (
      SELECT 1 FROM factures
      WHERE factures.id = facture_lignes.facture_id
      AND public.user_owns_entreprise(factures.entreprise_id)
    )
    OR
    -- Client espace peut supprimer les lignes des factures de son entreprise
    (
      public.user_is_client()
      AND EXISTS (
        SELECT 1 FROM factures
        INNER JOIN espaces_membres_clients ON espaces_membres_clients.entreprise_id = factures.entreprise_id
        WHERE factures.id = facture_lignes.facture_id
        AND espaces_membres_clients.user_id = auth.uid()
        AND espaces_membres_clients.actif = true
      )
    )
  );

-- ✅ Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS facture_lignes mises à jour avec succès !';
  RAISE NOTICE '   → Les clients de l''espace client peuvent maintenant créer, modifier et supprimer des lignes de facture';
  RAISE NOTICE '   → Les lignes sont limitées aux factures de leur entreprise (via espaces_membres_clients)';
END $$;

