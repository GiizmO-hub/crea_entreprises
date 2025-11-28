/*
  # Corriger et s'assurer que le trigger fonctionne correctement
  
  Le trigger doit se déclencher quand un paiement passe à 'paye'
  et créer automatiquement facture + abonnement + espace client
*/

-- Supprimer l'ancien trigger et fonction
DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;
DROP FUNCTION IF EXISTS trigger_creer_facture_abonnement_apres_paiement() CASCADE;

-- Recréer la fonction du trigger
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
      v_methode_paiement := NEW.methode_paiement;
      
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
          -- Ne pas bloquer le trigger en cas d'erreur
        ELSE
          RAISE NOTICE '✅ Facture et abonnement créés automatiquement pour entreprise % (méthode: %)', NEW.entreprise_id, v_methode_paiement;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Exception lors de la création automatique: %', SQLERRM;
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
  WHEN (NEW.statut = 'paye' AND (OLD.statut IS NULL OR OLD.statut != 'paye') AND NEW.entreprise_id IS NOT NULL)
  EXECUTE FUNCTION trigger_creer_facture_abonnement_apres_paiement();

-- Vérifier que le trigger est bien créé
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
    AND tgrelid = 'paiements'::regclass
  ) THEN
    RAISE NOTICE '✅ Trigger créé avec succès';
  ELSE
    RAISE WARNING '❌ Le trigger n''a pas été créé';
  END IF;
END $$;




