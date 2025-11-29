/*
  # Fix RLS Clients - Permettre création depuis espace client
  
  ⚠️ IMPORTANT: Appliquez ce fichier dans Supabase SQL Editor
  
  Cette migration corrige les politiques RLS pour permettre aux utilisateurs
  de l'espace client de créer des clients pour leur entreprise.
*/

-- Fonction helper pour vérifier si l'utilisateur a accès à l'entreprise (propriétaire ou super_admin)
-- Utiliser le même nom de paramètre que la fonction existante (entreprise_uuid)
CREATE OR REPLACE FUNCTION public.user_owns_entreprise(entreprise_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admin plateforme
  IF COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Propriétaire de l'entreprise
  IF EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = entreprise_uuid
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Fonction helper pour vérifier si l'utilisateur est un client (espace membre)
CREATE OR REPLACE FUNCTION public.user_is_client()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier si l'utilisateur a un espace membre client actif
  RETURN EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = auth.uid()
    AND actif = true
  );
END;
$$;

-- Fonction helper pour obtenir le client_id de l'utilisateur (s'il est client)
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id
  FROM espaces_membres_clients
  WHERE user_id = auth.uid()
    AND actif = true
  LIMIT 1;
  
  RETURN v_client_id;
END;
$$;

-- ✅ Mettre à jour les politiques RLS pour les clients

-- 1. SELECT : 
--    - Super admin : voit tout
--    - Propriétaire entreprise : voit tous les clients de son entreprise
--    - Client espace : voit UNIQUEMENT son propre client (celui lié à son espace_membre_client)
DROP POLICY IF EXISTS "super_admin_all_access_clients" ON clients;
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can see all clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut voir clients" ON clients;

CREATE POLICY "Users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise voit tous les clients de son entreprise
    public.user_owns_entreprise(clients.entreprise_id)
    OR
    -- Client espace voit UNIQUEMENT son propre client
    (
      public.user_is_client()
      AND id = public.get_user_client_id()
    )
  );

-- 2. INSERT : 
--    - Super admin : peut créer pour toutes les entreprises
--    - Propriétaire entreprise : peut créer des clients pour son entreprise
--    - Client espace : NE PEUT PAS créer de clients (seul le propriétaire peut)
DROP POLICY IF EXISTS "Users can insert clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can create clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut créer clients" ON clients;

CREATE POLICY "Users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour toutes les entreprises
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut créer des clients pour son entreprise
    public.user_owns_entreprise(clients.entreprise_id)
    -- Les clients de l'espace client NE PEUVENT PAS créer de clients
  );

-- 3. UPDATE :
--    - Super admin : peut modifier tous les clients
--    - Propriétaire entreprise : peut modifier les clients de son entreprise
--    - Client espace : peut modifier UNIQUEMENT son propre client
DROP POLICY IF EXISTS "Users can update clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can update clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut modifier clients" ON clients;

CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    -- Super admin plateforme peut modifier tous les clients
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut modifier les clients de son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut modifier UNIQUEMENT son propre client
    (
      public.user_is_client()
      AND id = public.get_user_client_id()
    )
  )
  WITH CHECK (
    -- Super admin plateforme peut modifier tous les clients
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut modifier les clients de son entreprise
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut modifier UNIQUEMENT son propre client
    (
      public.user_is_client()
      AND id = public.get_user_client_id()
    )
  );

-- 4. DELETE :
--    - Super admin : peut supprimer tous les clients
--    - Propriétaire entreprise : peut supprimer les clients de son entreprise
--    - Client espace : NE PEUT PAS supprimer de clients
DROP POLICY IF EXISTS "Users can delete clients" ON clients;
DROP POLICY IF EXISTS "Platform super_admin can delete clients" ON clients;
DROP POLICY IF EXISTS "Super admin ou propriétaire entreprise peut supprimer clients" ON clients;

CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    -- Super admin plateforme peut supprimer tous les clients
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut supprimer les clients de son entreprise
    public.user_owns_entreprise(entreprise_id)
    -- Les clients de l'espace client NE PEUVENT PAS supprimer de clients
  );

-- Commentaires
COMMENT ON FUNCTION public.user_owns_entreprise IS 'Vérifie si l''utilisateur est super_admin ou propriétaire de l''entreprise';
COMMENT ON FUNCTION public.user_is_client IS 'Vérifie si l''utilisateur est un client (a un espace membre client actif)';
COMMENT ON FUNCTION public.get_user_client_id IS 'Retourne le client_id de l''utilisateur s''il est un client';

