/*
  # Initialisation du Plan Comptable Général (PCG) Français
  
  Cette migration initialise le plan comptable français standard pour toutes les entreprises.
  Les comptes principaux du PCG sont créés automatiquement lors de la création d'une entreprise.
*/

-- Fonction pour initialiser le plan comptable pour une entreprise
CREATE OR REPLACE FUNCTION init_plan_comptable_entreprise(p_entreprise_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insérer les comptes principaux du PCG français
  -- Classe 1 : Financement permanent
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '101000', 'Capital', 'passif', 1, true),
    (p_entreprise_id, '106000', 'Réserves', 'passif', 1, true),
    (p_entreprise_id, '120000', 'Résultat de l''exercice', 'passif', 1, true),
    (p_entreprise_id, '131000', 'Subventions d''investissement', 'passif', 1, true),
    (p_entreprise_id, '164000', 'Emprunts et dettes assimilées', 'passif', 1, true),
    (p_entreprise_id, '168000', 'Autres dettes', 'passif', 1, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 2 : Actif immobilisé
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '201000', 'Immobilisations incorporelles', 'actif', 2, true),
    (p_entreprise_id, '211000', 'Terrains', 'actif', 2, true),
    (p_entreprise_id, '213000', 'Constructions', 'actif', 2, true),
    (p_entreprise_id, '218000', 'Autres immobilisations corporelles', 'actif', 2, true),
    (p_entreprise_id, '261000', 'Titres de participation', 'actif', 2, true),
    (p_entreprise_id, '267000', 'Autres titres immobilisés', 'actif', 2, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 3 : Stocks
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '311000', 'Matières premières', 'actif', 3, true),
    (p_entreprise_id, '321000', 'Produits en cours', 'actif', 3, true),
    (p_entreprise_id, '331000', 'Produits finis', 'actif', 3, true),
    (p_entreprise_id, '341000', 'Marchandises', 'actif', 3, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 4 : Comptes de tiers
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '411000', 'Clients', 'actif', 4, true),
    (p_entreprise_id, '411100', 'Clients - Factures à établir', 'actif', 4, false),
    (p_entreprise_id, '411900', 'Clients - Créances douteuses', 'actif', 4, false),
    (p_entreprise_id, '401000', 'Fournisseurs', 'passif', 4, true),
    (p_entreprise_id, '401100', 'Fournisseurs - Factures non parvenues', 'passif', 4, false),
    (p_entreprise_id, '421000', 'Personnel', 'passif', 4, true),
    (p_entreprise_id, '425000', 'Organismes sociaux', 'passif', 4, true),
    (p_entreprise_id, '428000', 'Autres comptes de tiers', 'passif', 4, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 5 : Comptes financiers
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '512000', 'Banque', 'tresorerie', 5, true),
    (p_entreprise_id, '530000', 'Caisse', 'tresorerie', 5, true),
    (p_entreprise_id, '531000', 'Chèques à encaisser', 'tresorerie', 5, false),
    (p_entreprise_id, '580000', 'Virements internes', 'tresorerie', 5, false)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 6 : Charges
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '601000', 'Achats stockés - Matières premières', 'charge', 6, true),
    (p_entreprise_id, '607000', 'Achats de marchandises', 'charge', 6, true),
    (p_entreprise_id, '611000', 'Variations de stocks', 'charge', 6, true),
    (p_entreprise_id, '621000', 'Personnel', 'charge', 6, true),
    (p_entreprise_id, '622000', 'Charges externes', 'charge', 6, true),
    (p_entreprise_id, '623000', 'Impôts, taxes et versements assimilés', 'charge', 6, true),
    (p_entreprise_id, '625000', 'Autres charges de gestion courante', 'charge', 6, true),
    (p_entreprise_id, '631000', 'Impôts sur les bénéfices', 'charge', 6, true),
    (p_entreprise_id, '641000', 'Charges de personnel', 'charge', 6, true),
    (p_entreprise_id, '645000', 'Charges de sécurité sociale', 'charge', 6, true),
    (p_entreprise_id, '651000', 'Dotations aux amortissements', 'charge', 6, true),
    (p_entreprise_id, '661000', 'Charges exceptionnelles', 'charge', 6, true),
    (p_entreprise_id, '671000', 'Charges constatées d''avance', 'charge', 6, false),
    (p_entreprise_id, '681000', 'Dotations aux provisions', 'charge', 6, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Classe 7 : Produits
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '701000', 'Ventes de produits finis', 'produit', 7, true),
    (p_entreprise_id, '706000', 'Prestations de services', 'produit', 7, true),
    (p_entreprise_id, '707000', 'Ventes de marchandises', 'produit', 7, true),
    (p_entreprise_id, '708000', 'Produits des activités annexes', 'produit', 7, true),
    (p_entreprise_id, '709000', 'Rabais, remises et ristournes accordés', 'produit', 7, false),
    (p_entreprise_id, '731000', 'Subventions d''exploitation', 'produit', 7, true),
    (p_entreprise_id, '741000', 'Charges transférées', 'produit', 7, false),
    (p_entreprise_id, '751000', 'Produits des titres de participation', 'produit', 7, true),
    (p_entreprise_id, '761000', 'Produits exceptionnels', 'produit', 7, true),
    (p_entreprise_id, '771000', 'Produits constatés d''avance', 'produit', 7, false),
    (p_entreprise_id, '781000', 'Reprises sur provisions', 'produit', 7, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Comptes TVA
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '445660', 'TVA déductible', 'charge', 4, true),
    (p_entreprise_id, '445710', 'TVA collectée', 'produit', 4, true),
    (p_entreprise_id, '445800', 'TVA à décaisser', 'passif', 4, false),
    (p_entreprise_id, '445810', 'TVA à récupérer', 'actif', 4, false)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;

  -- Comptes de résultat
  INSERT INTO plan_comptable (entreprise_id, numero_compte, libelle, type_compte, classe_compte, est_compte_principal)
  VALUES
    (p_entreprise_id, '120000', 'Résultat de l''exercice (bénéfice)', 'passif', 1, true),
    (p_entreprise_id, '129000', 'Résultat de l''exercice (perte)', 'actif', 1, true)
  ON CONFLICT (entreprise_id, numero_compte) DO NOTHING;
