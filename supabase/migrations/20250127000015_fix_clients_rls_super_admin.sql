/*
  # Fix RLS Clients - Autoriser super_admin
  
  Cette migration met à jour les politiques RLS pour la table clients
  afin de permettre aux super_admin de créer, modifier, supprimer et voir
  tous les clients de toutes les entreprises.
*/

-- Fonction helper pour vérifier si l'utilisateur est super_admin plateforme
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text = 'super_admin'
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

-- Fonction helper pour vérifier si l'utilisateur est admin ou super_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text IN ('admin', 'super_admin')
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

-- ✅ Mettre à jour les politiques RLS pour les clients
-- 1. SELECT : Super_admin et propriétaires d'entreprise peuvent voir leurs clients
DROP POLICY IF EXISTS "Users can view entreprise clients" ON clients;
DROP POLICY IF EXISTS "Users can view clients" ON clients;
CREATE POLICY "Users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = (SELECT auth.uid())
    )
  );

-- 2. INSERT : Super_admin peut créer des clients pour toutes les entreprises
DROP POLICY IF EXISTS "Users can insert entreprise clients" ON clients;
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = (SELECT auth.uid())
    )
  );

-- 3. UPDATE : Super_admin peut modifier tous les clients
DROP POLICY IF EXISTS "Users can update entreprise clients" ON clients;
DROP POLICY IF EXISTS "Users can update clients" ON clients;
CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = (SELECT auth.uid())
    )
  );

-- 4. DELETE : Super_admin peut supprimer tous les clients
DROP POLICY IF EXISTS "Users can delete entreprise clients" ON clients;
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE entreprises.id = clients.entreprise_id
      AND entreprises.user_id = (SELECT auth.uid())
    )
  );

-- ✅ Mettre à jour aussi les politiques pour les entreprises
-- Permettre aux super_admin de voir toutes les entreprises
DROP POLICY IF EXISTS "Users can read entreprises" ON entreprises;
CREATE POLICY "Users can read entreprises"
  ON entreprises FOR SELECT
  TO authenticated
  USING (
    public.is_platform_super_admin() OR
    user_id = (SELECT auth.uid())
  );

