/*
  # Correction : RLS pour notifications - Permettre aux super admins de créer des notifications pour les clients
  
  OBJECTIF:
  - Permettre aux super admins de la plateforme de créer des notifications pour n'importe quel utilisateur
  - Conserver la sécurité pour les utilisateurs normaux (ne peuvent créer que pour eux-mêmes)
*/

-- Supprimer les anciennes politiques INSERT restrictives
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications or platform admins for any user" ON public.notifications;

-- Créer une nouvelle politique INSERT qui permet :
-- 1. Les utilisateurs peuvent créer des notifications pour eux-mêmes
-- 2. Les super admins de la plateforme peuvent créer des notifications pour n'importe quel utilisateur
CREATE POLICY "Users can insert their own notifications or platform admins for any user"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Cas 1 : L'utilisateur crée une notification pour lui-même
    user_id = auth.uid()
    OR
    -- Cas 2 : Super admin de la plateforme peut créer pour n'importe qui
    public.is_platform_super_admin()
  );

-- Ajouter un commentaire pour clarifier
COMMENT ON POLICY "Users can insert their own notifications or platform admins for any user" ON public.notifications IS 
  'Permet aux utilisateurs de créer des notifications pour eux-mêmes, et aux super admins de la plateforme de créer des notifications pour n''importe quel utilisateur';

