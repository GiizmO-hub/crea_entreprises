/*
  # FIX COMPLET : Gestion de Projets - Séparation Plateforme/Client
  
  Cette migration corrige complètement le module Gestion de Projets pour :
  1. Créer la table collaborateurs_entreprise si elle n'existe pas
  2. Corriger les foreign keys dans projets
  3. Corriger les RLS policies pour séparer plateforme et clients
*/

-- ============================================================
-- ÉTAPE 1 : Créer la table collaborateurs_entreprise
-- ============================================================

-- Vérifier si la table existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    -- Créer la table
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
    
    -- RLS Policies
    CREATE POLICY "Accès collaborateurs entreprise"
      ON public.collaborateurs_entreprise FOR SELECT TO authenticated
      USING (
        entreprise_id IN (SELECT id FROM public.entreprises WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    CREATE POLICY "Création collaborateurs entreprise"
      ON public.collaborateurs_entreprise FOR INSERT TO authenticated
      WITH CHECK (
        entreprise_id IN (SELECT id FROM public.entreprises WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    CREATE POLICY "Modification collaborateurs entreprise"
      ON public.collaborateurs_entreprise FOR UPDATE TO authenticated
      USING (
        entreprise_id IN (SELECT id FROM public.entreprises WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    CREATE POLICY "Suppression collaborateurs entreprise"
      ON public.collaborateurs_entreprise FOR DELETE TO authenticated
      USING (
        entreprise_id IN (SELECT id FROM public.entreprises WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.espaces_membres_clients
          WHERE user_id = auth.uid()
          AND entreprise_id = public.collaborateurs_entreprise.entreprise_id
          AND actif = true
        )
        OR EXISTS (
          SELECT 1 FROM public.utilisateurs
          WHERE id = auth.uid()
          AND role = 'super_admin'
        )
      );
    
    RAISE NOTICE '✅ Table collaborateurs_entreprise créée !';
  ELSE
    RAISE NOTICE '✅ Table collaborateurs_entreprise existe déjà';
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 2 : Corriger les foreign keys dans projets
-- ============================================================

-- Supprimer les anciennes contraintes
ALTER TABLE public.projets DROP CONSTRAINT IF EXISTS projets_responsable_id_fkey;
ALTER TABLE public.projets_taches DROP CONSTRAINT IF EXISTS projets_taches_collaborateur_id_fkey;

-- Recréer avec collaborateurs_entreprise (si la table existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    ALTER TABLE public.projets
    ADD CONSTRAINT projets_responsable_id_fkey 
    FOREIGN KEY (responsable_id) 
    REFERENCES public.collaborateurs_entreprise(id) 
    ON DELETE SET NULL;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = 'projets_taches'
    ) THEN
      ALTER TABLE public.projets_taches
      ADD CONSTRAINT projets_taches_collaborateur_id_fkey 
      FOREIGN KEY (collaborateur_id) 
      REFERENCES public.collaborateurs_entreprise(id) 
      ON DELETE SET NULL;
    END IF;
    
    RAISE NOTICE '✅ Foreign keys corrigées avec collaborateurs_entreprise !';
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 3 : Corriger les RLS policies pour projets
-- ============================================================

-- Fonction helper pour vérifier l'accès à un projet
CREATE OR REPLACE FUNCTION public.can_access_projet(p_projet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise_id uuid;
BEGIN
  -- Récupérer l'entreprise du projet
  SELECT entreprise_id INTO v_entreprise_id
  FROM public.projets
  WHERE id = p_projet_id;
  
  IF v_entreprise_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Super admin plateforme voit tout
  IF EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;
  
  -- Client voit les projets de son entreprise
  IF EXISTS (
    SELECT 1 FROM public.espaces_membres_clients
    WHERE user_id = auth.uid()
    AND entreprise_id = v_entreprise_id
    AND actif = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Propriétaire voit ses projets
  IF EXISTS (
    SELECT 1 FROM public.entreprises
    WHERE id = v_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Collaborateur voit les projets de son entreprise
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'collaborateurs_entreprise'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.collaborateurs_entreprise
      WHERE entreprise_id = v_entreprise_id
      AND user_id = auth.uid()
      AND actif = true
    ) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Utilisateurs voient les projets de leur entreprise" ON public.projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des projets pour leur entreprise" ON public.projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les projets de leur entreprise" ON public.projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les projets de leur entreprise" ON public.projets;

DROP POLICY IF EXISTS "Utilisateurs voient les jalons des projets accessibles" ON public.projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des jalons pour leurs projets" ON public.projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les jalons de leurs projets" ON public.projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les jalons de leurs projets" ON public.projets_jalons;

DROP POLICY IF EXISTS "Utilisateurs voient les tâches des projets accessibles" ON public.projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des tâches pour leurs projets" ON public.projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les tâches de leurs projets" ON public.projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les tâches de leurs projets" ON public.projets_taches;

DROP POLICY IF EXISTS "Utilisateurs voient les documents des projets accessibles" ON public.projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des liens projets-documents" ON public.projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les liens projets-documents" ON public.projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les liens projets-documents" ON public.projets_documents;

-- Recréer les policies avec la fonction helper
CREATE POLICY "Accès projets selon rôle"
  ON public.projets FOR SELECT TO authenticated
  USING (public.can_access_projet(id));

CREATE POLICY "Création projets selon rôle"
  ON public.projets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.espaces_membres_clients
      WHERE user_id = auth.uid()
      AND entreprise_id = public.projets.entreprise_id
      AND actif = true
    )
    OR EXISTS (
      SELECT 1 FROM public.entreprises
      WHERE id = public.projets.entreprise_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Modification projets selon rôle"
  ON public.projets FOR UPDATE TO authenticated
  USING (public.can_access_projet(id))
  WITH CHECK (public.can_access_projet(id));

CREATE POLICY "Suppression projets selon rôle"
  ON public.projets FOR DELETE TO authenticated
  USING (public.can_access_projet(id));

-- Policies pour projets_jalons
CREATE POLICY "Accès jalons selon projets"
  ON public.projets_jalons FOR SELECT TO authenticated
  USING (public.can_access_projet(projet_id));

CREATE POLICY "Création jalons selon projets"
  ON public.projets_jalons FOR INSERT TO authenticated
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Modification jalons selon projets"
  ON public.projets_jalons FOR UPDATE TO authenticated
  USING (public.can_access_projet(projet_id))
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Suppression jalons selon projets"
  ON public.projets_jalons FOR DELETE TO authenticated
  USING (public.can_access_projet(projet_id));

-- Policies pour projets_taches
CREATE POLICY "Accès tâches selon projets"
  ON public.projets_taches FOR SELECT TO authenticated
  USING (public.can_access_projet(projet_id));

CREATE POLICY "Création tâches selon projets"
  ON public.projets_taches FOR INSERT TO authenticated
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Modification tâches selon projets"
  ON public.projets_taches FOR UPDATE TO authenticated
  USING (public.can_access_projet(projet_id))
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Suppression tâches selon projets"
  ON public.projets_taches FOR DELETE TO authenticated
  USING (public.can_access_projet(projet_id));

-- Policies pour projets_documents
CREATE POLICY "Accès documents projets selon projets"
  ON public.projets_documents FOR SELECT TO authenticated
  USING (public.can_access_projet(projet_id));

CREATE POLICY "Création documents projets selon projets"
  ON public.projets_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Modification documents projets selon projets"
  ON public.projets_documents FOR UPDATE TO authenticated
  USING (public.can_access_projet(projet_id))
  WITH CHECK (public.can_access_projet(projet_id));

CREATE POLICY "Suppression documents projets selon projets"
  ON public.projets_documents FOR DELETE TO authenticated
  USING (public.can_access_projet(projet_id));

SELECT '✅ Correction complète Gestion de Projets appliquée !' as resultat;

