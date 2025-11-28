/*
  # CORRECTION : Mettre à jour statut_paiement et vérifier l'affichage des rôles
  
  Problème 1 :
  - statut_paiement dans entreprises est "non_requis" alors qu'il y a un paiement payé
  - Il faut mettre à jour le statut_paiement basé sur les paiements réels
  
  Problème 2 :
  - Le role_code est correct dans clients_with_roles mais l'affichage peut nécessiter une vérification
  - S'assurer que le statut est bien synchronisé
*/

-- ========================================
-- Fonction pour mettre à jour statut_paiement
-- ========================================

CREATE OR REPLACE FUNCTION mettre_a_jour_statut_paiement_entreprise()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_entreprise RECORD;
  v_statut_paiement text;
BEGIN
  RAISE NOTICE '[mettre_a_jour_statut_paiement_entreprise] 🚀 DÉBUT mise à jour statut_paiement';
  
  -- Parcourir toutes les entreprises
  FOR v_entreprise IN
    SELECT DISTINCT e.id, e.nom, e.statut_paiement
    FROM entreprises e
  LOOP
    -- Déterminer le statut basé sur les paiements
    SELECT 
      CASE 
        WHEN COUNT(*) FILTER (WHERE p.statut = 'paye') > 0 THEN 'paye'
        WHEN COUNT(*) FILTER (WHERE p.statut = 'en_attente') > 0 THEN 'en_attente'
        WHEN COUNT(*) FILTER (WHERE p.statut = 'echec') > 0 THEN 'refuse'
        WHEN COUNT(*) = 0 THEN 'non_requis'
        ELSE COALESCE(v_entreprise.statut_paiement, 'non_requis')
      END
    INTO v_statut_paiement
    FROM paiements p
    WHERE p.entreprise_id = v_entreprise.id;
    
    -- Si pas de paiements, vérifier les abonnements
    IF v_statut_paiement IS NULL THEN
      SELECT 
        CASE 
          WHEN COUNT(*) FILTER (WHERE a.statut = 'actif') > 0 THEN 'paye'
          ELSE 'non_requis'
        END
      INTO v_statut_paiement
      FROM abonnements a
      WHERE a.entreprise_id = v_entreprise.id;
    END IF;
    
    -- Valeur par défaut si toujours NULL
    v_statut_paiement := COALESCE(v_statut_paiement, 'non_requis');
    
    -- Mettre à jour si différent
    IF v_statut_paiement != COALESCE(v_entreprise.statut_paiement, 'non_requis') THEN
      UPDATE entreprises
      SET statut_paiement = v_statut_paiement
      WHERE id = v_entreprise.id;
      
      RAISE NOTICE '[mettre_a_jour_statut_paiement_entreprise] ✅ Entreprise %: % → %', 
        v_entreprise.nom, 
        COALESCE(v_entreprise.statut_paiement, 'NULL'), 
        v_statut_paiement;
    ELSE
      RAISE NOTICE '[mettre_a_jour_statut_paiement_entreprise] ℹ️  Entreprise %: statut_paiement déjà à jour (%)', 
        v_entreprise.nom, 
        v_statut_paiement;
    END IF;
  END LOOP;
  
  RAISE NOTICE '[mettre_a_jour_statut_paiement_entreprise] ✅ TERMINÉ';
END;
$$;

-- ========================================
-- Appeler la fonction maintenant
-- ========================================

SELECT mettre_a_jour_statut_paiement_entreprise();

-- ========================================
-- Créer un trigger pour mettre à jour automatiquement statut_paiement
-- ========================================

CREATE OR REPLACE FUNCTION trigger_update_statut_paiement_entreprise()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_statut_paiement text;
BEGIN
  -- Déterminer le nouveau statut basé sur les paiements
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE statut = 'paye') > 0 THEN 'paye'
      WHEN COUNT(*) FILTER (WHERE statut = 'en_attente') > 0 THEN 'en_attente'
      WHEN COUNT(*) FILTER (WHERE statut = 'echec') > 0 THEN 'refuse'
      ELSE 'non_requis'
    END
  INTO v_statut_paiement
  FROM paiements
  WHERE entreprise_id = COALESCE(NEW.entreprise_id, OLD.entreprise_id);
  
  -- Si pas de paiements, vérifier les abonnements
  IF v_statut_paiement IS NULL OR v_statut_paiement = 'non_requis' THEN
    SELECT 
      CASE 
        WHEN COUNT(*) FILTER (WHERE statut = 'actif') > 0 THEN 'paye'
        ELSE v_statut_paiement
      END
    INTO v_statut_paiement
    FROM abonnements
    WHERE entreprise_id = COALESCE(NEW.entreprise_id, OLD.entreprise_id);
  END IF;
  
  -- Valeur par défaut
  v_statut_paiement := COALESCE(v_statut_paiement, 'non_requis');
  
  -- Mettre à jour l'entreprise
  UPDATE entreprises
  SET statut_paiement = v_statut_paiement
  WHERE id = COALESCE(NEW.entreprise_id, OLD.entreprise_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Supprimer les anciens triggers s'ils existent
DROP TRIGGER IF EXISTS trigger_update_statut_paiement_on_paiement ON paiements;
DROP TRIGGER IF EXISTS trigger_update_statut_paiement_on_abonnement ON abonnements;

-- Créer les triggers
CREATE TRIGGER trigger_update_statut_paiement_on_paiement
  AFTER INSERT OR UPDATE OR DELETE ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_statut_paiement_entreprise();

CREATE TRIGGER trigger_update_statut_paiement_on_abonnement
  AFTER INSERT OR UPDATE OR DELETE ON abonnements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_statut_paiement_entreprise();

COMMENT ON FUNCTION mettre_a_jour_statut_paiement_entreprise IS 
  'Met à jour le statut_paiement de toutes les entreprises basé sur les paiements et abonnements réels.';

COMMENT ON FUNCTION trigger_update_statut_paiement_entreprise IS 
  'Déclencheur automatique pour mettre à jour statut_paiement lorsqu''un paiement ou abonnement change.';

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20250129000033 appliquée';
  RAISE NOTICE '📋 Fonction mettre_a_jour_statut_paiement_entreprise créée et exécutée';
  RAISE NOTICE '📋 Triggers créés pour mise à jour automatique';
END $$;

