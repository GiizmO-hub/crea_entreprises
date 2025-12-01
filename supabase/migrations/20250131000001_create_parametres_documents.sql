/*
  # CRÉATION DE LA TABLE PARAMETRES_DOCUMENTS
  
  OBJECTIF:
  Permettre aux entreprises (plateforme et clients) de configurer les en-têtes
  de leurs factures, devis, et autres documents PDF.
  
  STRUCTURE:
  - Une ligne par entreprise
  - Configuration personnalisable pour logos, couleurs, polices, mentions légales
*/

-- ============================================================================
-- CRÉATION DE LA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parametres_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid REFERENCES public.entreprises(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Logo
  logo_url text,
  logo_position text DEFAULT 'left' CHECK (logo_position IN ('left', 'right', 'center', 'none')),
  logo_size integer DEFAULT 40, -- Taille en pixels
  
  -- Informations entreprise à afficher
  show_entreprise_nom boolean DEFAULT true,
  show_entreprise_adresse boolean DEFAULT true,
  show_entreprise_contact boolean DEFAULT true,
  show_entreprise_siret boolean DEFAULT true,
  
  -- Couleurs
  primary_color text DEFAULT '#3b82f6', -- Blue-500 par défaut
  secondary_color text DEFAULT '#6b7280', -- Gray-500 par défaut
  text_color text DEFAULT '#1f2937', -- Gray-800 par défaut
  
  -- Typographie
  header_font text DEFAULT 'helvetica' CHECK (header_font IN ('helvetica', 'times', 'courier')),
  header_font_size integer DEFAULT 24,
  body_font text DEFAULT 'helvetica' CHECK (body_font IN ('helvetica', 'times', 'courier')),
  body_font_size integer DEFAULT 10,
  
  -- Mentions légales / Pied de page
  footer_text text,
  capital_social text,
  rcs text,
  tva_intracommunautaire text,
  
  -- Métadonnées
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_parametres_documents_entreprise_id 
  ON public.parametres_documents(entreprise_id);

-- ============================================================================
-- TRIGGER POUR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_parametres_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_parametres_documents_updated_at_trigger 
  ON public.parametres_documents;

CREATE TRIGGER update_parametres_documents_updated_at_trigger
  BEFORE UPDATE ON public.parametres_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_parametres_documents_updated_at();

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE public.parametres_documents ENABLE ROW LEVEL SECURITY;

-- Policy pour SELECT : Les utilisateurs authentifiés peuvent voir les paramètres de leurs entreprises
CREATE POLICY "Authenticated users can view their document parameters"
  ON public.parametres_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.entreprises
      WHERE entreprises.id = parametres_documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.espaces_membres_clients emc
      JOIN public.entreprises e ON e.id = emc.entreprise_id
      WHERE emc.entreprise_id = parametres_documents.entreprise_id
      AND emc.user_id = auth.uid()
      AND emc.actif = true
    )
  );

-- Policy pour INSERT : Les utilisateurs authentifiés peuvent créer des paramètres pour leurs entreprises
CREATE POLICY "Authenticated users can insert their document parameters"
  ON public.parametres_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.entreprises
      WHERE entreprises.id = parametres_documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.espaces_membres_clients emc
      JOIN public.entreprises e ON e.id = emc.entreprise_id
      WHERE emc.entreprise_id = parametres_documents.entreprise_id
      AND emc.user_id = auth.uid()
      AND emc.actif = true
    )
  );

-- Policy pour UPDATE : Les utilisateurs authentifiés peuvent modifier les paramètres de leurs entreprises
CREATE POLICY "Authenticated users can update their document parameters"
  ON public.parametres_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.entreprises
      WHERE entreprises.id = parametres_documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.espaces_membres_clients emc
      JOIN public.entreprises e ON e.id = emc.entreprise_id
      WHERE emc.entreprise_id = parametres_documents.entreprise_id
      AND emc.user_id = auth.uid()
      AND emc.actif = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.entreprises
      WHERE entreprises.id = parametres_documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.espaces_membres_clients emc
      JOIN public.entreprises e ON e.id = emc.entreprise_id
      WHERE emc.entreprise_id = parametres_documents.entreprise_id
      AND emc.user_id = auth.uid()
      AND emc.actif = true
    )
  );

-- Policy pour DELETE : Les utilisateurs authentifiés peuvent supprimer les paramètres de leurs entreprises
CREATE POLICY "Authenticated users can delete their document parameters"
  ON public.parametres_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.entreprises
      WHERE entreprises.id = parametres_documents.entreprise_id
      AND entreprises.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.espaces_membres_clients emc
      JOIN public.entreprises e ON e.id = emc.entreprise_id
      WHERE emc.entreprise_id = parametres_documents.entreprise_id
      AND emc.user_id = auth.uid()
      AND emc.actif = true
    )
  );

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE public.parametres_documents IS 
  'Configuration des en-têtes et styles pour les documents PDF (factures, devis, avoirs)';

COMMENT ON COLUMN public.parametres_documents.logo_position IS 
  'Position du logo : left, right, center, ou none';

COMMENT ON COLUMN public.parametres_documents.primary_color IS 
  'Couleur principale (format hex: #3b82f6)';

COMMENT ON COLUMN public.parametres_documents.secondary_color IS 
  'Couleur secondaire (format hex: #6b7280)';

COMMENT ON COLUMN public.parametres_documents.text_color IS 
  'Couleur du texte (format hex: #1f2937)';
