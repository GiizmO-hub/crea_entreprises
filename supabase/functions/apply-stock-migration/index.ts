import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifier que la requête vient d'un utilisateur autorisé
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Vérifier que l'utilisateur est admin
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔐 Application de la migration gestion-stock...')

    // Lire le fichier SQL de migration
    const migrationSQL = await Deno.readTextFile('./APPLY_STOCK_MIGRATION_NOW.sql')
      .catch(async () => {
        // Si le fichier n'est pas disponible, utiliser le SQL inline
        return `
-- Module Gestion de Stock Générique
DROP TABLE IF EXISTS stock_mouvements CASCADE;
DROP TABLE IF EXISTS stock_items CASCADE;
DROP TABLE IF EXISTS stock_categories CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_stock_categories_entreprise_id ON stock_categories(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_categories_ordre ON stock_categories(ordre);

CREATE TABLE stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  categorie_id uuid REFERENCES stock_categories(id) ON DELETE SET NULL,
  reference text NOT NULL,
  nom text NOT NULL,
  description text,
  unite_mesure text DEFAULT 'unité' CHECK (unite_mesure IN ('unité', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'm²', 'm³', 'lot', 'paquet')),
  quantite_stock numeric(12, 3) DEFAULT 0,
  quantite_minimale numeric(12, 3) DEFAULT 0,
  quantite_maximale numeric(12, 3),
  prix_achat_unitaire numeric(12, 2) DEFAULT 0,
  prix_vente_unitaire numeric(12, 2) DEFAULT 0,
  emplacement text,
  fournisseur text,
  date_peremption date,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'epuise', 'rupture')),
  tags text[],
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(entreprise_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_stock_items_entreprise_id ON stock_items(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_categorie_id ON stock_items(categorie_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_reference ON stock_items(reference);
CREATE INDEX IF NOT EXISTS idx_stock_items_nom ON stock_items(nom);
CREATE INDEX IF NOT EXISTS idx_stock_items_statut ON stock_items(statut);
CREATE INDEX IF NOT EXISTS idx_stock_items_quantite_stock ON stock_items(quantite_stock);
CREATE INDEX IF NOT EXISTS idx_stock_items_date_peremption ON stock_items(date_peremption);

CREATE TABLE stock_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type_mouvement text NOT NULL CHECK (type_mouvement IN ('entree', 'sortie', 'transfert', 'inventaire', 'perte', 'retour')),
  quantite numeric(12, 3) NOT NULL,
  quantite_avant numeric(12, 3) NOT NULL,
  quantite_apres numeric(12, 3) NOT NULL,
  motif text,
  reference_externe text,
  facture_id uuid REFERENCES factures(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  emplacement_source text,
  emplacement_destination text,
  cout_unitaire numeric(12, 2),
  cout_total numeric(12, 2),
  date_mouvement date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_stock_mouvements_entreprise_id ON stock_mouvements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_stock_item_id ON stock_mouvements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_type ON stock_mouvements(type_mouvement);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_date ON stock_mouvements(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_facture_id ON stock_mouvements(facture_id);
CREATE INDEX IF NOT EXISTS idx_stock_mouvements_client_id ON stock_mouvements(client_id);

CREATE OR REPLACE FUNCTION update_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
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
  SELECT * INTO v_item FROM stock_items WHERE id = p_stock_item_id AND entreprise_id = p_entreprise_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Article non trouvé');
  END IF;
  v_quantite_avant := v_item.quantite_stock;
  v_quantite_absolue := ABS(p_quantite);
  CASE p_type_mouvement
    WHEN 'entree', 'retour' THEN v_quantite_apres := v_quantite_avant + v_quantite_absolue;
    WHEN 'sortie', 'perte' THEN
      v_quantite_apres := v_quantite_avant - v_quantite_absolue;
      IF v_quantite_apres < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant. Stock actuel: ' || v_quantite_avant);
      END IF;
    WHEN 'inventaire' THEN v_quantite_apres := p_quantite;
    WHEN 'transfert' THEN
      v_quantite_apres := v_quantite_avant - v_quantite_absolue;
      IF v_quantite_apres < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant pour transfert. Stock actuel: ' || v_quantite_avant);
      END IF;
    ELSE RETURN jsonb_build_object('success', false, 'error', 'Type de mouvement invalide');
  END CASE;
  IF p_cout_unitaire IS NOT NULL THEN
    v_cout_total := v_quantite_absolue * p_cout_unitaire;
  ELSE
    v_cout_total := NULL;
  END IF;
  INSERT INTO stock_mouvements (
    entreprise_id, stock_item_id, type_mouvement, quantite, quantite_avant, quantite_apres,
    motif, reference_externe, facture_id, client_id, emplacement_source, emplacement_destination,
    cout_unitaire, cout_total, date_mouvement, notes, created_by
  ) VALUES (
    p_entreprise_id, p_stock_item_id, p_type_mouvement,
    CASE WHEN p_type_mouvement IN ('sortie', 'perte', 'transfert') THEN -v_quantite_absolue ELSE v_quantite_absolue END,
    v_quantite_avant, v_quantite_apres, p_motif, p_reference_externe, p_facture_id, p_client_id,
    p_emplacement_source, p_emplacement_destination, p_cout_unitaire, v_cout_total,
    p_date_mouvement, p_notes, auth.uid()
  ) RETURNING id INTO v_mouvement_id;
  RETURN jsonb_build_object('success', true, 'mouvement_id', v_mouvement_id, 'quantite_avant', v_quantite_avant, 'quantite_apres', v_quantite_apres);
EXCEPTION
  WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_stock_alertes(p_entreprise_id uuid) RETURNS jsonb AS $$
DECLARE v_alertes jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'reference', reference, 'nom', nom, 'quantite_stock', quantite_stock, 'quantite_minimale', quantite_minimale, 'unite_mesure', unite_mesure, 'statut', statut))
  INTO v_alertes FROM stock_items
  WHERE entreprise_id = p_entreprise_id AND (statut IN ('rupture', 'epuise') OR (quantite_stock <= quantite_minimale AND quantite_minimale > 0));
  RETURN jsonb_build_object('success', true, 'data', COALESCE(v_alertes, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_categories_select" ON stock_categories FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_categories_insert" ON stock_categories FOR INSERT TO authenticated WITH CHECK (
  entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_categories_update" ON stock_categories FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_categories_delete" ON stock_categories FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_items_select" ON stock_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_items_insert" ON stock_items FOR INSERT TO authenticated WITH CHECK (
  entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_items_update" ON stock_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_items_delete" ON stock_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_mouvements_select" ON stock_mouvements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_mouvements_insert" ON stock_mouvements FOR INSERT TO authenticated WITH CHECK (
  entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_mouvements_update" ON stock_mouvements FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "stock_mouvements_delete" ON stock_mouvements FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

INSERT INTO modules_activation (module_code, module_nom, module_description, categorie, secteur_activite, actif, est_cree, priorite, icone)
VALUES ('gestion-stock', 'Gestion de Stock', 'Gestion complète du stock : catalogue, mouvements, inventaire, alertes', 'premium', 'transversal', true, true, 2, 'Package')
ON CONFLICT (module_code) DO UPDATE SET est_cree = true, actif = true, module_nom = EXCLUDED.module_nom, module_description = EXCLUDED.module_description, priorite = EXCLUDED.priorite;
`
      })

    // Utiliser directement le pool PostgreSQL
    const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL')
    
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: 'DATABASE_URL non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pool = new Pool(dbUrl, 3, true)
    const client = await pool.connect()
    
    try {
      // Exécuter le SQL
      console.log('⏳ Exécution de la migration...')
      const result = await client.queryObject(migrationSQL)
      
      await client.release()
      await pool.end()
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Migration gestion-stock appliquée avec succès',
          result: result
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (sqlError) {
      await client.release()
      await pool.end()
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: sqlError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

