-- Script pour vérifier les utilisateurs dans auth.users et utilisateurs_public

-- 1. Compter tous les utilisateurs dans auth.users
SELECT 
  'auth.users' as source,
  COUNT(*) as total_users,
  COUNT(DISTINCT email) as unique_emails
FROM auth.users;

-- 2. Lister tous les utilisateurs dans auth.users avec leur email et rôle
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'type' as type,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- 3. Compter les utilisateurs dans utilisateurs_public (vue)
SELECT 
  'utilisateurs_public (vue)' as source,
  COUNT(*) as total_users,
  COUNT(DISTINCT email) as unique_emails
FROM utilisateurs_public;

-- 4. Lister tous les utilisateurs dans utilisateurs_public
SELECT 
  id,
  email,
  role,
  created_at
FROM utilisateurs_public
ORDER BY created_at DESC;

-- 5. Comparer : utilisateurs dans auth.users mais pas dans utilisateurs_public
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM utilisateurs_public up WHERE up.id = u.id
);

-- 6. Comparer : utilisateurs dans utilisateurs_public mais pas dans auth.users
SELECT 
  up.id,
  up.email,
  up.role
FROM utilisateurs_public up
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = up.id
);

-- 7. Vérifier les espaces membres clients et leurs user_id
SELECT 
  emc.id as espace_id,
  emc.client_id,
  emc.user_id,
  emc.email as espace_email,
  c.email as client_email,
  u.email as auth_user_email
FROM espaces_membres_clients emc
LEFT JOIN clients c ON c.id = emc.client_id
LEFT JOIN auth.users u ON u.id = emc.user_id
ORDER BY emc.created_at DESC;




