-- ============================================================================
-- INSERTION DES PLANS MANQUANTS
-- ============================================================================
-- 
-- Ce script insère les 3 plans manquants (Business, Professional, Enterprise)
-- Le plan Starter semble déjà présent
-- ============================================================================

INSERT INTO plans_abonnement (
  nom, description, prix_mensuel, prix_annuel, 
  max_entreprises, max_utilisateurs, 
  ordre, actif, fonctionnalites
) VALUES
(
  'Business', 
  'Pour les petites entreprises en croissance', 
  29.90, 299.00, 
  3, 5, 
  2, true, 
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true}'::jsonb
),
(
  'Professional', 
  'Pour les entreprises établies', 
  79.90, 799.00, 
  10, 20, 
  3, true, 
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true}'::jsonb
),
(
  'Enterprise', 
  'Solution complète pour grandes structures', 
  199.90, 1999.00, 
  999, 999, 
  4, true, 
  '{"facturation": true, "clients": true, "dashboard": true, "comptabilite": true, "salaries": true, "automatisations": true, "administration": true, "api": true, "support_prioritaire": true, "support_dedie": true, "personnalisation": true}'::jsonb
)
ON CONFLICT (nom) DO NOTHING;

-- Vérification
SELECT 
  COUNT(*) as total_plans,
  COUNT(CASE WHEN nom = 'Starter' THEN 1 END) as starter,
  COUNT(CASE WHEN nom = 'Business' THEN 1 END) as business,
  COUNT(CASE WHEN nom = 'Professional' THEN 1 END) as professional,
  COUNT(CASE WHEN nom = 'Enterprise' THEN 1 END) as enterprise
FROM plans_abonnement 
WHERE actif = true;

