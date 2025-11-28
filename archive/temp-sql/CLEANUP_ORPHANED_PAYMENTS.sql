-- ============================================================================
-- NETTOYAGE DES PAIEMENTS ORPHELINS
-- ============================================================================
-- 
-- Ce script identifie et supprime les paiements en attente qui sont liés
-- à des entreprises qui n'existent plus dans la base de données.
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1 : IDENTIFIER LES PAIEMENTS ORPHELINS
-- ============================================================================

-- Afficher les paiements orphelins (entreprises n'existant pas)
SELECT 
  p.id as paiement_id,
  p.statut,
  p.montant_ttc,
  p.entreprise_id as entreprise_id_table,
  (p.notes::jsonb->>'entreprise_id')::uuid as entreprise_id_notes,
  (p.notes::jsonb->>'description')::text as description,
  p.created_at,
  CASE 
    WHEN e.id IS NULL THEN '❌ Orphelin'
    ELSE '✅ OK'
  END as statut_entreprise
FROM paiements p
LEFT JOIN entreprises e ON e.id = COALESCE(
  p.entreprise_id,
  (p.notes::jsonb->>'entreprise_id')::uuid
)
WHERE p.statut = 'en_attente'
  AND (
    -- Entreprise ID dans la table n'existe pas
    (p.entreprise_id IS NOT NULL AND e.id IS NULL)
    OR
    -- Entreprise ID dans les notes n'existe pas
    (p.entreprise_id IS NULL 
     AND (p.notes::jsonb->>'entreprise_id')::uuid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM entreprises 
       WHERE id = (p.notes::jsonb->>'entreprise_id')::uuid
     ))
  )
ORDER BY p.created_at DESC;

-- ============================================================================
-- ÉTAPE 2 : COMPTER LES PAIEMENTS ORPHELINS
-- ============================================================================

DO $$
DECLARE
  v_orphan_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Compter les paiements orphelins
  SELECT COUNT(*)
  INTO v_orphan_count
  FROM paiements p
  WHERE p.statut = 'en_attente'
    AND (
      (p.entreprise_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entreprises WHERE id = p.entreprise_id))
      OR
      (p.entreprise_id IS NULL 
       AND (p.notes::jsonb->>'entreprise_id')::uuid IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM entreprises 
         WHERE id = (p.notes::jsonb->>'entreprise_id')::uuid
       ))
    );
  
  -- Compter le total des paiements en attente
  SELECT COUNT(*) INTO v_total_count
  FROM paiements
  WHERE statut = 'en_attente';
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  📊 RAPPORT DE NETTOYAGE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Paiements en attente total: %', v_total_count;
  RAISE NOTICE 'Paiements orphelins: %', v_orphan_count;
  RAISE NOTICE '';
  
  IF v_orphan_count > 0 THEN
    RAISE NOTICE '⚠️  % paiement(s) orphelin(s) détecté(s)', v_orphan_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Ces paiements seront marqués comme "annule" (pas supprimés)';
    RAISE NOTICE 'pour conserver l''historique.';
  ELSE
    RAISE NOTICE '✅ Aucun paiement orphelin détecté';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- ÉTAPE 3 : NETTOYER LES PAIEMENTS ORPHELINS
-- ============================================================================
-- Marquer comme "annule" plutôt que de les supprimer (pour l'historique)

UPDATE paiements
SET 
  statut = 'annule',
  notes = COALESCE(notes::jsonb, '{}'::jsonb) || jsonb_build_object(
    'annulation_reason', 'Entreprise associée n''existe plus',
    'annulation_date', CURRENT_TIMESTAMP::text,
    'cleaned_by', 'CLEANUP_ORPHANED_PAYMENTS.sql'
  )::text,
  updated_at = now()
WHERE statut = 'en_attente'
  AND (
    -- Entreprise ID dans la table n'existe pas
    (entreprise_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM entreprises WHERE id = entreprise_id))
    OR
    -- Entreprise ID dans les notes n'existe pas
    (entreprise_id IS NULL 
     AND (notes::jsonb->>'entreprise_id')::uuid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM entreprises 
       WHERE id = (notes::jsonb->>'entreprise_id')::uuid
     ))
  );

-- ============================================================================
-- ÉTAPE 4 : VÉRIFICATION FINALE
-- ============================================================================

SELECT 
  COUNT(*) as paiements_orphelins_restants
FROM paiements p
WHERE p.statut = 'en_attente'
  AND (
    (p.entreprise_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entreprises WHERE id = p.entreprise_id))
    OR
    (p.entreprise_id IS NULL 
     AND (p.notes::jsonb->>'entreprise_id')::uuid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM entreprises 
       WHERE id = (p.notes::jsonb->>'entreprise_id')::uuid
     ))
  );

-- ============================================================================
-- RÉSUMÉ FINAL
-- ============================================================================

SELECT 
  statut,
  COUNT(*) as nombre
FROM paiements
GROUP BY statut
ORDER BY statut;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

SELECT '✅ Nettoyage terminé !' as resultat;

