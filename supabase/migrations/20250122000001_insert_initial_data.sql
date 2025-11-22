/*
  # Insertion des Données de Référence Initiales
  
  ## Données à Insérer
  1. Plans d'abonnement (Starter, Business, Professional, Enterprise)
  2. Options supplémentaires
  3. Secteurs d'activité (optionnel)
*/

-- ============================================
-- PLANS D'ABONNEMENT
-- ============================================

INSERT INTO plans_abonnement (nom, description, prix_mensuel, prix_annuel, fonctionnalites, max_entreprises, max_utilisateurs, ordre) VALUES
  (
    'Starter',
    'Parfait pour débuter avec les fonctionnalités essentielles',
    29.90,
    299.00,
    '{
      "facturation": true,
      "clients": true,
      "documents": true,
      "dashboard": true
    }'::jsonb,
    1,
    3,
    1
  ),
  (
    'Business',
    'Pour les entreprises en croissance',
    79.90,
    799.00,
    '{
      "facturation": true,
      "clients": true,
      "documents": true,
      "dashboard": true,
      "comptabilite": true,
      "rh": true,
      "projets": true
    }'::jsonb,
    3,
    10,
    2
  ),
  (
    'Professional',
    'Solution complète pour les professionnels',
    149.90,
    1499.00,
    '{
      "facturation": true,
      "clients": true,
      "documents": true,
      "dashboard": true,
      "comptabilite": true,
      "rh": true,
      "projets": true,
      "stocks": true,
      "fournisseurs": true,
      "automatisations": true,
      "api": true
    }'::jsonb,
    10,
    50,
    3
  ),
  (
    'Enterprise',
    'Pour les grandes entreprises avec besoins avancés',
    299.90,
    2999.00,
    '{
      "facturation": true,
      "clients": true,
      "documents": true,
      "dashboard": true,
      "comptabilite": true,
      "rh": true,
      "projets": true,
      "stocks": true,
      "fournisseurs": true,
      "automatisations": true,
      "api": true,
      "sso": true,
      "support_prioritaire": true,
      "personnalisation": true
    }'::jsonb,
    NULL,
    NULL,
    4
  )
ON CONFLICT (nom) DO NOTHING;

-- ============================================
-- OPTIONS SUPPLÉMENTAIRES
-- ============================================

INSERT INTO options_supplementaires (code, nom, description, prix_mensuel, prix_annuel) VALUES
  ('utilisateurs_supplementaires', 'Utilisateurs supplémentaires', 'Ajouter des utilisateurs à votre plan', 9.90, 99.00),
  ('comptabilite_avancee', 'Comptabilité avancée', 'Fonctionnalités comptables avancées et export FEC', 19.90, 199.00),
  ('integration_bancaire', 'Intégration bancaire', 'Connexion avec votre banque via Open Banking', 14.90, 149.00),
  ('support_prioritaire', 'Support prioritaire', 'Support client prioritaire avec réponse garantie sous 2h', 29.90, 299.00),
  ('api_avancee', 'API avancée', 'Accès à l''API complète avec limites élevées', 39.90, 399.00),
  ('signature_electronique', 'Signature électronique', 'Intégration signature électronique pour documents', 19.90, 199.00),
  ('modules_rh', 'Modules RH avancés', 'Gestion paie complète, DSN, déclarations sociales', 24.90, 249.00),
  ('reporting_avance', 'Reporting avancé', 'Tableaux de bord personnalisables et rapports détaillés', 14.90, 149.00)
ON CONFLICT (code) DO NOTHING;

