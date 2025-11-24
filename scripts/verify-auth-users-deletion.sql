-- Script pour vérifier pourquoi vous pouvez toujours vous connecter

-- 1. Compter les utilisateurs dans auth.users
SELECT 
  'auth.users' as table_name,
  COUNT(*) as total,
  COUNT(DISTINCT email) as unique_emails
FROM auth.users;

-- 2. Lister TOUS les utilisateurs dans auth.users (la vraie table d'authentification)
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'type' as type,
  created_at,
  last_sign_in_at,
  CASE 
    WHEN email = 'VOTRE_EMAIL_SUPER_ADMIN' THEN '✅ Super Admin'
    ELSE '❌ À supprimer'
  END as status
FROM auth.users
ORDER BY created_at DESC;

-- 3. Compter dans utilisateurs_public (vue)
SELECT 
  'utilisateurs_public (vue)' as table_name,
  COUNT(*) as total,
  COUNT(DISTINCT email) as unique_emails
FROM utilisateurs_public;

-- 4. Vérifier les espaces membres qui ont encore un user_id
SELECT 
  emc.id as espace_id,
  emc.email as espace_email,
  emc.user_id,
  u.email as auth_user_email,
  u.raw_user_meta_data->>'role' as role,
  c.email as client_email
FROM espaces_membres_clients emc
LEFT JOIN auth.users u ON u.id = emc.user_id
LEFT JOIN clients c ON c.id = emc.client_id
WHERE emc.user_id IS NOT NULL
ORDER BY emc.created_at DESC;

-- 5. Trouver les utilisateurs dans auth.users qui ne devraient plus exister
-- (ceux qui ne sont pas le super admin)
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as role,
  u.created_at
FROM auth.users u
WHERE u.email != 'VOTRE_EMAIL_SUPER_ADMIN'  -- ⚠️ REMPLACER par votre email super admin
ORDER BY u.created_at DESC;

