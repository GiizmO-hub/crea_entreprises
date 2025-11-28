/*
  # S'assurer que la table collaborateurs_entreprise existe
  
  Cette migration vérifie si collaborateurs_entreprise existe,
  sinon elle la crée avec la bonne structure.
*/

-- Vérifier si la table existe et la créer si nécessaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    RAISE NOTICE '📋 Création de la table collaborateurs_entreprise...';
    
    -- Créer la table collaborateurs_entreprise
    CREATE TABLE public.collaborateurs_entreprise (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entreprise_id uuid REFERENCES public.entreprises(id) ON DELETE CASCADE NOT NULL,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      email text NOT NULL,
      nom text NOT NULL,
      prenom text NOT NULL,
      role text NOT NULL,
      telephone text,
      actif boolean DEFAULT true NOT NULL,
      peut_consulter_finances boolean DEFAULT false NOT NULL,
      peut_modifier_donnees boolean DEFAULT false NOT NULL,
      peut_creer_factures boolean DEFAULT false NOT NULL,
      peut_voir_salaries boolean DEFAULT false NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      UNIQUE(entreprise_id, email)
    );
    
    -- Index
    CREATE INDEX idx_collaborateurs_entreprise_entreprise ON public.collaborateurs_entreprise(entreprise_id);
    CREATE INDEX idx_collaborateurs_entreprise_user ON public.collaborateurs_entreprise(user_id);
    CREATE INDEX idx_collaborateurs_entreprise_actif ON public.collaborateurs_entreprise(actif);
    
    -- Trigger pour updated_at
    CREATE OR REPLACE FUNCTION public.update_collaborateurs_entreprise_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    
    CREATE TRIGGER update_collaborateurs_entreprise_updated_at_trigger
      BEFORE UPDATE ON public.collaborateurs_entreprise
      FOR EACH ROW
      EXECUTE FUNCTION public.update_collaborateurs_entreprise_updated_at();
    
    -- Activer RLS
    ALTER TABLE public.collaborateurs_entreprise ENABLE ROW LEVEL SECURITY;
    
    -- Policy SELECT : Les propriétaires d'entreprise et clients peuvent voir leurs collaborateurs
    CREATE POLICY "Accès collaborateurs entreprise"
      ON public.collaborateurs_entreprise
      FOR SELECT
      TO authenticated
      USING (
        -- Propriétaire de l'entreprise
        entreprise_id IN (
          SELECT id FROM public.entreprises WHERE user_id = auth.uid()
        )
        OR
        -- Client via espace membre
        EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR
        -- Super admin plateforme
        EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    -- Policy INSERT
    CREATE POLICY "Création collaborateurs entreprise"
      ON public.collaborateurs_entreprise
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- Propriétaire de l'entreprise
        entreprise_id IN (
          SELECT id FROM public.entreprises WHERE user_id = auth.uid()
        )
        OR
        -- Client via espace membre
        EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR
        -- Super admin plateforme
        EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    -- Policy UPDATE
    CREATE POLICY "Modification collaborateurs entreprise"
      ON public.collaborateurs_entreprise
      FOR UPDATE
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM public.entreprises WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR
        EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      )
      WITH CHECK (
        entreprise_id IN (
          SELECT id FROM public.entreprises WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR
        EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    -- Policy DELETE
    CREATE POLICY "Suppression collaborateurs entreprise"
      ON public.collaborateurs_entreprise
      FOR DELETE
      TO authenticated
      USING (
        entreprise_id IN (
          SELECT id FROM public.entreprises WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR
        EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    RAISE NOTICE '✅ Table collaborateurs_entreprise créée avec succès !';
  ELSE
    RAISE NOTICE '✅ La table collaborateurs_entreprise existe déjà';
  END IF;
END $$;

SELECT '✅ Vérification de la table collaborateurs_entreprise terminée !' as resultat;
