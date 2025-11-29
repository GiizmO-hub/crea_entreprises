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

-- ✅ CORRECTION 2 : S'assurer que la fonction is_super_admin_check existe
-- Utiliser la même définition que dans les autres migrations
CREATE OR REPLACE FUNCTION public.is_super_admin_check()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Vérifier le rôle dans le JWT (plusieurs emplacements possibles)
  SELECT 
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->'app_metadata'->>'role')::text, '') = 'super_admin'
    OR COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin';
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin_check() TO authenticated;

COMMENT ON POLICY "super_admin_or_owner_or_client_entreprises_select" ON entreprises IS 
'Permet aux super admins, propriétaires et clients de voir les entreprises';

