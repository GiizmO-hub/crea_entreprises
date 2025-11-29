-- Script de vérification pour le module gestion-stock
-- À exécuter dans Supabase SQL Editor après la migration

-- 1. Vérifier que le module est dans modules_activation
SELECT 
  module_code,
  module_nom,
  actif,
  est_cree,
  categorie
FROM modules_activation
WHERE module_code = 'gestion-stock';

-- 2. Vérifier que le module est dans les plans
SELECT 
  p.nom as plan_nom,
  pm.module_code,
  pm.module_nom,
  pm.activer,
  pm.actif,
  pm.inclus
FROM plan_modules pm
JOIN plans_abonnement p ON p.id = pm.plan_id
WHERE pm.module_code = 'gestion-stock';

-- 3. Vérifier les modules actifs d'un client (remplacer USER_ID par l'ID de l'utilisateur)
SELECT 
  emc.user_id,
  emc.modules_actifs,
  p.nom as plan_nom
FROM espaces_membres_clients emc
JOIN abonnements a ON a.entreprise_id = emc.entreprise_id
JOIN plans_abonnement p ON p.id = a.plan_id
WHERE emc.user_id = 'REMPLACER_PAR_USER_ID'
  AND a.statut = 'actif';

-- 4. Forcer la synchronisation pour un client (remplacer USER_ID)
SELECT sync_client_modules_from_subscription('REMPLACER_PAR_USER_ID');
