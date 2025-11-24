/*
  # Vérification du schéma de la table entreprises
  
  PROBLÈME:
  - L'erreur "column user_id does not exist" suggère que la colonne n'existe pas
  - Il faut vérifier la structure réelle de la table
  
  SOLUTION:
  - Vérifier si user_id existe
  - Si oui, créer un index si nécessaire
  - Si non, documenter comment filtrer les entreprises
*/

-- Vérifier la structure de la table entreprises
DO $$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'entreprises';
  
  RAISE NOTICE '📋 Colonnes de la table entreprises: %', v_columns;
  
  -- Vérifier spécifiquement si user_id existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entreprises'
      AND column_name = 'user_id'
  ) THEN
    RAISE NOTICE '✅ La colonne user_id EXISTE dans entreprises';
  ELSE
    RAISE NOTICE '❌ La colonne user_id N''EXISTE PAS dans entreprises';
  END IF;
END $$;

