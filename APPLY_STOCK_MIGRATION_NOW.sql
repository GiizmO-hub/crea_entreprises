/*
  ============================================================================
  APPLICATION AUTOMATIQUE - MODULE GESTION DE STOCK
  ============================================================================
  
  Migration: 20250130000010_create_gestion_stock_module.sql
  Date: 2025-01-30
  
  Instructions:
    1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
    2. Copiez TOUT ce fichier (Cmd+A, Cmd+C)
    3. Collez dans l'éditeur SQL (Cmd+V)
    4. Cliquez sur "Run" ou "Exécuter"
    5. Attendez 10-20 secondes
    6. ✅ C'est terminé !
  
  ============================================================================
*/

/*
  # Module Gestion de Stock Générique
  
  Ce module permet de gérer le stock de manière générique pour tous les secteurs :
  - Catalogue de produits/articles
  - Gestion des stocks (quantités, emplacements)
  - Mouvements de stock (entrées, sorties, transferts)
  - Inventaire et ajustements
  - Alertes de stock faible
  - Historique des mouvements
  
  RÉUTILISE :
  - Documents (optionnel, pour stocker les fiches produits)
  - Factures (optionnel, pour lier les sorties aux factures)
*/

-- 1. Supprimer les tables si elles existent déjà (pour permettre la recréation)
DROP TABLE IF EXISTS stock_mouvements CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS stock_categories CASCADE;

-- 2. Table des catégories de produits
CREATE TABLE stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  description text,
  couleur text DEFAULT '#3B82F6',
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, nom)
);

-- Index pour catégories
CREATE INDEX IF NOT EXISTS idx_stock_categories_entreprise_id ON stock_categories(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_categories_ordre ON stock_categories(ordre);

-- 3. Table des articles/produits en stock
CREATE TABLE stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  categorie_id uuid REFERENCES stock_categories(id) ON DELETE SET NULL,
  reference text NOT NULL, -- Référence unique du produit
  nom text NOT NULL,
  description text,
  unite_mesure text DEFAULT 'unité' CHECK (unite_mesure IN ('unité', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'm²', 'm³', 'lot', 'paquet')),
  quantite_stock numeric(12, 3) DEFAULT 0, -- Quantité en stock (décimal pour kg, L, etc.)
  quantite_minimale numeric(12, 3) DEFAULT 0, -- Seuil d'alerte
  quantite_maximale numeric(12, 3), -- Stock maximum (optionnel)
  prix_achat_unitaire numeric(12, 2) DEFAULT 0, -- Prix d'achat moyen
  prix_vente_unitaire numeric(12, 2) DEFAULT 0, -- Prix de vente (si applicable)
  emplacement text, -- Emplacement physique (rayon, étagère, etc.)
  fournisseur text, -- Nom du fournisseur principal
  date_peremption date, -- Date de péremption (si applicable)
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'epuise', 'rupture')),
  tags text[], -- Tags pour recherche/filtrage
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, reference)
);