END;
$$;

-- Fonction pour initialiser les journaux comptables par défaut
CREATE OR REPLACE FUNCTION init_journaux_comptables_entreprise(p_entreprise_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO journaux_comptables (entreprise_id, code_journal, libelle, type_journal, est_automatique)
  VALUES
    (p_entreprise_id, 'AC', 'Journal des Achats', 'achats', true),
    (p_entreprise_id, 'VT', 'Journal des Ventes', 'ventes', true),
    (p_entreprise_id, 'BN', 'Journal de Banque', 'banque', true),
    (p_entreprise_id, 'CA', 'Journal de Caisse', 'caisse', true),
    (p_entreprise_id, 'OD', 'Journal des Opérations Diverses', 'od', true),
    (p_entreprise_id, 'GE', 'Journal Général', 'general', false)
  ON CONFLICT (entreprise_id, code_journal) DO NOTHING;
END;
$$;

-- Fonction pour initialiser les paramètres comptables par défaut
CREATE OR REPLACE FUNCTION init_parametres_comptables_entreprise(p_entreprise_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_annee_courante text;
  v_date_debut date;
  v_date_fin date;
BEGIN
  v_annee_courante := TO_CHAR(CURRENT_DATE, 'YYYY');
  v_date_debut := DATE_TRUNC('year', CURRENT_DATE)::date;
  v_date_fin := (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::date;

  INSERT INTO parametres_comptables (
    entreprise_id,
    exercice_fiscal,
    date_debut_exercice,
    date_fin_exercice,
    compte_caisse,
    compte_banque,
    compte_client,
    compte_fournisseur,
    compte_tva_collectee,
    compte_tva_deductible,
    compte_charges,
    compte_produits
  )
  VALUES (
    p_entreprise_id,
    v_annee_courante,
    v_date_debut,
    v_date_fin,
    '530000', -- Caisse
    '512000', -- Banque
    '411000', -- Clients
    '401000', -- Fournisseurs
    '445710', -- TVA collectée
    '445660', -- TVA déductible
    '622000', -- Charges externes
    '706000'  -- Prestations de services
  )
  ON CONFLICT (entreprise_id, exercice_fiscal) DO NOTHING;
END;
$$;

-- Trigger pour initialiser automatiquement le plan comptable lors de la création d'une entreprise
CREATE OR REPLACE FUNCTION auto_init_comptabilite_entreprise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Initialiser le plan comptable
  PERFORM init_plan_comptable_entreprise(NEW.id);
  
  -- Initialiser les journaux comptables
  PERFORM init_journaux_comptables_entreprise(NEW.id);
  
  -- Initialiser les paramètres comptables
  PERFORM init_parametres_comptables_entreprise(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Créer le trigger si la table entreprises existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entreprises') THEN
    DROP TRIGGER IF EXISTS trigger_auto_init_comptabilite ON entreprises;
    CREATE TRIGGER trigger_auto_init_comptabilite
      AFTER INSERT ON entreprises
      FOR EACH ROW
      EXECUTE FUNCTION auto_init_comptabilite_entreprise();
  END IF;
END $$;

