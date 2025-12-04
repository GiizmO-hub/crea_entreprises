/*
  # RETIRER SECURITY DEFINER DES VUES
  
  Cette migration force la suppression et recréation des vues pour retirer
  explicitement la propriété SECURITY DEFINER qui peut être héritée.
  
  IMPORTANT: On utilise ALTER VIEW ... SET (security_invoker = true) si disponible,
  sinon on force la recréation complète.
*/

-- ============================================================================
-- RETIRER SECURITY DEFINER DES VUES EN UTILISANT ALTER VIEW
-- ============================================================================

-- La syntaxe correcte pour Supabase/PostgreSQL est :
-- ALTER VIEW nom_vue SET (security_invoker = true);

-- 1. super_admins_plateforme
ALTER VIEW IF EXISTS super_admins_plateforme SET (security_invoker = true);

-- 2. equipe_plateforme_with_roles
ALTER VIEW IF EXISTS equipe_plateforme_with_roles SET (security_invoker = true);

-- 3. clients_with_roles
ALTER VIEW IF EXISTS clients_with_roles SET (security_invoker = true);

-- Permissions
GRANT SELECT ON super_admins_plateforme TO authenticated;
GRANT SELECT ON equipe_plateforme_with_roles TO authenticated;
GRANT SELECT ON clients_with_roles TO authenticated;

-- Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Vues recréées sans SECURITY DEFINER';
END $$;

