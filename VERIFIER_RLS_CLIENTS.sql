-- Script de vérification des politiques RLS pour les clients

-- 1. Vérifier que les fonctions existent
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('user_owns_entreprise', 'user_is_client', 'get_user_client_id')
ORDER BY proname;

-- 2. Vérifier les politiques RLS sur la table clients
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'clients'
ORDER BY policyname;

-- 3. Tester la fonction get_user_client_id() (à exécuter en tant que client)
-- SELECT public.get_user_client_id() as mon_client_id;

-- 4. Tester la fonction user_is_client() (à exécuter en tant que client)
-- SELECT public.user_is_client() as suis_je_client;

-- 5. Vérifier les espaces membres clients actifs
SELECT 
  emc.id,
  emc.user_id,
  emc.client_id,
  emc.entreprise_id,
  emc.actif,
  c.nom as client_nom,
  c.email as client_email
FROM espaces_membres_clients emc
LEFT JOIN clients c ON c.id = emc.client_id
WHERE emc.actif = true
ORDER BY emc.created_at DESC
LIMIT 10;

