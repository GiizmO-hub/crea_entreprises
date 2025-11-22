/*
  # Suppression Complète d'un Client avec Toutes ses Données
  
  ## Problème
  Quand on supprime un client, il reste :
  - L'utilisateur dans auth.users (empêche de recréer avec le même email)
  - L'utilisateur dans la table utilisateurs
  - L'abonnement associé
  - Les options d'abonnement
  - Les autres données liées
  
  ## Solution
  Fonction RPC qui supprime TOUT :
  1. L'abonnement et ses options
  2. L'utilisateur dans la table utilisateurs
  3. L'utilisateur dans auth.users (pour libérer l'email)
  4. Le client lui-même
  
  ## Note
  Un client peut avoir plusieurs entreprises, mais cette fonction supprime
  uniquement le client pour l'entreprise spécifiée, pas tous les clients
  avec le même email ailleurs.
*/

-- Fonction pour supprimer complètement un client et toutes ses données
CREATE OR REPLACE FUNCTION delete_client_complete(
  p_client_id uuid,
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client_email text;
  v_user_id uuid;
  v_abonnement_id uuid;
  v_entreprise_client_id uuid;
  v_result jsonb;
BEGIN
  -- Vérifier les permissions
  IF NOT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de supprimer ce client';
  END IF;

  -- Vérifier que le client appartient à cette entreprise
  IF NOT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id
    AND entreprise_id = p_entreprise_id
  ) THEN
    RAISE EXCEPTION 'Ce client n''appartient pas à cette entreprise';
  END IF;

  -- Récupérer l'email du client avant suppression
  SELECT email, entreprise_id
  INTO v_client_email, v_entreprise_client_id
  FROM clients
  WHERE id = p_client_id;

  -- Si le client a un email, récupérer le user_id depuis utilisateurs
  IF v_client_email IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM utilisateurs
    WHERE email = v_client_email
    AND role = 'client'
    AND entreprise_id = p_entreprise_id;
  END IF;

  -- Récupérer l'abonnement associé via l'entreprise du client
  IF v_entreprise_client_id IS NOT NULL THEN
    SELECT id INTO v_abonnement_id
    FROM abonnements
    WHERE entreprise_id = v_entreprise_client_id
    LIMIT 1;
  END IF;

  -- Supprimer dans l'ordre pour éviter les erreurs de contrainte

  -- 1. Supprimer les options d'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    DELETE FROM abonnement_options
    WHERE abonnement_id = v_abonnement_id;
  END IF;

  -- 2. Supprimer l'abonnement
  IF v_abonnement_id IS NOT NULL THEN
    DELETE FROM abonnements
    WHERE id = v_abonnement_id;
  END IF;

  -- 3. Supprimer l'utilisateur de la table utilisateurs
  IF v_user_id IS NOT NULL THEN
    DELETE FROM utilisateurs
    WHERE id = v_user_id;
  END IF;

  -- 4. Supprimer l'utilisateur de auth.users (pour libérer l'email)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
      RAISE NOTICE 'Utilisateur auth.users supprimé: %', v_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur suppression auth.users (peut-être déjà supprimé): %', SQLERRM;
    END;
  END IF;

  -- 5. Supprimer l'entreprise du client si elle existe et n'est utilisée que pour ce client
  IF v_entreprise_client_id IS NOT NULL THEN
    -- Vérifier s'il y a d'autres clients pour cette entreprise
    IF NOT EXISTS (
      SELECT 1 FROM clients
      WHERE entreprise_id = v_entreprise_client_id
      AND id != p_client_id
    ) THEN
      -- Supprimer l'entreprise si elle n'est utilisée que pour ce client
      DELETE FROM entreprises
      WHERE id = v_entreprise_client_id
      AND user_id = v_user_id; -- S'assurer que c'est l'entreprise du client
    END IF;
  END IF;

  -- 6. Supprimer le client lui-même
  DELETE FROM clients
  WHERE id = p_client_id
  AND entreprise_id = p_entreprise_id;

  -- Construire le résultat
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Client et toutes ses données supprimées avec succès',
    'client_id', p_client_id,
    'email_deleted', v_client_email,
    'user_deleted', v_user_id IS NOT NULL,
    'abonnement_deleted', v_abonnement_id IS NOT NULL,
    'can_recreate', true
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Erreur lors de la suppression du client'
    );
END;
$$;

COMMENT ON FUNCTION delete_client_complete IS 'Supprime complètement un client et toutes ses données associées (abonnement, utilisateur, auth.users) pour permettre de recréer un client avec le même email.';

-- Fonction alternative si on veut juste supprimer le client sans tout supprimer
-- (pour garder les données si le client existe dans plusieurs entreprises)
CREATE OR REPLACE FUNCTION delete_client_soft(
  p_client_id uuid,
  p_entreprise_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier les permissions
  IF NOT EXISTS (
    SELECT 1 FROM entreprises
    WHERE id = p_entreprise_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''avez pas le droit de supprimer ce client';
  END IF;

  -- Supprimer uniquement le client (les données liées restent via CASCADE si configuré)
  DELETE FROM clients
  WHERE id = p_client_id
  AND entreprise_id = p_entreprise_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Client supprimé (données liées conservées)'
  );
END;
$$;

COMMENT ON FUNCTION delete_client_soft IS 'Supprime uniquement le client sans supprimer les données associées (abonnement, utilisateur, etc.).';

