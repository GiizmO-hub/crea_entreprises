/*
  # Correction définitive récursion infinie + vérification email
  
  PROBLÈMES:
  1. Récursion infinie dans policies RLS de collaborateurs lors du chargement
  2. Email déjà utilisé lors de la création de collaborateur
  
  SOLUTIONS:
  1. Simplifier les policies RLS pour éviter toute référence circulaire
  2. Vérifier et gérer les emails existants avant création
*/

-- ============================================================================
-- PARTIE 1 : Supprimer toutes les policies existantes sur collaborateurs
-- ============================================================================

DO $$
BEGIN
  -- Supprimer TOUTES les policies sur collaborateurs (si table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaborateurs') THEN
    DROP POLICY IF EXISTS "Users can view collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can insert collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can update collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Users can delete collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Collaborateurs SELECT policy" ON collaborateurs;
    DROP POLICY IF EXISTS "Collaborateurs INSERT policy" ON collaborateurs;
    DROP POLICY IF EXISTS "Collaborateurs UPDATE policy" ON collaborateurs;
    DROP POLICY IF EXISTS "Collaborateurs DELETE policy" ON collaborateurs;
    DROP POLICY IF EXISTS "Propriétaires voient collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Propriétaires créent collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Propriétaires modifient collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Propriétaires suppriment collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Admins can view collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Admins can insert collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Admins can update collaborateurs" ON collaborateurs;
    DROP POLICY IF EXISTS "Admins can delete collaborateurs" ON collaborateurs;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2 : S'assurer que is_admin_user_simple() existe et fonctionne
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_user_simple()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
BEGIN
  -- Vérifier uniquement via auth.users.raw_user_meta_data (pas de récursion)
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'role')::text IN ('super_admin', 'admin')
     FROM auth.users
     WHERE id = auth.uid()),
    false
  );
END;
$$;

COMMENT ON FUNCTION is_admin_user_simple() IS 'Vérifie si l''utilisateur est admin/super_admin (sans récursion, utilise uniquement auth.users)';

GRANT EXECUTE ON FUNCTION is_admin_user_simple() TO authenticated;

-- ============================================================================
-- PARTIE 3 : Fonction pour vérifier si un email existe déjà
-- ============================================================================