-- Index pour stock_items
CREATE INDEX IF NOT EXISTS idx_stock_items_entreprise_id ON stock_items(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_categorie_id ON stock_items(categorie_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_reference ON stock_items(reference);
CREATE INDEX IF NOT EXISTS idx_stock_items_nom ON stock_items(nom);
CREATE INDEX IF NOT EXISTS idx_stock_items_statut ON stock_items(statut);
CREATE INDEX IF NOT EXISTS idx_stock_items_quantite_stock ON stock_items(quantite_stock);
CREATE INDEX IF NOT EXISTS idx_stock_items_date_peremption ON stock_items(date_peremption);

-- 4. Table des mouvements de stock
CREATE TABLE stock_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type_mouvement text NOT NULL CHECK (type_mouvement IN (
    'entree',      -- Entrée de stock (achat, réception)
    'sortie',      -- Sortie de stock (vente, utilisation)
    'transfert',   -- Transfert entre emplacements
    'inventaire',  -- Ajustement d'inventaire
    'perte',       -- Perte, casse, vol
    'retour'       -- Retour client/fournisseur
  )),
  quantite numeric(12, 3) NOT NULL, -- Quantité du mouvement (positive pour entrée, négative pour sortie)
  quantite_avant numeric(12, 3) NOT NULL, -- Quantité avant le mouvement
  quantite_apres numeric(12, 3) NOT NULL, -- Quantité après le mouvement
  motif text, -- Motif du mouvement
  reference_externe text, -- Référence facture, commande, etc.
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL, -- Lien vers facture si sortie liée
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL, -- Client si sortie pour vente
  emplacement_source text, -- Emplacement source (pour transfert)
  emplacement_destination text, -- Emplacement destination (pour transfert)
  cout_unitaire numeric(12, 2), -- Coût unitaire du mouvement
  cout_total numeric(12, 2), -- Coût total (quantité * coût_unitaire)
  date_mouvement date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  notes text
);

-- Index pour stock_mouvements
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_entreprise_id ON stock_mouvements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_stock_item_id ON stock_mouvements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_type ON stock_mouvements(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_date ON stock_mouvements(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_facture_id ON stock_mouvements(facture_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_client_id ON stock_mouvements(client_id);

-- 5. Trigger pour mettre à jour automatiquement la quantité en stock
CREATE OR REPLACE FUNCTION update_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour la quantité en stock de l'article
  UPDATE stock_items
  SET 
    quantite_stock = NEW.quantite_apres,
    statut = CASE
      WHEN NEW.quantite_apres <= 0 THEN 'epuise'
      WHEN NEW.quantite_apres <= (SELECT quantite_minimale FROM stock_items WHERE id = NEW.stock_item_id) THEN 'rupture'
      ELSE 'actif'
    END,
    updated_at = now()
  WHERE id = NEW.stock_item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_quantity
  AFTER INSERT ON stock_mouvements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_quantity();

-- 6. Fonction pour créer un mouvement de stock
CREATE OR REPLACE FUNCTION create_stock_mouvement(
  p_entreprise_id uuid,
  p_stock_item_id uuid,
  p_type_mouvement text,
  p_quantite numeric,
  p_motif text DEFAULT NULL,
  p_reference_externe text DEFAULT NULL,
  p_facture_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_emplacement_source text DEFAULT NULL,
  p_emplacement_destination text DEFAULT NULL,
  p_cout_unitaire numeric DEFAULT NULL,
  p_date_mouvement date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_item RECORD;
  v_quantite_avant numeric;
  v_quantite_apres numeric;
  v_quantite_absolue numeric;
  v_cout_total numeric;
  v_mouvement_id uuid;
BEGIN
  -- Récupérer l'article
  SELECT * INTO v_item
  FROM stock_items
  WHERE id = p_stock_item_id AND entreprise_id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Article non trouvé'
    );
  END IF;
  
  v_quantite_avant := v_item.quantite_stock;
  v_quantite_absolue := ABS(p_quantite);
  
  -- Calculer la quantité après selon le type de mouvement
  CASE p_type_mouvement
    WHEN 'entree', 'retour' THEN
      v_quantite_apres := v_quantite_avant + v_quantite_absolue;
    WHEN 'sortie', 'perte' THEN
      v_quantite_apres := v_quantite_avant - v_quantite_absolue;
      IF v_quantite_apres < 0 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Stock insuffisant. Stock actuel: ' || v_quantite_avant
        );
      END IF;
    WHEN 'inventaire' THEN
      v_quantite_apres := p_quantite; -- Pour inventaire, la quantité est la nouvelle valeur
    WHEN 'transfert' THEN
      -- Pour transfert, on fait une sortie source et entrée destination
      v_quantite_apres := v_quantite_avant - v_quantite_absolue;
      IF v_quantite_apres < 0 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Stock insuffisant pour transfert. Stock actuel: ' || v_quantite_avant
        );
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Type de mouvement invalide'
      );
  END CASE;
  
  -- Calculer le coût total
  IF p_cout_unitaire IS NOT NULL THEN
    v_cout_total := v_quantite_absolue * p_cout_unitaire;
  ELSE
    v_cout_total := NULL;
  END IF;
  
  -- Créer le mouvement
  INSERT INTO stock_mouvements (
    entreprise_id,
    stock_item_id,
    type_mouvement,
    quantite,
    quantite_avant,
    quantite_apres,
    motif,
    reference_externe,
    facture_id,
    client_id,
    emplacement_source,
    emplacement_destination,
    cout_unitaire,
    cout_total,
    date_mouvement,
    notes,
    created_by
  ) VALUES (
    p_entreprise_id,
    p_stock_item_id,
    p_type_mouvement,
    CASE 
      WHEN p_type_mouvement IN ('sortie', 'perte', 'transfert') THEN -v_quantite_absolue
      ELSE v_quantite_absolue
    END,
    v_quantite_avant,
    v_quantite_apres,
    p_motif,
    p_reference_externe,
    p_facture_id,
    p_client_id,
    p_emplacement_source,
    p_emplacement_destination,
    p_cout_unitaire,
    v_cout_total,
    p_date_mouvement,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_mouvement_id;
  
  -- Si c'est un transfert, créer aussi l'entrée à destination
  IF p_type_mouvement = 'transfert' AND p_emplacement_destination IS NOT NULL THEN
    -- Note: Pour simplifier, on crée juste le mouvement de sortie
    -- L'entrée à destination devra être créée séparément si nécessaire
    -- (ou créer une fonction spécifique pour les transferts)
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'mouvement_id', v_mouvement_id,
    'quantite_avant', v_quantite_avant,
    'quantite_apres', v_quantite_apres
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonction pour obtenir les alertes de stock faible
CREATE OR REPLACE FUNCTION get_stock_alertes(
  p_entreprise_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_alertes jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'reference', reference,
      'nom', nom,
      'quantite_stock', quantite_stock,
      'quantite_minimale', quantite_minimale,
      'unite_mesure', unite_mesure,
      'statut', statut
    )
  )
  INTO v_alertes
  FROM stock_items
  WHERE entreprise_id = p_entreprise_id
    AND statut IN ('rupture', 'epuise')
    OR (quantite_stock <= quantite_minimale AND quantite_minimale > 0);
  
  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(v_alertes, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Activer RLS sur toutes les tables
ALTER TABLE stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mouvements ENABLE ROW LEVEL SECURITY;

-- 9. Policies RLS pour stock_categories
CREATE POLICY "stock_categories_select"
  ON stock_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_categories_insert"
  ON stock_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_categories_update"
  ON stock_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_categories_delete"
  ON stock_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 10. Policies RLS pour stock_items
CREATE POLICY "stock_items_select"
  ON stock_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_items_insert"
  ON stock_items FOR INSERT
  TO authenticated
  WITH CHECK (
    entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_items_update"
  ON stock_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_items_delete"
  ON stock_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 11. Policies RLS pour stock_mouvements
CREATE POLICY "stock_mouvements_select"
  ON stock_mouvements FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_mouvements_insert"
  ON stock_mouvements FOR INSERT
  TO authenticated
  WITH CHECK (
    entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_mouvements_update"
  ON stock_mouvements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

CREATE POLICY "stock_mouvements_delete"
  ON stock_mouvements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
    OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
    OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
  );

-- 12. Ajouter le module dans modules_activation
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  actif,
  est_cree,
  priorite,
  icone
) VALUES (
  'gestion-stock',
  'Gestion de Stock',
  'Gestion complète du stock : catalogue, mouvements, inventaire, alertes',
  'premium',
  'transversal',
  true,
  true,
  2,
  'Package'
) ON CONFLICT (module_code) DO UPDATE SET
  est_cree = true,
  actif = true,
  module_nom = EXCLUDED.module_nom,
  module_description = EXCLUDED.module_description,
  priorite = EXCLUDED.priorite;

-- 13. Activer le module dans les plans d'abonnement appropriés
DO $$
DECLARE
  v_professional_plan_id uuid;
  v_enterprise_plan_id uuid;
BEGIN
  -- Récupérer les IDs des plans
  SELECT id INTO v_professional_plan_id FROM plans_abonnement WHERE nom = 'Professional' LIMIT 1;
  SELECT id INTO v_enterprise_plan_id FROM plans_abonnement WHERE nom = 'Enterprise' LIMIT 1;
  
  -- PLAN PROFESSIONAL : Ajouter gestion-stock
  IF v_professional_plan_id IS NOT NULL THEN
    -- Vérifier si la table plans_modules existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_modules') THEN
      INSERT INTO plans_modules (plan_id, module_code, inclus, prix_mensuel, prix_annuel)
      VALUES (v_professional_plan_id, 'gestion-stock', true, 0, 0)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        inclus = true,
        prix_mensuel = 0,
        prix_annuel = 0;
      
      RAISE NOTICE '✅ Module gestion-stock ajouté au plan Professional';
    END IF;
  END IF;
  
  -- PLAN ENTERPRISE : Ajouter gestion-stock (déjà inclus normalement, mais on s'assure)
  IF v_enterprise_plan_id IS NOT NULL THEN
    -- Vérifier si la table plans_modules existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans_modules') THEN
      INSERT INTO plans_modules (plan_id, module_code, inclus, prix_mensuel, prix_annuel)
      VALUES (v_enterprise_plan_id, 'gestion-stock', true, 0, 0)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        inclus = true,
        prix_mensuel = 0,
        prix_annuel = 0;
      
      RAISE NOTICE '✅ Module gestion-stock ajouté au plan Enterprise';
    END IF;
  END IF;
  
  -- Alternative : Si la table plan_modules existe (sans 's')
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_modules') THEN
    IF v_professional_plan_id IS NOT NULL THEN
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      VALUES (v_professional_plan_id, 'gestion-stock', 'Gestion de Stock', true)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        activer = true,
        module_nom = EXCLUDED.module_nom;
      
      RAISE NOTICE '✅ Module gestion-stock ajouté au plan Professional (via plan_modules)';
    END IF;
    
    IF v_enterprise_plan_id IS NOT NULL THEN
      INSERT INTO plan_modules (plan_id, module_code, module_nom, activer)
      VALUES (v_enterprise_plan_id, 'gestion-stock', 'Gestion de Stock', true)
      ON CONFLICT (plan_id, module_code) DO UPDATE SET
        activer = true,
        module_nom = EXCLUDED.module_nom;
      
      RAISE NOTICE '✅ Module gestion-stock ajouté au plan Enterprise (via plan_modules)';
    END IF;
  END IF;
END $$;

-- 14. Synchroniser les modules pour les clients existants ayant les plans Professional ou Enterprise
DO $$
DECLARE
  v_abonnement_record RECORD;
  v_espace_record RECORD;
BEGIN
  -- Pour chaque abonnement Professional ou Enterprise actif
  FOR v_abonnement_record IN
    SELECT a.id, a.plan_id, a.entreprise_id, a.client_id
    FROM abonnements a
    JOIN plans_abonnement p ON a.plan_id = p.id
    WHERE p.nom IN ('Professional', 'Enterprise')
      AND a.statut = 'actif'
  LOOP
    -- Trouver tous les espaces membres pour ce client/entreprise
    FOR v_espace_record IN
      SELECT id, modules_actifs
      FROM espaces_membres_clients
      WHERE entreprise_id = v_abonnement_record.entreprise_id
        AND client_id = v_abonnement_record.client_id
    LOOP
      -- Mettre à jour les modules actifs dans l'espace client
      -- Ajouter gestion-stock avec toutes les variantes possibles
      UPDATE espaces_membres_clients
      SET modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) 
        || jsonb_build_object('gestion-stock', true)
        || jsonb_build_object('gestion_stock', true)
        || jsonb_build_object('gestion-de-stock', true)
        || jsonb_build_object('gestion_de_stock', true),
        updated_at = NOW()
      WHERE id = v_espace_record.id;
      
      RAISE NOTICE '✅ Module gestion-stock ajouté à l''espace client %', v_espace_record.id;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Modules synchronisés pour les clients existants';
  
  -- Appeler la fonction de synchronisation automatique si elle existe
  BEGIN
    -- Essayer d'appeler sync_client_modules_from_subscription pour tous les clients
    FOR v_espace_record IN
      SELECT DISTINCT emc.id, emc.user_id
      FROM espaces_membres_clients emc
      JOIN abonnements a ON a.entreprise_id = emc.entreprise_id
      JOIN plans_abonnement p ON a.plan_id = p.id
      WHERE p.nom IN ('Professional', 'Enterprise')
        AND a.statut = 'actif'
    LOOP
      BEGIN
        PERFORM supabase.rpc('sync_client_modules_from_subscription', 
          jsonb_build_object('p_client_user_id', v_espace_record.user_id));
        RAISE NOTICE '✅ Synchronisation RPC appelée pour user_id %', v_espace_record.user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ RPC sync_client_modules_from_subscription non disponible ou erreur: %', SQLERRM;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Fonction de synchronisation RPC non disponible: %', SQLERRM;
  END;
END $$;

-- 15. Commentaires pour documentation
COMMENT ON TABLE stock_categories IS 'Catégories de produits pour organiser le stock';
COMMENT ON TABLE stock_items IS 'Articles/produits en stock avec quantités et informations';
COMMENT ON TABLE stock_mouvements IS 'Historique de tous les mouvements de stock (entrées, sorties, etc.)';
COMMENT ON FUNCTION create_stock_mouvement IS 'Crée un mouvement de stock et met à jour automatiquement la quantité';
COMMENT ON FUNCTION get_stock_alertes IS 'Retourne les articles en rupture ou sous le seuil minimum';


-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

SELECT '✅ Migration gestion-stock appliquée avec succès !' as status;
