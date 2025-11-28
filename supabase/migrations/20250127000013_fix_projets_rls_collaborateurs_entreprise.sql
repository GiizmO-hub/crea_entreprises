/*
  # FIX : Corriger les RLS policies de projets pour utiliser collaborateurs_entreprise
  
  PROBLÈME:
  - Les RLS policies utilisent collaborateurs au lieu de collaborateurs_entreprise
  - Les clients ne peuvent pas voir leurs projets
  - La séparation plateforme/client n'est pas respectée
  
  SOLUTION:
  - Recréer toutes les RLS policies avec collaborateurs_entreprise
  - Ajouter la vérification des espaces membres clients pour les clients
*/

-- 1. Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Utilisateurs voient les projets de leur entreprise" ON projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des projets pour leur entreprise" ON projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les projets de leur entreprise" ON projets;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les projets de leur entreprise" ON projets;

DROP POLICY IF EXISTS "Utilisateurs voient les jalons des projets accessibles" ON projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des jalons pour leurs projets" ON projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les jalons de leurs projets" ON projets_jalons;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les jalons de leurs projets" ON projets_jalons;

DROP POLICY IF EXISTS "Utilisateurs voient les tâches des projets accessibles" ON projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des tâches pour leurs projets" ON projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les tâches de leurs projets" ON projets_taches;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les tâches de leurs projets" ON projets_taches;

DROP POLICY IF EXISTS "Utilisateurs voient les documents des projets accessibles" ON projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent créer des liens projets-documents" ON projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent modifier les liens projets-documents" ON projets_documents;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer les liens projets-documents" ON projets_documents;

-- 2. Fonction helper pour vérifier l'accès à un projet
CREATE OR REPLACE FUNCTION can_access_projet(p_projet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise_id uuid;
  v_is_super_admin boolean;
  v_is_client boolean;
BEGIN
  -- Récupérer l'entreprise du projet
  SELECT entreprise_id INTO v_entreprise_id
  FROM projets
  WHERE id = p_projet_id;
  
  IF v_entreprise_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Vérifier si c'est un super_admin plateforme
  SELECT EXISTS (
    SELECT 1 FROM utilisateurs
    WHERE id = auth.uid()
    AND role = 'super_admin'
  ) INTO v_is_super_admin;
  
  IF v_is_super_admin THEN
    RETURN true; -- Super admin voit tout
  END IF;
  
  -- Vérifier si c'est un client (a un espace membre pour cette entreprise)
  SELECT EXISTS (
    SELECT 1 FROM espaces_membres_clients
    WHERE user_id = auth.uid()
    AND entreprise_id = v_entreprise_id
    AND actif = true
  ) INTO v_is_client;
  
  IF v_is_client THEN
    RETURN true; -- Client voit les projets de son entreprise
  END IF;
  
  -- Vérifier si c'est le propriétaire de l'entreprise
  IF EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = v_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Vérifier si c'est un collaborateur de l'entreprise (si la table existe)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'collaborateurs_entreprise'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM collaborateurs_entreprise
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

-- 3. RLS pour projets
CREATE POLICY "Accès projets selon rôle"
  ON projets FOR SELECT
  TO authenticated
  USING (can_access_projet(id));

CREATE POLICY "Création projets selon rôle"
  ON projets FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Super admin peut créer pour n'importe quelle entreprise
    EXISTS (
      SELECT 1 FROM utilisateurs
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
    OR
    -- Client peut créer pour son entreprise
    EXISTS (
      SELECT 1 FROM espaces_membres_clients
      WHERE user_id = auth.uid()
      AND entreprise_id = projets.entreprise_id
      AND actif = true
    )
    OR
    -- Propriétaire peut créer pour ses entreprises
    EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = projets.entreprise_id
      AND user_id = auth.uid()
    )
    OR
    -- Collaborateur peut créer pour son entreprise (si la table existe)
    (EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'collaborateurs_entreprise'
    ) AND EXISTS (
      SELECT 1 FROM collaborateurs_entreprise
      WHERE entreprise_id = projets.entreprise_id
      AND user_id = auth.uid()
      AND actif = true
      AND (peut_modifier_donnees = true OR role IN ('admin', 'manager', 'gérant'))
    ))
  );

CREATE POLICY "Modification projets selon rôle"
  ON projets FOR UPDATE
  TO authenticated
  USING (can_access_projet(id))
  WITH CHECK (can_access_projet(id));

CREATE POLICY "Suppression projets selon rôle"
  ON projets FOR DELETE
  TO authenticated
  USING (can_access_projet(id));

-- 4. RLS pour projets_jalons
CREATE POLICY "Accès jalons selon projets"
  ON projets_jalons FOR SELECT
  TO authenticated
  USING (can_access_projet(projet_id));

CREATE POLICY "Création jalons selon projets"
  ON projets_jalons FOR INSERT
  TO authenticated
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Modification jalons selon projets"
  ON projets_jalons FOR UPDATE
  TO authenticated
  USING (can_access_projet(projet_id))
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Suppression jalons selon projets"
  ON projets_jalons FOR DELETE
  TO authenticated
  USING (can_access_projet(projet_id));

-- 5. RLS pour projets_taches
CREATE POLICY "Accès tâches selon projets"
  ON projets_taches FOR SELECT
  TO authenticated
  USING (can_access_projet(projet_id));

CREATE POLICY "Création tâches selon projets"
  ON projets_taches FOR INSERT
  TO authenticated
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Modification tâches selon projets"
  ON projets_taches FOR UPDATE
  TO authenticated
  USING (can_access_projet(projet_id))
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Suppression tâches selon projets"
  ON projets_taches FOR DELETE
  TO authenticated
  USING (can_access_projet(projet_id));

-- 6. RLS pour projets_documents
CREATE POLICY "Accès documents projets selon projets"
  ON projets_documents FOR SELECT
  TO authenticated
  USING (can_access_projet(projet_id));

CREATE POLICY "Création documents projets selon projets"
  ON projets_documents FOR INSERT
  TO authenticated
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Modification documents projets selon projets"
  ON projets_documents FOR UPDATE
  TO authenticated
  USING (can_access_projet(projet_id))
  WITH CHECK (can_access_projet(projet_id));

CREATE POLICY "Suppression documents projets selon projets"
  ON projets_documents FOR DELETE
  TO authenticated
  USING (can_access_projet(projet_id));

SELECT '✅ RLS policies corrigées pour utiliser collaborateurs_entreprise et espaces_membres_clients !' as resultat;

