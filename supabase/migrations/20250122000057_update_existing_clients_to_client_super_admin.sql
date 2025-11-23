/*
  # Mise à jour des clients existants avec rôle super_admin vers client_super_admin
  
  Cette migration met à jour tous les clients qui ont actuellement le rôle 'super_admin'
  pour qu'ils aient le rôle 'client_super_admin' à la place.
  
  Cela permet de distinguer clairement :
  - Les super_admin de la plateforme (role = 'super_admin')
  - Les clients super_admin de leur espace (role = 'client_super_admin')
*/

-- Mettre à jour tous les clients qui ont le rôle 'super_admin' vers 'client_super_admin'
UPDATE utilisateurs u
SET role = 'client_super_admin',
    updated_at = NOW()
WHERE u.role = 'super_admin'
  AND EXISTS (
    SELECT 1
    FROM espaces_membres_clients emc
    WHERE emc.user_id = u.id
  );

-- Afficher le nombre de clients mis à jour
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM utilisateurs u
  WHERE u.role = 'client_super_admin'
    AND EXISTS (
      SELECT 1
      FROM espaces_membres_clients emc
      WHERE emc.user_id = u.id
    );
  
  RAISE NOTICE '✅ % client(s) avec le rôle client_super_admin', v_count;
END;
$$;

COMMENT ON FUNCTION toggle_client_super_admin IS 'Mise à jour des clients existants : les clients avec role=super_admin sont maintenant client_super_admin pour distinguer des super_admin plateforme.';

