/*
  # VÉRIFICATION ET CORRECTION DU TRIGGER
  
  Problème :
  - Le trigger peut ne pas se déclencher correctement
  - Les factures peuvent ne pas être créées après validation d'un paiement
  
  Solution :
  - Vérifier que le trigger existe et est actif
  - Recréer le trigger si nécessaire
  - S'assurer que la fonction appelée est la bonne version
*/

-- ============================================================================
-- 1. VÉRIFIER L'EXISTENCE DU TRIGGER
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
    AND tgrelid = 'paiements'::regclass
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE NOTICE '✅ Trigger trigger_paiement_creer_facture_abonnement existe';
  ELSE
    RAISE WARNING '❌ Trigger trigger_paiement_creer_facture_abonnement n''existe pas - Création...';
  END IF;
END $$;

-- ============================================================================
-- 2. RECRÉER LE TRIGGER POUR ÊTRE SÛR
-- ============================================================================

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_paiement_creer_facture_abonnement ON paiements;

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
-- 3. VÉRIFIER QUE LE TRIGGER EST BIEN CRÉÉ
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_paiement_creer_facture_abonnement'
    AND tgrelid = 'paiements'::regclass
  ) INTO v_trigger_exists;
  
  IF v_trigger_exists THEN
    RAISE NOTICE '✅ Trigger créé avec succès';
  ELSE
    RAISE WARNING '❌ Le trigger n''a pas été créé';
  END IF;
END $$;

COMMENT ON TRIGGER trigger_paiement_creer_facture_abonnement ON paiements IS 
  'Trigger automatique qui crée facture et abonnement quand un paiement passe à statut=''paye''.';

