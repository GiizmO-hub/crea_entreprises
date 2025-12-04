/*
  # Correction : Création automatique des paramètres comptables si absents
  
  OBJECTIF:
  - Modifier creer_ecriture_facture_vente pour créer automatiquement les paramètres comptables s'ils n'existent pas
  - Éviter l'erreur "Paramètres comptables non trouvés" lors du changement de statut d'une facture
*/

-- Modifier la fonction creer_ecriture_facture_vente pour créer automatiquement les paramètres comptables
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
  v_exercice_fiscal text;
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
  
  -- Déterminer l'exercice fiscal
  v_exercice_fiscal := TO_CHAR(v_facture.date_emission, 'YYYY');
  
  -- Récupérer les paramètres comptables (utiliser date_emission)
  SELECT * INTO v_parametres
  FROM parametres_comptables
  WHERE entreprise_id = v_entreprise_id
  AND exercice_fiscal = v_exercice_fiscal
  LIMIT 1;
  
  -- ✅ NOUVEAU : Si les paramètres n'existent pas, les créer automatiquement
  IF NOT FOUND THEN
    RAISE NOTICE '[creer_ecriture_facture_vente] ⚠️ Paramètres comptables non trouvés pour entreprise % exercice %, création automatique...', v_entreprise_id, v_exercice_fiscal;
    
    -- Appeler la fonction d'initialisation des paramètres comptables
    PERFORM init_parametres_comptables_entreprise(v_entreprise_id);
    
    -- Réessayer de récupérer les paramètres
    SELECT * INTO v_parametres
    FROM parametres_comptables
    WHERE entreprise_id = v_entreprise_id
    AND exercice_fiscal = v_exercice_fiscal
    LIMIT 1;
    
    -- Si toujours pas trouvé, retourner NULL sans erreur (l'automatisation n'est pas possible)
    IF NOT FOUND THEN
      RAISE WARNING '[creer_ecriture_facture_vente] ⚠️ Impossible de créer les paramètres comptables pour entreprise % exercice %, écriture non créée', v_entreprise_id, v_exercice_fiscal;
      RETURN NULL;
    END IF;
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
    RAISE WARNING '[creer_ecriture_facture_vente] ⚠️ Journal des ventes non trouvé pour entreprise %, écriture non créée', v_entreprise_id;
    RETURN NULL; -- Ne pas bloquer si le journal n'existe pas
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
    'Vente facture ' || v_facture.numero,
    COALESCE(v_parametres.compte_client, '411000'), -- Débit Client
    COALESCE(v_parametres.compte_produit, '701000'), -- Crédit Produits
    v_montant_ht,
    'automatique',
    'facture',
    p_facture_id,
    p_facture_id
  )
  RETURNING id INTO v_ecriture_id;
  
  -- Créer l'écriture TVA si nécessaire
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
      'TVA facture ' || v_facture.numero,
      COALESCE(v_parametres.compte_tva_collectee, '445710'), -- Débit TVA collectée
      COALESCE(v_parametres.compte_client, '411000'), -- Crédit Client
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

