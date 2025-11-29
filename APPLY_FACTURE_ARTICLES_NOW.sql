-- Application manuelle de la migration facture_articles
/*
  # Table des articles de facturation avec codes
  
  Permet de créer des articles avec des codes (ex: MO1, APP, etc.)
  et de les retrouver rapidement lors de la création de factures
*/

-- Table des articles de facturation
CREATE TABLE IF NOT EXISTS facture_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  code text NOT NULL, -- Code unique de l'article (ex: MO1, APP, etc.)
  libelle text NOT NULL, -- Libellé/description de l'article
  prix_unitaire_ht numeric(12, 2) NOT NULL DEFAULT 0,
  taux_tva numeric(5, 2) NOT NULL DEFAULT 20,
  unite text DEFAULT 'unité', -- Unité de mesure (unité, heure, jour, etc.)
  actif boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, code)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_facture_articles_entreprise_id ON facture_articles(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_facture_articles_code ON facture_articles(code);
CREATE INDEX IF NOT EXISTS idx_facture_articles_actif ON facture_articles(actif);
CREATE INDEX IF NOT EXISTS idx_facture_articles_libelle ON facture_articles USING gin(to_tsvector('french', libelle));

-- RLS Policies
ALTER TABLE facture_articles ENABLE ROW LEVEL SECURITY;

-- SELECT: Super admin, propriétaire entreprise, ou client avec espace membre
CREATE POLICY "facture_articles_select" ON facture_articles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid() AND actif = true)
);

-- INSERT: Propriétaire entreprise ou client avec espace membre
CREATE POLICY "facture_articles_insert" ON facture_articles FOR INSERT TO authenticated WITH CHECK (
  entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid() AND actif = true)
);

-- UPDATE: Super admin, propriétaire entreprise, ou client avec espace membre
CREATE POLICY "facture_articles_update" ON facture_articles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid() AND actif = true)
) WITH CHECK (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid() AND actif = true)
);

-- DELETE: Super admin, propriétaire entreprise, ou client avec espace membre
CREATE POLICY "facture_articles_delete" ON facture_articles FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid() AND actif = true)
);

-- Fonction pour rechercher des articles par code ou libellé
CREATE OR REPLACE FUNCTION search_facture_articles(
  p_entreprise_id uuid,
  p_search_term text
) RETURNS TABLE (
  id uuid,
  code text,
  libelle text,
  prix_unitaire_ht numeric,
  taux_tva numeric,
  unite text,
  actif boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.id,
    fa.code,
    fa.libelle,
    fa.prix_unitaire_ht,
    fa.taux_tva,
    fa.unite,
    fa.actif
  FROM facture_articles fa
  WHERE fa.entreprise_id = p_entreprise_id
    AND fa.actif = true
    AND (
      fa.code ILIKE '%' || p_search_term || '%'
      OR fa.libelle ILIKE '%' || p_search_term || '%'
    )
  ORDER BY 
    CASE 
      WHEN fa.code = p_search_term THEN 1
      WHEN fa.code ILIKE p_search_term || '%' THEN 2
      WHEN fa.libelle ILIKE p_search_term || '%' THEN 3
      ELSE 4
    END,
    fa.code
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

