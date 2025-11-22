/*
  # Fonction RPC : Création complète Entreprise + Client + Espace Membre
  
  Crée en une seule fois :
  - Entreprise avec toutes les informations
  - Client associé (avec les mêmes informations de contact)
  - Espace membre pour le client
  - Utilisateur auth.users si nécessaire
*/

-- Cette fonction sera créée mais on utilisera plutôt create_espace_membre_from_client
-- qui existe déjà et fait le travail correctement

-- Pour l'instant, on utilise simplement create_espace_membre_from_client après création
-- Pas besoin de nouvelle fonction complexe

COMMENT ON FUNCTION create_espace_membre_from_client IS 'Crée un espace membre pour un client existant avec un abonnement et des options. Crée l''utilisateur dans auth.users avec cryptage bcrypt et retourne les identifiants (email + password).';
