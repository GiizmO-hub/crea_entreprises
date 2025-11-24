-- ⚠️ ATTENTION : Ce script supprime TOUS les utilisateurs auth.users SAUF le super admin
-- À utiliser avec précaution !

-- 1. D'abord, identifier votre email super admin
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'super_admin'
   OR raw_user_meta_data->>'role' = 'admin'
ORDER BY created_at ASC
LIMIT 1;

-- 2. Supprimer TOUS les utilisateurs sauf le super admin
-- ⚠️ REMPLACER 'VOTRE_EMAIL_SUPER_ADMIN' par votre email réel
DELETE FROM auth.users
WHERE email != 'VOTRE_EMAIL_SUPER_ADMIN';  -- ⚠️ MODIFIER ICI

-- 3. Vérifier qu'il ne reste que le super admin
SELECT 
  COUNT(*) as remaining_users,
  STRING_AGG(email, ', ') as emails
FROM auth.users;
