/*
  # Automatisation Comptable - Écritures Automatiques
  
  Ce fichier contient toutes les fonctions d'automatisation pour :
  - Créer des écritures comptables depuis les factures
  - Créer des écritures comptables depuis les paiements
  - Générer automatiquement les fiches de paie
  - Calculer les déclarations TVA
*/

-- 1. FONCTION : Créer écriture comptable depuis une facture VENTE
CREATE OR REPLACE FUNCTION creer_ecriture_facture_vente(p_facture_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facture record;
  v_entreprise_id uuid;
  v_journal_id uuid;
  v_parametres record;
  v_numero_piece text;
  v_ecriture_id uuid;
  v_montant_ht numeric(15, 2);
  v_montant_tva numeric(15, 2);
  v_montant_ttc numeric(15, 2);
BEGIN
  -- Récupérer la facture (sélectionner explicitement les colonnes pour éviter les erreurs)
  SELECT 
    id, entreprise_id, client_id, numero, date_emission, date_echeance,
    montant_ht, montant_ttc, statut, notes
  INTO v_facture
  FROM factures
  WHERE id = p_facture_id;
  
  v_entreprise_id := v_facture.entreprise_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facture non trouvée: %', p_facture_id;
  END IF;
  
  -- Vérifier si l'écriture existe déjà
  SELECT id INTO v_ecriture_id
  FROM ecritures_comptables
  WHERE facture_id = p_facture_id
  LIMIT 1;
  
  IF v_ecriture_id IS NOT NULL THEN
    RETURN v_ecriture_id; -- Écriture déjà créée
  END IF;
  
  -- Récupérer les paramètres comptables (utiliser date_emission)
  SELECT * INTO v_parametres
  FROM parametres_comptables
  WHERE entreprise_id = v_entreprise_id
  AND exercice_fiscal = TO_CHAR(v_facture.date_emission, 'YYYY')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paramètres comptables non trouvés pour l''entreprise %', v_entreprise_id;
  END IF;
  
  -- Vérifier si l'automatisation est activée
  IF NOT v_parametres.auto_ecritures_factures THEN
    RETURN NULL; -- Automatisation désactivée
  END IF;
  
  -- Récupérer le journal des ventes
  SELECT id INTO v_journal_id
  FROM journaux_comptables
  WHERE entreprise_id = v_entreprise_id
  AND code_journal = 'VT'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal des ventes non trouvé';
  END IF;
  
  -- Calculer les montants
  v_montant_ht := COALESCE(v_facture.montant_ht, 0);
  v_montant_tva := COALESCE(v_facture.montant_ttc, 0) - v_montant_ht;
  v_montant_ttc := COALESCE(v_facture.montant_ttc, 0);
  
  -- Générer le numéro de pièce
  v_numero_piece := 'FAC-' || v_facture.numero;
  
  -- Créer l'écriture : Débit Client / Crédit Produits + TVA
  INSERT INTO ecritures_comptables (
    entreprise_id,
    journal_id,
    numero_piece,
    date_ecriture,
    libelle,
    compte_debit,
    compte_credit,
    montant,
    type_ecriture,
    source_type,
    source_id,
    facture_id
  )
  VALUES (
    v_entreprise_id,
    v_journal_id,
    v_numero_piece,
    v_facture.date_emission,
    'Facture ' || v_facture.numero || ' - ' || COALESCE(v_facture.notes, ''),
    COALESCE(v_parametres.compte_client, '411000'), -- Débit Clients
    COALESCE(v_parametres.compte_produits, '706000'), -- Crédit Produits
    v_montant_ht,
    'automatique',
    'facture',
    p_facture_id,
    p_facture_id
  )
  RETURNING id INTO v_ecriture_id;
  
  -- Si TVA > 0, créer une écriture pour la TVA
  IF v_montant_tva > 0 THEN
    INSERT INTO ecritures_comptables (
      entreprise_id,
      journal_id,
      numero_piece,
      date_ecriture,
      libelle,
      compte_debit,
      compte_credit,
      montant,
      type_ecriture,
      source_type,
      source_id,
      facture_id
    )
    VALUES (
      v_entreprise_id,
      v_journal_id,
      v_numero_piece,
      v_facture.date_emission,
      'TVA Facture ' || v_facture.numero,
      COALESCE(v_parametres.compte_client, '411000'), -- Débit Clients
      COALESCE(v_parametres.compte_tva_collectee, '445710'), -- Crédit TVA collectée
      v_montant_tva,
      'automatique',
      'facture',
      p_facture_id,
      p_facture_id
    );
  END IF;
  
  RETURN v_ecriture_id;
END;
$$;

-- 2. FONCTION : Créer écriture comptable depuis un paiement
CREATE OR REPLACE FUNCTION creer_ecriture_paiement(p_paiement_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paiement record;
  v_facture record;
  v_entreprise_id uuid;
  v_journal_id uuid;
  v_parametres record;
  v_numero_piece text;
  v_ecriture_id uuid;
  v_montant numeric(15, 2);
BEGIN
  -- Récupérer le paiement
  SELECT * INTO v_paiement
  FROM paiements
  WHERE id = p_paiement_id;
  
  v_entreprise_id := v_paiement.entreprise_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement non trouvé: %', p_paiement_id;
  END IF;
  
  -- Vérifier si l'écriture existe déjà
  SELECT id INTO v_ecriture_id
  FROM ecritures_comptables
  WHERE paiement_id = p_paiement_id
  LIMIT 1;
  
  IF v_ecriture_id IS NOT NULL THEN
    RETURN v_ecriture_id; -- Écriture déjà créée
  END IF;
  
  -- Récupérer la facture associée
  SELECT * INTO v_facture
  FROM factures
  WHERE id = v_paiement.facture_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN NULL; -- Pas de facture associée
  END IF;
  
  -- Récupérer les paramètres comptables
  SELECT * INTO v_parametres
  FROM parametres_comptables
  WHERE entreprise_id = v_entreprise_id
  AND exercice_fiscal = TO_CHAR(v_paiement.date_paiement, 'YYYY')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paramètres comptables non trouvés';
  END IF;
  
  -- Vérifier si l'automatisation est activée
  IF NOT v_parametres.auto_ecritures_paiements THEN
    RETURN NULL; -- Automatisation désactivée
  END IF;
  
  -- Récupérer le journal banque
  SELECT id INTO v_journal_id
  FROM journaux_comptables
  WHERE entreprise_id = v_entreprise_id
  AND code_journal = 'BN'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal banque non trouvé';
  END IF;
  
  v_montant := COALESCE(v_paiement.montant_ttc, 0);
  v_numero_piece := 'PAY-' || v_paiement.id::text;
  
  -- Créer l'écriture : Débit Banque / Crédit Clients
  INSERT INTO ecritures_comptables (
    entreprise_id,
    journal_id,
    numero_piece,
    date_ecriture,
    date_valeur,
    libelle,
    compte_debit,
    compte_credit,
    montant,
    type_ecriture,
    source_type,
    source_id,
    paiement_id,
    facture_id,
    est_rapprochee
  )
  VALUES (
    v_entreprise_id,
    v_journal_id,
    v_numero_piece,
    v_paiement.date_paiement,
    v_paiement.date_paiement,
    'Paiement facture ' || COALESCE(v_facture.numero, ''),
    COALESCE(v_parametres.compte_banque, '512000'), -- Débit Banque
    COALESCE(v_parametres.compte_client, '411000'), -- Crédit Clients
    v_montant,
    'automatique',
    'paiement',
    p_paiement_id,
    v_facture.id,
    true -- Automatiquement rapproché
  )
  RETURNING id INTO v_ecriture_id;
  
  RETURN v_ecriture_id;
END;
$$;

-- 3. TRIGGER : Créer écriture comptable automatiquement lors de la création d'une facture
CREATE OR REPLACE FUNCTION trigger_auto_ecriture_facture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Créer l'écriture seulement si la facture est validée/envoyée
  IF NEW.statut IN ('validee', 'envoyee', 'payee') AND NEW.type = 'facture' THEN
    PERFORM creer_ecriture_facture_vente(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger si la table factures existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'factures') THEN
    DROP TRIGGER IF EXISTS trigger_auto_ecriture_facture ON factures;
    CREATE TRIGGER trigger_auto_ecriture_facture
      AFTER INSERT OR UPDATE ON factures
      FOR EACH ROW
      WHEN (NEW.statut IN ('validee', 'envoyee', 'payee') AND NEW.type = 'facture')
      EXECUTE FUNCTION trigger_auto_ecriture_facture();
  END IF;
END $$;

-- 4. TRIGGER : Créer écriture comptable automatiquement lors d'un paiement
CREATE OR REPLACE FUNCTION trigger_auto_ecriture_paiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Créer l'écriture seulement si le paiement est payé
  IF NEW.statut = 'paye' THEN
    PERFORM creer_ecriture_paiement(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger si la table paiements existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'paiements') THEN
    DROP TRIGGER IF EXISTS trigger_auto_ecriture_paiement ON paiements;
    CREATE TRIGGER trigger_auto_ecriture_paiement
      AFTER INSERT OR UPDATE ON paiements
      FOR EACH ROW
      WHEN (NEW.statut = 'paye')
      EXECUTE FUNCTION trigger_auto_ecriture_paiement();
  END IF;
END $$;

-- 5. FONCTION : Générer automatiquement une fiche de paie
CREATE OR REPLACE FUNCTION generer_fiche_paie_auto(
  p_entreprise_id uuid,
  p_collaborateur_id uuid,
  p_periode text -- Format: "YYYY-MM"
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_collaborateur record;
  v_parametres record;
  v_fiche_id uuid;
  v_salaire_brut numeric(10, 2);
  v_cotisations_salariales numeric(10, 2);
  v_cotisations_patronales numeric(10, 2);
  v_salaire_net numeric(10, 2);
  v_taux_cotisations numeric(5, 2) := 22.0; -- Taux moyen de cotisations
BEGIN
  -- Vérifier si la fiche existe déjà
  SELECT id INTO v_fiche_id
  FROM fiches_paie
  WHERE entreprise_id = p_entreprise_id
  AND collaborateur_id = p_collaborateur_id
  AND periode = p_periode;
  
  IF v_fiche_id IS NOT NULL THEN
    RETURN v_fiche_id; -- Fiche déjà générée
  END IF;
  
  -- Récupérer les informations du collaborateur
  SELECT * INTO v_collaborateur
  FROM collaborateurs_entreprise
  WHERE id = p_collaborateur_id
  AND entreprise_id = p_entreprise_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collaborateur non trouvé';
  END IF;
  
  -- Récupérer les paramètres comptables
  SELECT * INTO v_parametres
  FROM parametres_comptables
  WHERE entreprise_id = p_entreprise_id
  AND exercice_fiscal = SPLIT_PART(p_periode, '-', 1)
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paramètres comptables non trouvés';
  END IF;
  
  -- Vérifier si l'automatisation est activée
  IF NOT v_parametres.auto_fiches_paie THEN
    RETURN NULL; -- Automatisation désactivée
  END IF;
  
  -- Calculer le salaire brut (depuis le salaire du collaborateur - à adapter selon la structure de collaborateurs_entreprise)
  -- Pour l'instant, on utilise une valeur par défaut ou depuis un champ JSONB si disponible
  v_salaire_brut := COALESCE(
    (v_collaborateur.donnees->>'salaire')::numeric,
    0
  );
  
  IF v_salaire_brut = 0 THEN
    RETURN NULL; -- Pas de salaire défini
  END IF;
  
  -- Calculer les cotisations (simplifié - à améliorer avec les vrais taux)
  v_cotisations_salariales := v_salaire_brut * (v_taux_cotisations / 100);
  v_cotisations_patronales := v_salaire_brut * (v_taux_cotisations / 100);
  v_salaire_net := v_salaire_brut - v_cotisations_salariales;
  
  -- Créer la fiche de paie
  INSERT INTO fiches_paie (
    entreprise_id,
    collaborateur_id,
    periode,
    date_paiement,
    salaire_brut,
    salaire_net,
    cotisations_salariales,
    cotisations_patronales,
    net_a_payer,
    est_automatique,
    statut
  )
  VALUES (
    p_entreprise_id,
    p_collaborateur_id,
    p_periode,
    (p_periode || '-25')::date, -- Paiement le 25 du mois
    v_salaire_brut,
    v_salaire_net,
    v_cotisations_salariales,
    v_cotisations_patronales,
    v_salaire_net,
    true,
    'brouillon'
  )
  RETURNING id INTO v_fiche_id;
  
  RETURN v_fiche_id;
END;
$$;

-- 6. FONCTION : Calculer la déclaration TVA automatiquement
CREATE OR REPLACE FUNCTION calculer_declaration_tva(
  p_entreprise_id uuid,
  p_periode text -- Format: "YYYY-MM" ou "YYYY-Q1" ou "YYYY"
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_declaration_id uuid;
  v_date_debut date;
  v_date_fin date;
  v_tva_collectee numeric(15, 2) := 0;
  v_tva_deductible numeric(15, 2) := 0;
  v_tva_a_payer numeric(15, 2) := 0;
  v_chiffre_affaires numeric(15, 2) := 0;
BEGIN
  -- Vérifier si la déclaration existe déjà
  SELECT id INTO v_declaration_id
  FROM declarations_fiscales
  WHERE entreprise_id = p_entreprise_id
  AND type_declaration = 'tva'
  AND periode = p_periode;
  
  IF v_declaration_id IS NOT NULL THEN
    RETURN v_declaration_id; -- Déclaration déjà créée
  END IF;
  
  -- Déterminer les dates selon le type de période
  IF p_periode LIKE '%-Q%' THEN
    -- Trimestre
    v_date_debut := DATE_TRUNC('quarter', (SPLIT_PART(p_periode, '-Q', 1) || '-01-01')::date)::date;
    v_date_fin := (v_date_debut + INTERVAL '3 months' - INTERVAL '1 day')::date;
  ELSIF p_periode LIKE '%-%' THEN
    -- Mois
    v_date_debut := (p_periode || '-01')::date;
    v_date_fin := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSE
    -- Année
    v_date_debut := (p_periode || '-01-01')::date;
    v_date_fin := (p_periode || '-12-31')::date;
  END IF;
  
  -- Calculer la TVA collectée (depuis les écritures comptables)
  SELECT COALESCE(SUM(montant), 0) INTO v_tva_collectee
  FROM ecritures_comptables
  WHERE entreprise_id = p_entreprise_id
  AND compte_credit = '445710' -- TVA collectée
  AND date_ecriture BETWEEN v_date_debut AND v_date_fin;
  
  -- Calculer la TVA déductible (depuis les écritures comptables)
  SELECT COALESCE(SUM(montant), 0) INTO v_tva_deductible
  FROM ecritures_comptables
  WHERE entreprise_id = p_entreprise_id
  AND compte_debit = '445660' -- TVA déductible
  AND date_ecriture BETWEEN v_date_debut AND v_date_fin;
  
  -- Calculer le chiffre d'affaires
  SELECT COALESCE(SUM(montant_ht), 0) INTO v_chiffre_affaires
  FROM factures
  WHERE entreprise_id = p_entreprise_id
  AND type = 'facture'
  AND statut IN ('validee', 'envoyee', 'payee')
  AND date_emission BETWEEN v_date_debut AND v_date_fin;
  
  -- Calculer la TVA à payer
  v_tva_a_payer := v_tva_collectee - v_tva_deductible;
  
  -- Créer la déclaration
  INSERT INTO declarations_fiscales (
    entreprise_id,
    type_declaration,
    periode,
    date_echeance,
    montant_due,
    statut,
    donnees_declaration
  )
  VALUES (
    p_entreprise_id,
    'tva',
    p_periode,
    v_date_fin + INTERVAL '1 month' + INTERVAL '15 days', -- Échéance : 15 jours après la fin de période
    v_tva_a_payer,
    CASE WHEN v_tva_a_payer > 0 THEN 'a_faire' ELSE 'deposee' END,
    jsonb_build_object(
      'tva_collectee', v_tva_collectee,
      'tva_deductible', v_tva_deductible,
      'tva_a_payer', v_tva_a_payer,
      'chiffre_affaires', v_chiffre_affaires,
      'date_debut', v_date_debut,
      'date_fin', v_date_fin
    )
  )
  RETURNING id INTO v_declaration_id;
  
  RETURN v_declaration_id;
END;
$$;