CREATE OR REPLACE FUNCTION check_email_exists(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
DECLARE
  v_exists boolean := false;
  v_user_id uuid;
  v_in_clients boolean := false;
  v_in_collaborateurs boolean := false;
  v_in_espaces boolean := false;
BEGIN
  -- Vérifier dans auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
  
  IF v_exists THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
    
    -- Vérifier où cet email est utilisé
    SELECT EXISTS(SELECT 1 FROM clients WHERE email = p_email OR id = v_user_id) INTO v_in_clients;
    SELECT EXISTS(SELECT 1 FROM collaborateurs WHERE email = p_email OR user_id = v_user_id) INTO v_in_collaborateurs;
    SELECT EXISTS(SELECT 1 FROM espaces_membres_clients WHERE email = p_email OR user_id = v_user_id) INTO v_in_espaces;
    
    RETURN jsonb_build_object(
      'exists', true,
      'user_id', v_user_id,
      'in_clients', v_in_clients,
      'in_collaborateurs', v_in_collaborateurs,
      'in_espaces_membres', v_in_espaces,
      'message', format('Cet email est déjà utilisé (client: %s, collaborateur: %s, espace: %s)', 
        v_in_clients, v_in_collaborateurs, v_in_espaces)
    );
  END IF;
  
  RETURN jsonb_build_object('exists', false);
END;
$$;

COMMENT ON FUNCTION check_email_exists(text) IS 'Vérifie si un email existe déjà dans auth.users et où il est utilisé';

GRANT EXECUTE ON FUNCTION check_email_exists(text) TO authenticated;

-- ============================================================================
-- PARTIE 4 : Recréer les policies RLS sur collaborateurs SANS récursion
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaborateurs') THEN
    -- Activer RLS
    ALTER TABLE collaborateurs ENABLE ROW LEVEL SECURITY;
    
    -- Policy SELECT : Simplifiée pour éviter récursion
    CREATE POLICY "Collaborateurs SELECT simple"
      ON collaborateurs
      FOR SELECT
      TO authenticated
      USING (
        -- Cas 1 : Admin/super_admin (vérifié directement via auth.users, pas de récursion)
        is_admin_user_simple()
        OR
        -- Cas 2 : L'utilisateur peut voir son propre profil
        user_id = auth.uid()
        OR
        -- Cas 3 : L'utilisateur peut voir les collaborateurs de ses entreprises
        -- On évite EXISTS sur entreprises pour éviter récursion, on utilise directement une jointure simple
        entreprise_id IN (
          SELECT e.id FROM entreprises e
          WHERE e.user_id = auth.uid()
        )
      );
    
    -- Policy INSERT : Les admins peuvent créer, ou les propriétaires d'entreprise
    CREATE POLICY "Collaborateurs INSERT simple"
      ON collaborateurs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        is_admin_user_simple()
        OR
        entreprise_id IN (
          SELECT e.id FROM entreprises e
          WHERE e.user_id = auth.uid()
        )
      );
    
    -- Policy UPDATE : Les admins peuvent modifier, ou les propriétaires d'entreprise, ou soi-même
    CREATE POLICY "Collaborateurs UPDATE simple"
      ON collaborateurs
      FOR UPDATE
      TO authenticated
      USING (
        is_admin_user_simple()
        OR
        user_id = auth.uid()
        OR
        entreprise_id IN (
          SELECT e.id FROM entreprises e
          WHERE e.user_id = auth.uid()
        )
      )
      WITH CHECK (
        is_admin_user_simple()
        OR
        user_id = auth.uid()
        OR
        entreprise_id IN (
          SELECT e.id FROM entreprises e
          WHERE e.user_id = auth.uid()
        )
      );
    
    -- Policy DELETE : Les admins peuvent supprimer, ou les propriétaires d'entreprise
    CREATE POLICY "Collaborateurs DELETE simple"
      ON collaborateurs
      FOR DELETE
      TO authenticated
      USING (
        is_admin_user_simple()
        OR
        entreprise_id IN (
          SELECT e.id FROM entreprises e
          WHERE e.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- PARTIE 5 : Fonction RPC pour créer un collaborateur avec vérification email
-- ============================================================================

CREATE OR REPLACE FUNCTION create_collaborateur_with_email_check(
  p_email text,
  p_password text,
  p_nom text,
  p_prenom text,
  p_telephone text DEFAULT NULL,
  p_role text DEFAULT 'collaborateur',
  p_entreprise_id uuid DEFAULT NULL,
  p_poste text DEFAULT NULL,
  p_departement text DEFAULT NULL,
  p_date_embauche date DEFAULT NULL,
  p_salaire numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email_check jsonb;
  v_user_id uuid;
  v_collaborateur_id uuid;
  v_password_hash text;
BEGIN
  -- Vérifier que l'utilisateur est admin ou propriétaire de l'entreprise
  IF NOT is_admin_user_simple() THEN
    IF p_entreprise_id IS NULL THEN
      RAISE EXCEPTION 'Accès non autorisé - Admin requis ou entreprise_id requis';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM entreprises
      WHERE id = p_entreprise_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Accès non autorisé - Vous devez être propriétaire de l''entreprise';
    END IF;
  END IF;
  
  -- Vérifier si l'email existe déjà
  SELECT check_email_exists(p_email) INTO v_email_check;
  
  IF (v_email_check->>'exists')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cet email est déjà utilisé',
      'details', v_email_check->>'message',
      'email_check', v_email_check
    );
  END IF;
  
  -- Créer l'utilisateur auth
  -- Note: On ne peut pas créer directement depuis SQL, on doit utiliser l'API admin
  -- Mais on peut créer l'utilisateur via une fonction SECURITY DEFINER qui utilise auth.users
  
  -- Générer le hash du mot de passe
  v_password_hash := crypt(p_password, gen_salt('bf'));
  
  -- Créer l'utilisateur dans auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_password_hash,
    now(),
    jsonb_build_object('role', p_role, 'nom', p_nom, 'prenom', p_prenom),
    jsonb_build_object('provider', 'email'),
    now(),
    now()
  )
  RETURNING id INTO v_user_id;
  
  -- Créer le collaborateur
  INSERT INTO collaborateurs (
    user_id,
    email,
    nom,
    prenom,
    telephone,
    role,
    entreprise_id,
    poste,
    departement,
    date_embauche,
    salaire,
    actif,
    statut
  )
  VALUES (
    v_user_id,
    p_email,
    p_nom,
    p_prenom,
    p_telephone,
    p_role,
    p_entreprise_id,
    p_poste,
    p_departement,
    p_date_embauche,
    p_salaire,
    true,
    'actif'
  )
  RETURNING id INTO v_collaborateur_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Collaborateur créé avec succès',
    'collaborateur_id', v_collaborateur_id,
    'user_id', v_user_id,
    'email', p_email
  );
  
EXCEPTION
  WHEN unique_violation THEN
    -- Si l'email existe déjà (double vérification)
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cet email est déjà utilisé',
      'details', 'L''email existe déjà dans la base de données'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION create_collaborateur_with_email_check IS 'Crée un collaborateur avec vérification de l''email existant. Retourne une erreur claire si l''email est déjà utilisé.';

GRANT EXECUTE ON FUNCTION create_collaborateur_with_email_check TO authenticated;




