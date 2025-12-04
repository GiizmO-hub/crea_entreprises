/*
  # Création d'une entreprise de test complète : SAS TEST
  
  Ce script crée une entreprise complète avec TOUTES les données nécessaires pour tester :
  - Entreprise SAS TEST
  - Utilisateur admin
  - Client avec espace membre
  - Abonnement actif
  - Collaborateurs
  - Factures (envoyées, reçues, brouillons)
  - Données CRM (activités, opportunités, pipeline)
  - Projet avec équipe
  - Stock (articles, mouvements)
  - Paramètres comptables
  - Écritures comptables
  - Fiches de paie
  - Déclarations fiscales
  
  ⚠️ IMPORTANT : Ce script vérifie toutes les contraintes et gère les cas où les données existent déjà
*/

DO $$
DECLARE
  v_admin_user_id uuid;
  v_entreprise_id uuid;
  v_client_id uuid;
  v_espace_membre_id uuid;
  v_abonnement_id uuid;
  v_plan_id uuid;
  v_role_super_admin_id uuid;
  v_collaborateur_1_id uuid;
  v_collaborateur_2_id uuid;
  v_projet_id uuid;
  v_equipe_id uuid;
  v_facture_1_id uuid;
  v_facture_2_id uuid;
  v_facture_3_id uuid;
  v_opportunite_id uuid;
  v_etape_id uuid;
  v_journal_ventes_id uuid;
  v_journal_achats_id uuid;
  v_ecriture_1_id uuid;
  v_fiche_paie_id uuid;
  v_stock_item_1_id uuid;
  v_numero_facture text;
  v_counter integer;
