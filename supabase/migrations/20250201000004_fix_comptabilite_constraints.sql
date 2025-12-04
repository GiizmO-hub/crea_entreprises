/*
  # Correction des contraintes pour le module Comptabilité
  
  Cette migration ajoute les contraintes manquantes après la création des tables.
*/

-- Ajouter la contrainte unique pour fiches de paie (en tenant compte des NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fiches_paie' 
    AND column_name = 'collaborateur_id'
  ) THEN
    -- Supprimer l'index s'il existe déjà
    DROP INDEX IF EXISTS idx_fiches_paie_unique;
    
    -- Créer l'index unique partiel (uniquement pour les fiches avec collaborateur_id)
    -- Utiliser periode_debut au lieu de periode (qui n'existe pas)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'fiches_paie' 
      AND column_name = 'periode_debut'
    ) THEN
      CREATE UNIQUE INDEX idx_fiches_paie_unique 
      ON fiches_paie(entreprise_id, collaborateur_id, periode_debut) 
      WHERE collaborateur_id IS NOT NULL;
    END IF;
  END IF;
END $$;

