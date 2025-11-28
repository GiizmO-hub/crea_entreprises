/*
  # Fix: Erreur "query returned more than one row" dans get_client_abonnement_details
  
  PROBLÈME:
  - La fonction get_client_abonnement_details utilise SELECT ... INTO avec un JOIN
  - Le JOIN avec clients peut retourner plusieurs lignes si plusieurs clients ont la même entreprise_id
  - Même avec LIMIT 1, PostgreSQL peut lever une erreur "more than one row"
  
  SOLUTION:
  - Utiliser MAX() ou une agrégation pour garantir une seule ligne
  - Utiliser une sous-requête plus stricte
*/

CREATE OR REPLACE FUNCTION get_client_abonnement_details(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_result jsonb;
  v_abonnement_id uuid;
BEGIN
  -- Trouver l'abonnement via l'entreprise du client
  -- Utiliser MAX pour garantir une seule valeur
  SELECT MAX(a.id) INTO v_abonnement_id
  FROM abonnements a
  JOIN clients c ON c.entreprise_id = a.entreprise_id
  WHERE c.id = p_client_id
    AND a.statut = 'actif'
  ORDER BY a.created_at DESC
  LIMIT 1;
  
  -- Si aucun abonnement trouvé, retourner un objet vide
  IF v_abonnement_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Construire le résultat avec l'abonnement trouvé
  SELECT jsonb_build_object(
    'abonnement', row_to_json(a.*),
    'plan', row_to_json(p.*),
    'options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', os.id,
          'code', os.code,
          'nom', os.nom,
          'description', os.description,
          'prix_mensuel', os.prix_mensuel,
          'type', os.type,
          'date_activation', ao.date_activation,
          'actif', ao.actif
        )
      )
      FROM abonnement_options ao
      JOIN options_supplementaires os ON os.id = ao.option_id
      WHERE ao.abonnement_id = a.id AND ao.actif = true
    ), '[]'::jsonb)
  ) INTO v_result
  FROM abonnements a
  LEFT JOIN plans_abonnement p ON p.id = a.plan_id
  WHERE a.id = v_abonnement_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_client_abonnement_details IS 'Récupère l''abonnement complet d''un client avec plan et options - CORRIGÉ pour éviter "more than one row"';