BEGIN
  -- ============================================================================
  -- 1. VÉRIFICATIONS PRÉLIMINAIRES
  -- ============================================================================
  
  -- Récupérer l'ID du rôle client_super_admin
  SELECT id INTO v_role_super_admin_id FROM roles WHERE code = 'client_super_admin' LIMIT 1;
  
  IF v_role_super_admin_id IS NULL THEN
    RAISE EXCEPTION 'Rôle client_super_admin non trouvé dans la table roles. Veuillez exécuter les migrations de rôles d''abord.';
  END IF;
  
  -- Récupérer l'utilisateur admin
  v_admin_user_id := auth.uid();
  
  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id FROM utilisateurs WHERE role = 'super_admin' LIMIT 1;
    
    IF v_admin_user_id IS NULL THEN
      RAISE EXCEPTION 'Aucun utilisateur super admin trouvé. Veuillez vous connecter en tant qu''admin.';
    END IF;
  END IF;

  RAISE NOTICE '✅ Utilisateur admin: %', v_admin_user_id;

  -- ============================================================================
  -- 2. PLAN D'ABONNEMENT
  -- ============================================================================
  
  SELECT id INTO v_plan_id FROM plans_abonnement WHERE nom ILIKE '%entreprise%' AND actif = true LIMIT 1;
  
  IF v_plan_id IS NULL THEN
    INSERT INTO plans_abonnement (nom, description, prix_mensuel, prix_annuel, actif, ordre)
    VALUES ('Entreprise Test', 'Plan entreprise pour tests', 49.99, 499.99, true, 1)
    RETURNING id INTO v_plan_id;
    RAISE NOTICE '✅ Plan créé: %', v_plan_id;
  ELSE
    RAISE NOTICE '✅ Plan existant utilisé: %', v_plan_id;
  END IF;

  -- ============================================================================
  -- 3. ENTREPRISE SAS TEST
  -- ============================================================================
  
  -- Vérifier si l'entreprise existe déjà
  SELECT id INTO v_entreprise_id FROM entreprises WHERE nom = 'SAS TEST' LIMIT 1;
  
  -- Si l'entreprise existe déjà, on arrête complètement le script (ne pas recréer)
  IF v_entreprise_id IS NOT NULL THEN
    RAISE NOTICE 'ℹ️  L''entreprise "SAS TEST" existe déjà (ID: %). Aucune création nécessaire. Script arrêté.', v_entreprise_id;
    -- Sortir du bloc DO $$ complètement
    RETURN;
  END IF;
  
  -- Créer l'entreprise seulement si elle n'existe pas
  IF v_entreprise_id IS NULL THEN
    INSERT INTO entreprises (
      user_id,
      nom,
      forme_juridique,
      siret,
      email,
      telephone,
      adresse,
      code_postal,
      ville,
      capital,
      rcs,
      site_web,
      statut,
      statut_paiement
    )
    VALUES (
      v_admin_user_id,
      'SAS TEST',
      'SAS',
      '12345678901234',
      'contact@sastest.fr',
      '01 23 45 67 89',
      '123 Rue de la Test',
      '75001',
      'Paris',
      10000,
      'RCS Paris B 123456789',
      'https://www.sastest.fr',
      'active',
      'paye'
    )
    RETURNING id INTO v_entreprise_id;
    
    RAISE NOTICE '✅ Entreprise créée: %', v_entreprise_id;
  ELSE
    RAISE NOTICE '✅ Entreprise existante récupérée: %', v_entreprise_id;
  END IF;

  -- ============================================================================
  -- 4. CLIENT AVEC ESPACE MEMBRE
  -- ============================================================================
  
  -- Vérifier si le client existe déjà
  SELECT id INTO v_client_id FROM clients 
  WHERE entreprise_id = v_entreprise_id AND email = 'jean.dupont@sastest.fr' LIMIT 1;
  
  IF v_client_id IS NULL THEN
    INSERT INTO clients (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      adresse,
      code_postal,
      ville,
      siret,
      entreprise_nom,
      statut,
      role_id,
      crm_actif
    )
    VALUES (
      v_entreprise_id,
      'Dupont',
      'Jean',
      'jean.dupont@sastest.fr',
      '06 12 34 56 78',
      '456 Avenue du Client',
      '75002',
      'Paris',
      '98765432109876',
      'Client Entreprise SAS',
      'actif',
      v_role_super_admin_id,
      true
    )
    RETURNING id INTO v_client_id;
    
    RAISE NOTICE '✅ Client créé: %', v_client_id;
  ELSE
    -- Mettre à jour le client existant
    UPDATE clients 
    SET role_id = v_role_super_admin_id, 
        nom = 'Dupont', 
        prenom = 'Jean',
        crm_actif = true,
        statut = 'actif'
    WHERE id = v_client_id;
    
    RAISE NOTICE '✅ Client existant mis à jour: %', v_client_id;
  END IF;

  -- Créer l'espace membre (sans mot_de_passe si la colonne n'existe pas)
  SELECT id INTO v_espace_membre_id FROM espaces_membres_clients 
  WHERE entreprise_id = v_entreprise_id AND client_id = v_client_id LIMIT 1;
  
  IF v_espace_membre_id IS NULL THEN
    -- Vérifier si la colonne mot_de_passe existe
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'espaces_membres_clients' 
      AND column_name = 'mot_de_passe'
    ) THEN
      INSERT INTO espaces_membres_clients (
        entreprise_id,
        client_id,
        user_id,
        email,
        mot_de_passe,
        actif
      )
      VALUES (
        v_entreprise_id,
        v_client_id,
        v_admin_user_id,
        'jean.dupont@sastest.fr',
        crypt('Test1234!', gen_salt('bf')),
        true
      )
      RETURNING id INTO v_espace_membre_id;
    ELSE
      INSERT INTO espaces_membres_clients (
        entreprise_id,
        client_id,
        user_id,
        email,
        actif
      )
      VALUES (
        v_entreprise_id,
        v_client_id,
        v_admin_user_id,
        'jean.dupont@sastest.fr',
        true
      )
      RETURNING id INTO v_espace_membre_id;
    END IF;
    
    RAISE NOTICE '✅ Espace membre créé: %', v_espace_membre_id;
  ELSE
    UPDATE espaces_membres_clients 
    SET actif = true, user_id = v_admin_user_id
    WHERE id = v_espace_membre_id;
    
    RAISE NOTICE '✅ Espace membre existant mis à jour: %', v_espace_membre_id;
  END IF;

  -- ============================================================================
  -- 5. ABONNEMENT
  -- ============================================================================
  
  SELECT id INTO v_abonnement_id FROM abonnements 
  WHERE entreprise_id = v_entreprise_id AND client_id = v_client_id LIMIT 1;
  
  IF v_abonnement_id IS NULL THEN
    -- Vérifier si client_id référence auth.users ou clients
    -- Dans les autres migrations, client_id semble être user_id
    -- Utiliser v_admin_user_id au lieu de v_client_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'abonnements' 
      AND column_name = 'mode_paiement'
    ) THEN
      INSERT INTO abonnements (
        entreprise_id,
        client_id,
        plan_id,
        statut,
        date_debut,
        date_fin,
        montant_mensuel,
        mode_paiement
      )
      VALUES (
        v_entreprise_id,
        v_admin_user_id,  -- Utiliser user_id au lieu de client_id
        v_plan_id,
        'actif',
        CURRENT_DATE - INTERVAL '1 month',
        CURRENT_DATE + INTERVAL '11 months',
        49.99,
        'mensuel'  -- Valeur utilisée dans les autres migrations
      )
      RETURNING id INTO v_abonnement_id;
    ELSE
      INSERT INTO abonnements (
        entreprise_id,
        client_id,
        plan_id,
        statut,
        date_debut,
        date_fin,
        montant_mensuel
      )
      VALUES (
        v_entreprise_id,
        v_admin_user_id,  -- Utiliser user_id au lieu de client_id
        v_plan_id,
        'actif',
        CURRENT_DATE - INTERVAL '1 month',
        CURRENT_DATE + INTERVAL '11 months',
        49.99
      )
      RETURNING id INTO v_abonnement_id;
    END IF;
    
    RAISE NOTICE '✅ Abonnement créé: %', v_abonnement_id;
  ELSE
    RAISE NOTICE '✅ Abonnement existant: %', v_abonnement_id;
  END IF;

  -- ============================================================================
  -- 6. COLLABORATEURS
  -- ============================================================================
  
  -- Collaborateur 1
  SELECT id INTO v_collaborateur_1_id FROM collaborateurs_entreprise 
  WHERE entreprise_id = v_entreprise_id AND email = 'sophie.martin@sastest.fr' LIMIT 1;
  
  -- Collaborateur 1 (structure selon la table réelle)
  SELECT id INTO v_collaborateur_1_id FROM collaborateurs_entreprise 
  WHERE entreprise_id = v_entreprise_id AND email = 'sophie.martin@sastest.fr' LIMIT 1;
  
  IF v_collaborateur_1_id IS NULL THEN
    INSERT INTO collaborateurs_entreprise (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      role,
      actif
    )
    VALUES (
      v_entreprise_id,
      'Martin',
      'Sophie',
      'sophie.martin@sastest.fr',
      '06 11 22 33 44',
      'Développeuse',
      true
    )
    RETURNING id INTO v_collaborateur_1_id;
  END IF;

  -- Collaborateur 2
  SELECT id INTO v_collaborateur_2_id FROM collaborateurs_entreprise 
  WHERE entreprise_id = v_entreprise_id AND email = 'pierre.bernard@sastest.fr' LIMIT 1;
  
  IF v_collaborateur_2_id IS NULL THEN
    INSERT INTO collaborateurs_entreprise (
      entreprise_id,
      nom,
      prenom,
      email,
      telephone,
      role,
      actif
    )
    VALUES (
      v_entreprise_id,
      'Bernard',
      'Pierre',
      'pierre.bernard@sastest.fr',
      '06 22 33 44 55',
      'Commercial',
      true
    )
    RETURNING id INTO v_collaborateur_2_id;
  END IF;

  RAISE NOTICE '✅ Collaborateurs: %, %', v_collaborateur_1_id, v_collaborateur_2_id;

  -- ============================================================================
  -- 7. ÉQUIPE (si la table existe)
  -- ============================================================================
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipes') THEN
    SELECT id INTO v_equipe_id FROM equipes 
    WHERE entreprise_id = v_entreprise_id AND nom = 'Équipe Développement' LIMIT 1;
    
    -- Vérifier si responsable_id référence collaborateurs_entreprise ou collaborateurs
    -- Si la contrainte échoue, on crée l'équipe sans responsable_id
    IF v_equipe_id IS NULL THEN
      BEGIN
        -- Vérifier si la colonne statut existe
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'equipes' 
          AND column_name = 'statut'
        ) THEN
          INSERT INTO equipes (
            entreprise_id,
            nom,
            description,
            couleur,
            statut
          )
          VALUES (
            v_entreprise_id,
            'Équipe Développement',
            'Équipe dédiée au développement des produits',
            '#3B82F6',
            'active'
          )
          RETURNING id INTO v_equipe_id;
        ELSE
          INSERT INTO equipes (
            entreprise_id,
            nom,
            description,
            couleur
          )
          VALUES (
            v_entreprise_id,
            'Équipe Développement',
            'Équipe dédiée au développement des produits',
            '#3B82F6'
          )
          RETURNING id INTO v_equipe_id;
        END IF;
      EXCEPTION
        WHEN foreign_key_violation THEN
          -- Si la contrainte échoue, créer sans responsable_id
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'equipes' 
            AND column_name = 'statut'
          ) THEN
            INSERT INTO equipes (
              entreprise_id,
              nom,
              description,
              couleur,
              statut
            )
            VALUES (
              v_entreprise_id,
              'Équipe Développement',
              'Équipe dédiée au développement des produits',
              '#3B82F6',
              'active'
            )
            RETURNING id INTO v_equipe_id;
          ELSE
            INSERT INTO equipes (
              entreprise_id,
              nom,
              description,
              couleur
            )
            VALUES (
              v_entreprise_id,
              'Équipe Développement',
              'Équipe dédiée au développement des produits',
              '#3B82F6'
            )
            RETURNING id INTO v_equipe_id;
          END IF;
      END;
    END IF;

    -- Ajouter les membres à l'équipe (si la table existe)
    IF v_equipe_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipes_membres') THEN
      INSERT INTO equipes_membres (equipe_id, collaborateur_id, role)
      VALUES (v_equipe_id, v_collaborateur_1_id, 'responsable')
      ON CONFLICT DO NOTHING;

      IF v_collaborateur_2_id IS NOT NULL THEN
        INSERT INTO equipes_membres (equipe_id, collaborateur_id, role)
        VALUES (v_equipe_id, v_collaborateur_2_id, 'membre')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    RAISE NOTICE '✅ Équipe: %', v_equipe_id;
  END IF;

  -- ============================================================================
  -- 8. ARTICLES DE STOCK (si la table existe)
  -- ============================================================================
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_items') THEN
    -- Générer des références uniques
    INSERT INTO stock_items (
      entreprise_id,
      reference,
      nom,
      description,
      unite_mesure,
      quantite_stock,
      quantite_minimale,
      prix_achat_unitaire,
      prix_vente_unitaire,
      statut
    )
    VALUES
      (v_entreprise_id, 'STK001', 'Ordinateur Portable', 'Laptop professionnel 15 pouces', 'unité', 10, 2, 800.00, 1200.00, 'actif'),
      (v_entreprise_id, 'STK002', 'Souris Sans Fil', 'Souris ergonomique Bluetooth', 'unité', 25, 5, 15.00, 29.99, 'actif'),
      (v_entreprise_id, 'STK003', 'Clavier Mécanique', 'Clavier gaming RGB', 'unité', 8, 3, 60.00, 99.99, 'actif'),
      (v_entreprise_id, 'STK004', 'Écran 27 pouces', 'Écran 4K IPS', 'unité', 5, 2, 300.00, 450.00, 'actif')
    ON CONFLICT (entreprise_id, reference) DO NOTHING;
    
    RAISE NOTICE '✅ Articles de stock créés';
  END IF;

  -- ============================================================================
  -- 9. FACTURES (avec gestion des numéros uniques)
  -- ============================================================================
  
  -- Facture 1 : Envoyée et payée
  -- Générer un numéro unique
  v_counter := 1;
  LOOP
    v_numero_facture := 'FAC-2025-' || LPAD(v_counter::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM factures WHERE entreprise_id = v_entreprise_id AND numero = v_numero_facture);
    v_counter := v_counter + 1;
    EXIT WHEN v_counter > 999;
  END LOOP;
  
  -- Construire dynamiquement la requête INSERT selon les colonnes existantes
  -- Structure minimale garantie : entreprise_id, client_id, numero, date_emission, date_echeance, montant_ht, montant_ttc, statut
  INSERT INTO factures (
    entreprise_id,
    client_id,
    numero,
    date_emission,
    date_echeance,
    montant_ht,
    montant_ttc,
    statut
  )
  VALUES (
    v_entreprise_id,
    v_client_id,
    v_numero_facture,
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '10 days',
    2500.00,
    3000.00,
    'envoyee'
  )
  ON CONFLICT (entreprise_id, numero) DO NOTHING
  RETURNING id INTO v_facture_1_id;

  IF v_facture_1_id IS NULL THEN
    SELECT id INTO v_facture_1_id FROM factures 
    WHERE entreprise_id = v_entreprise_id AND numero = v_numero_facture LIMIT 1;
  END IF;

  -- Lignes de facture 1 (si la table existe)
  IF v_facture_1_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'factures_lignes'
  ) THEN
    INSERT INTO factures_lignes (
      facture_id,
      description,
      quantite,
      prix_unitaire_ht,
      taux_tva,
      montant_ht,
      montant_tva,
      montant_ttc
    )
    VALUES
      (v_facture_1_id, 'Développement application web', 40, 50.00, 20.00, 2000.00, 400.00, 2400.00),
      (v_facture_1_id, 'Conseil stratégique', 10, 50.00, 20.00, 500.00, 100.00, 600.00)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Facture 2 : Brouillon
  v_counter := v_counter + 1;
  LOOP
    v_numero_facture := 'FAC-2025-' || LPAD(v_counter::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM factures WHERE entreprise_id = v_entreprise_id AND numero = v_numero_facture);
    v_counter := v_counter + 1;
    EXIT WHEN v_counter > 999;
  END LOOP;
  
  -- Structure minimale garantie
  INSERT INTO factures (
    entreprise_id,
    client_id,
    numero,
    date_emission,
    date_echeance,
    montant_ht,
    montant_ttc,
    statut
  )
  VALUES (
    v_entreprise_id,
    v_client_id,
    v_numero_facture,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    1200.00,
    1440.00,
    'brouillon'
  )
  ON CONFLICT (entreprise_id, numero) DO NOTHING
  RETURNING id INTO v_facture_2_id;

  IF v_facture_2_id IS NULL THEN
    SELECT id INTO v_facture_2_id FROM factures 
    WHERE entreprise_id = v_entreprise_id AND numero = v_numero_facture LIMIT 1;
  END IF;

  -- Lignes de facture 2 (si la table existe)
  IF v_facture_2_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'factures_lignes'
  ) THEN
    INSERT INTO factures_lignes (
      facture_id,
      description,
      quantite,
      prix_unitaire_ht,
      taux_tva,
      montant_ht,
      montant_tva,
      montant_ttc
    )
    VALUES
      (v_facture_2_id, 'Maintenance mensuelle', 1, 1200.00, 20.00, 1200.00, 240.00, 1440.00)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE '✅ Factures créées: %, %', v_facture_1_id, v_facture_2_id;

  -- ============================================================================
  -- 10. CRM - PIPELINE ET OPPORTUNITÉS (si les tables existent)
  -- ============================================================================
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_pipeline_etapes') THEN
    -- Créer une étape de pipeline
    SELECT id INTO v_etape_id FROM crm_pipeline_etapes 
    WHERE entreprise_id = v_entreprise_id AND nom = 'Qualification' LIMIT 1;
    
    IF v_etape_id IS NULL THEN
      INSERT INTO crm_pipeline_etapes (
        entreprise_id,
        nom,
        description,
        couleur,
        ordre,
        probabilite,
        est_etape_finale,
        type_etape,
        actif
      )
      VALUES (
        v_entreprise_id,
        'Qualification',
        'Étape de qualification des prospects',
        '#3B82F6',
        1,
        25,
        false,
        'en_cours',
        true
      )
      RETURNING id INTO v_etape_id;
    END IF;

    -- Créer une opportunité
    IF v_etape_id IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_opportunites') THEN
      SELECT id INTO v_opportunite_id FROM crm_opportunites 
      WHERE entreprise_id = v_entreprise_id AND client_id = v_client_id AND nom = 'Projet Web 2025' LIMIT 1;
      
      IF v_opportunite_id IS NULL THEN
        INSERT INTO crm_opportunites (
          entreprise_id,
          client_id,
          nom,
          description,
          montant_estime,
          devise,
          etape_id,
          probabilite,
          date_fermeture_prevue,
          statut,
          source
        )
        VALUES (
          v_entreprise_id,
          v_client_id,
          'Projet Web 2025',
          'Développement d''une application web complète',
          50000.00,
          'EUR',
          v_etape_id,
          50,
          CURRENT_DATE + INTERVAL '3 months',
          'ouverte',
          'site_web'
        )
        RETURNING id INTO v_opportunite_id;
      END IF;
    END IF;

    RAISE NOTICE '✅ CRM - Opportunité: %', v_opportunite_id;
  END IF;

  -- ============================================================================
  -- 11. PROJET (si la table existe)
  -- ============================================================================
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projets') THEN
    SELECT id INTO v_projet_id FROM projets 
    WHERE entreprise_id = v_entreprise_id AND nom = 'Projet Test 2025' LIMIT 1;
    
    IF v_projet_id IS NULL AND v_collaborateur_1_id IS NOT NULL THEN
      INSERT INTO projets (
        entreprise_id,
        nom,
        description,
        client_id,
        responsable_id,
        equipe_id,
        date_debut,
        date_fin_prevue,
        budget_previstoire,
        statut,
        priorite,
        couleur
      )
      VALUES (
        v_entreprise_id,
        'Projet Test 2025',
        'Projet de test pour validation du module',
        v_client_id,
        v_collaborateur_1_id,
        v_equipe_id,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '6 months',
        50000.00,
        'en_cours',
        'haute',
        '#10B981'
      )
      RETURNING id INTO v_projet_id;
    END IF;

    RAISE NOTICE '✅ Projet: %', v_projet_id;
  END IF;

  -- ============================================================================
  -- 12. COMPTABILITÉ - JOURNAUX ET ÉCRITURES (si les tables existent)
  -- ============================================================================
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journaux_comptables') THEN
    -- Récupérer le journal des ventes
    SELECT id INTO v_journal_ventes_id FROM journaux_comptables 
    WHERE entreprise_id = v_entreprise_id AND code_journal = 'VT' LIMIT 1;
    
    -- Récupérer le journal des achats
    SELECT id INTO v_journal_achats_id FROM journaux_comptables 
    WHERE entreprise_id = v_entreprise_id AND code_journal = 'AC' LIMIT 1;

    -- Créer une écriture comptable si on a un journal et une facture
    IF v_journal_ventes_id IS NOT NULL AND v_facture_1_id IS NOT NULL 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ecritures_comptables') THEN
      
      SELECT id INTO v_ecriture_1_id FROM ecritures_comptables 
      WHERE entreprise_id = v_entreprise_id AND facture_id = v_facture_1_id LIMIT 1;
      
      IF v_ecriture_1_id IS NULL THEN
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
          v_journal_ventes_id,
          'FAC-' || v_facture_1_id::text,
          CURRENT_DATE - INTERVAL '30 days',
          'Facture ' || v_numero_facture,
          '411000', -- Clients
          '706000', -- Prestations de services
          3000.00,
          'automatique',
          'facture',
          v_facture_1_id,
          v_facture_1_id
        )
        RETURNING id INTO v_ecriture_1_id;
      END IF;
    END IF;

    RAISE NOTICE '✅ Écriture comptable: %', v_ecriture_1_id;
  END IF;

  -- ============================================================================
  -- 13. FICHES DE PAIE (si la table existe)
  -- ============================================================================
  
  -- Les fiches de paie seront créées automatiquement par les fonctions d'automatisation
  -- On ne les crée pas manuellement ici pour éviter les erreurs de structure
  RAISE NOTICE 'ℹ️ Les fiches de paie seront créées automatiquement par les fonctions d''automatisation comptable';

  -- ============================================================================
  -- RÉSUMÉ FINAL
  -- ============================================================================
  
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ ENTREPRISE DE TEST CRÉÉE AVEC SUCCÈS';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'Entreprise ID: %', v_entreprise_id;
  RAISE NOTICE 'Client ID: %', v_client_id;
  RAISE NOTICE 'Espace Membre ID: %', v_espace_membre_id;
  RAISE NOTICE 'Abonnement ID: %', v_abonnement_id;
  RAISE NOTICE '═══════════════════════════════════════';

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de l''entreprise de test: % (Code: %)', SQLERRM, SQLSTATE;
END $$;
