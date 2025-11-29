/*
  # Créer la table client_contacts pour les clients des clients
  
  Cette migration crée une nouvelle table pour permettre aux clients de l'espace client
  de créer, modifier et supprimer leurs propres clients (contacts).
  
  Cette table est séparée de la table `clients` qui contient les clients de la plateforme
  (créés par les propriétaires d'entreprises).
*/

-- Table pour les clients des clients (contacts dans l'espace client)
-- Supprimer la table si elle existe déjà (pour réappliquer proprement)
DROP TABLE IF EXISTS public.client_contacts CASCADE;

CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  entreprise_id uuid NOT NULL,
  
  -- Informations du contact
  nom text NOT NULL,
  prenom text,
  email text,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  pays text DEFAULT 'France',
  
  -- Informations supplémentaires
  entreprise_nom text,
  siret text,
  notes text,
  statut text DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'archive')),
  
  -- Métadonnées
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Contraintes de clés étrangères
  CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) 
    REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT client_contacts_entreprise_id_fkey FOREIGN KEY (entreprise_id) 
    REFERENCES public.entreprises(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_entreprise_id ON public.client_contacts(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_statut ON public.client_contacts(statut);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON public.client_contacts(email) WHERE email IS NOT NULL;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_client_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_contacts_updated_at();

-- Activer RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- ✅ POLITIQUES RLS POUR client_contacts

-- 1. SELECT : 
--    - Super admin : voit tout
--    - Propriétaire entreprise : voit tous les contacts de ses clients
--    - Client espace : voit UNIQUEMENT ses propres contacts (ceux liés à son client_id)
DROP POLICY IF EXISTS "Users can view client contacts" ON client_contacts;

CREATE POLICY "Users can view client contacts"
  ON client_contacts FOR SELECT
  TO authenticated
  USING (
    -- Super admin plateforme voit tout
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise voit tous les contacts de ses clients
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace voit UNIQUEMENT ses propres contacts
    (
      public.user_is_client()
      AND client_id = public.get_user_client_id()
    )
  );

-- 2. INSERT : 
--    - Super admin : peut créer pour tous les clients
--    - Propriétaire entreprise : peut créer des contacts pour ses clients
--    - Client espace : peut créer des contacts UNIQUEMENT pour lui-même (son client_id)
DROP POLICY IF EXISTS "Users can insert client contacts" ON client_contacts;

CREATE POLICY "Users can insert client contacts"
  ON client_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin plateforme peut créer pour tous les clients
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut créer des contacts pour ses clients
    (
      public.user_owns_entreprise(entreprise_id)
      AND EXISTS (
        SELECT 1 FROM clients
        WHERE id = client_id
        AND entreprise_id = client_contacts.entreprise_id
      )
    )
    OR
    -- Client espace peut créer des contacts UNIQUEMENT pour lui-même
    (
      public.user_is_client()
      AND client_id = public.get_user_client_id()
      AND EXISTS (
        SELECT 1 FROM espaces_membres_clients
        WHERE client_id = client_contacts.client_id
        AND user_id = auth.uid()
        AND actif = true
      )
    )
  );

-- 3. UPDATE :
--    - Super admin : peut modifier tous les contacts
--    - Propriétaire entreprise : peut modifier les contacts de ses clients
--    - Client espace : peut modifier UNIQUEMENT ses propres contacts
DROP POLICY IF EXISTS "Users can update client contacts" ON client_contacts;

CREATE POLICY "Users can update client contacts"
  ON client_contacts FOR UPDATE
  TO authenticated
  USING (
    -- Super admin plateforme peut modifier tous les contacts
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut modifier les contacts de ses clients
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut modifier UNIQUEMENT ses propres contacts
    (
      public.user_is_client()
      AND client_id = public.get_user_client_id()
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
      AND client_id = public.get_user_client_id()
    )
  );

-- 4. DELETE :
--    - Super admin : peut supprimer tous les contacts
--    - Propriétaire entreprise : peut supprimer les contacts de ses clients
--    - Client espace : peut supprimer UNIQUEMENT ses propres contacts
DROP POLICY IF EXISTS "Users can delete client contacts" ON client_contacts;

CREATE POLICY "Users can delete client contacts"
  ON client_contacts FOR DELETE
  TO authenticated
  USING (
    -- Super admin plateforme peut supprimer tous les contacts
    COALESCE((auth.jwt()->>'role')::text, '') = 'super_admin'
    OR 
    -- Propriétaire entreprise peut supprimer les contacts de ses clients
    public.user_owns_entreprise(entreprise_id)
    OR
    -- Client espace peut supprimer UNIQUEMENT ses propres contacts
    (
      public.user_is_client()
      AND client_id = public.get_user_client_id()
    )
  );

-- Commentaires
COMMENT ON TABLE public.client_contacts IS 'Contacts créés par les clients dans leur espace client (séparés des clients de la plateforme)';
COMMENT ON COLUMN public.client_contacts.client_id IS 'ID du client propriétaire de ce contact';
COMMENT ON COLUMN public.client_contacts.entreprise_id IS 'ID de l''entreprise du client propriétaire';

-- ✅ Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Table client_contacts créée avec succès !';
  RAISE NOTICE '   → Les clients peuvent maintenant créer, modifier et supprimer leurs propres contacts';
  RAISE NOTICE '   → Les contacts sont séparés des clients de la plateforme';
END $$;

