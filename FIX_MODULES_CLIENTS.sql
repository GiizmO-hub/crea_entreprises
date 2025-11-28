/*
  # FIX : Activer les modules pour les clients
  
  Ce script active les modules documents, collaborateurs, et gestion-equipe
  pour tous les clients dans leurs modules_actifs.
*/

-- Mettre à jour les modules_actifs pour tous les clients
UPDATE espaces_membres_clients
SET modules_actifs = COALESCE(modules_actifs, '{}'::jsonb) || 
    jsonb_build_object(
      'documents', true,
      'gestion-documents', true,
      'gestion_de_documents', true,
      'collaborateurs', true,
      'gestion-collaborateurs', true,
      'gestion-equipe', true,
      'gestion_equipe', true,
      'gestion-d-equipe', true,
      'gestion-de-projets', true,
      'gestion_projets', true,
      'gestion-projets', true
    )
WHERE actif = true;

-- Afficher un résumé
SELECT 
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE modules_actifs->>'documents' = 'true') as avec_documents,
  COUNT(*) FILTER (WHERE modules_actifs->>'collaborateurs' = 'true') as avec_collaborateurs,
  COUNT(*) FILTER (WHERE modules_actifs->>'gestion-equipe' = 'true' OR modules_actifs->>'gestion_equipe' = 'true') as avec_gestion_equipe
FROM espaces_membres_clients
WHERE actif = true;

SELECT '✅ Modules activés pour tous les clients !' as resultat;

