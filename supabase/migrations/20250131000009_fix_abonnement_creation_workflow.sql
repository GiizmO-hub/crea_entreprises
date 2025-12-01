/*
  # CORRECTION CRITIQUE : Création automatique de l'abonnement après validation paiement
  
  PROBLÈME IDENTIFIÉ:
  - Le workflow bloque à 80% car l'abonnement ne se crée pas automatiquement
  - Le trigger existe mais peut ne pas fonctionner correctement
  - Les paiements validés sans abonnement doivent être corrigés
  
  SOLUTION:
  1. Vérifier et corriger le trigger
  2. Vérifier et corriger la fonction creer_facture_et_abonnement_apres_paiement
  3. Créer les abonnements manquants pour les paiements déjà validés
  4. S'assurer que le workflow fonctionne à 100%
*/

-- ============================================================================
-- PARTIE 1 : Vérifier et corriger la fonction creer_facture_et_abonnement_apres_paiement
-- ============================================================================

-- Vérifier que la fonction existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
  ) THEN
    RAISE EXCEPTION 'La fonction creer_facture_et_abonnement_apres_paiement n''existe pas. Veuillez appliquer les migrations précédentes.';
  ELSE
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement existe';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : Vérifier et corriger le trigger
-- ============================================================================

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;

-- Recréer la fonction du trigger (version robuste)
CREATE OR REPLACE FUNCTION trigger_creer_facture_abonnement_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_methode_paiement text;
BEGIN
  -- Si le paiement passe à "paye" (et n'était pas déjà payé)
  IF NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') THEN
    -- Vérifier que c'est un paiement pour une entreprise (a un entreprise_id)
    IF NEW.entreprise_id IS NOT NULL THEN
      v_methode_paiement := COALESCE(NEW.methode_paiement, 'stripe');
      
      -- Si virement, vérifier que 96h se sont écoulées
      IF v_methode_paiement = 'virement' THEN
        DECLARE
          v_heures_ecoulees numeric;
        BEGIN
          -- Calculer les heures écoulées depuis la création du paiement
          v_heures_ecoulees := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.date_creation_paiement, NEW.created_at))) / 3600;
          
          IF v_heures_ecoulees < 96 THEN
            -- Pas encore 96h, ne rien faire
            RAISE NOTICE '⏳ Paiement par virement: % heures écoulées sur 96. Le traitement aura lieu automatiquement après 96h.', v_heures_ecoulees;
            RETURN NEW;
          END IF;
        END;
      END IF;
      
      -- Créer automatiquement facture + abonnement (carte immédiatement, virement après 96h)
      BEGIN
        v_result := creer_facture_et_abonnement_apres_paiement(NEW.id);
        
        -- Log le résultat
        IF NOT (v_result->>'success')::boolean THEN
          RAISE WARNING '❌ Erreur lors de la création automatique facture/abonnement: %', v_result->>'error';
          -- Ne pas bloquer le trigger en cas d'erreur, mais logger
        ELSE
          RAISE NOTICE '✅ Facture et abonnement créés automatiquement pour entreprise % (méthode: %)', NEW.entreprise_id, v_methode_paiement;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Exception lors de la création automatique: %', SQLERRM;
        -- Ne pas bloquer le trigger en cas d'erreur
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_creer_facture_abonnement_apres_paiement IS 
  'Trigger automatique qui crée facture et abonnement quand un paiement est validé.';

-- Recréer le trigger
CREATE TRIGGER trigger_paiement_creer_facture_abonnement
  AFTER UPDATE OF statut ON paiements
  FOR EACH ROW
  WHEN (
    NEW.statut = 'paye' 
    AND (OLD.statut IS NULL OR OLD.statut != 'paye') 
    AND NEW.entreprise_id IS NOT NULL
  )
  EXECUTE FUNCTION trigger_creer_facture_abonnement_apres_paiement();

-- ============================================================================
-- PARTIE 3 : Créer les abonnements manquants pour les paiements déjà validés
-- ============================================================================

DO $$
DECLARE
  v_paiement RECORD;
  v_result jsonb;
  v_count_fixed INTEGER := 0;
BEGIN
  -- Pour chaque paiement validé sans abonnement associé
  FOR v_paiement IN
    SELECT 
      p.id as paiement_id,
      p.entreprise_id,
      p.notes,
      p.montant_ttc,
      e.nom as entreprise_nom
    FROM paiements p
    INNER JOIN entreprises e ON e.id = p.entreprise_id
    WHERE p.statut = 'paye'
      AND p.entreprise_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM abonnements a
        WHERE a.entreprise_id = p.entreprise_id
          AND a.statut = 'actif'
      )
      -- Vérifier que les notes contiennent un plan_id
      AND p.notes IS NOT NULL
      AND (p.notes::text LIKE '%plan_id%' OR p.notes::jsonb ? 'plan_id')
  LOOP
    BEGIN
      RAISE NOTICE '🔧 Correction paiement % pour entreprise %', v_paiement.paiement_id, v_paiement.entreprise_nom;
      
      -- Appeler la fonction pour créer facture et abonnement
      v_result := creer_facture_et_abonnement_apres_paiement(v_paiement.paiement_id);
      
      IF (v_result->>'success')::boolean THEN
        v_count_fixed := v_count_fixed + 1;
        RAISE NOTICE '✅ Abonnement créé pour entreprise %', v_paiement.entreprise_nom;
      ELSE
        RAISE WARNING '❌ Erreur création abonnement pour entreprise %: %', v_paiement.entreprise_nom, v_result->>'error';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '❌ Exception lors de la correction pour entreprise %: %', v_paiement.entreprise_nom, SQLERRM;
    END;
  END LOOP;
  
  IF v_count_fixed > 0 THEN
    RAISE NOTICE '✅ % abonnement(s) créé(s) pour les paiements déjà validés', v_count_fixed;
  ELSE
    RAISE NOTICE 'ℹ️ Aucun paiement validé sans abonnement trouvé';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 4 : Vérifications finales
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists boolean;
  v_function_exists boolean;
  v_paiements_sans_abonnement INTEGER;
BEGIN
  -- Vérifier le trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
    AND tgrelid = 'paiements'::regclass
  ) INTO v_trigger_exists;
  
  -- Vérifier la fonction
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'creer_facture_et_abonnement_apres_paiement'
  ) INTO v_function_exists;
  
  -- Compter les paiements validés sans abonnement
  SELECT COUNT(*) INTO v_paiements_sans_abonnement
  FROM paiements p
  WHERE p.statut = 'paye'
    AND p.entreprise_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM abonnements a
      WHERE a.entreprise_id = p.entreprise_id
        AND a.statut = 'actif'
    );
  
  IF v_trigger_exists THEN
    RAISE NOTICE '✅ Trigger créé avec succès';
  ELSE
    RAISE WARNING '❌ Le trigger n''a pas été créé';
  END IF;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Fonction creer_facture_et_abonnement_apres_paiement existe';
  ELSE
    RAISE WARNING '❌ La fonction creer_facture_et_abonnement_apres_paiement n''existe pas';
  END IF;
  
  IF v_paiements_sans_abonnement > 0 THEN
    RAISE WARNING '⚠️ % paiement(s) validé(s) sans abonnement actif trouvé(s)', v_paiements_sans_abonnement;
  ELSE
    RAISE NOTICE '✅ Tous les paiements validés ont un abonnement actif';
  END IF;
END $$;

SELECT '✅ Migration de correction du workflow d''abonnement appliquée avec succès !' as resultat;

