# 📋 Documentation Complète : Onglets Paramètres

## Vue d'ensemble

La page **Paramètres** est le centre de configuration de l'application. Elle permet de gérer tous les aspects du compte, de l'entreprise, et de la plateforme.

---

## 🎯 Structure des Onglets

### 1️⃣ **PROFIL** 👤
**Icône :** User | **Objectif :** Gestion du profil utilisateur personnel

#### Fonctionnalités :
- **Photo de profil**
  - Upload/Modification de la photo
  - Prévisualisation avant enregistrement
  - Format recommandé : carré, max 2MB

- **Informations personnelles**
  - Nom (modifiable)
  - Prénom (modifiable)
  - Email (avec vérification)
  - Téléphone (format validé)
  - Date de naissance (optionnel)

- **Préférences**
  - Langue de l'interface (FR/EN)
  - Fuseau horaire
  - Format de date (JJ/MM/AAAA ou MM/JJ/AAAA)
  - Thème (clair/sombre/auto)

- **Notifications personnelles**
  - Recevoir des emails de rappel
  - Recevoir des notifications push
  - Fréquence des digest emails

#### Cas d'usage :
- Un utilisateur veut changer son email
- Mise à jour des informations de contact
- Personnalisation de l'expérience utilisateur

---

### 2️⃣ **ENTREPRISE** 🏢
**Icône :** Building | **Objectif :** Gestion des informations de l'entreprise

#### Fonctionnalités :
- **Informations légales**
  - Nom commercial / Raison sociale
  - Forme juridique (SARL, SAS, SASU, EURL, SA, SNC)
  - SIRET / SIREN (vérification automatique)
  - RCS (numéro et ville)
  - Numéro TVA intracommunautaire
  - Code NAF / APE
  - Date de création

- **Adresse du siège social**
  - Numéro et rue
  - Code postal
  - Ville
  - Pays
  - Complément d'adresse

- **Coordonnées**
  - Téléphone principal
  - Email entreprise
  - Site web
  - Réseaux sociaux (LinkedIn, Facebook, etc.)

- **Informations bancaires** (pour facturation)
  - IBAN (masqué, dernier 4 chiffres visibles)
  - BIC
  - Nom de la banque
  - Titulaire du compte

- **Représentants légaux**
  - Nom et prénom du dirigeant
  - Fonction
  - Email de contact
  - Téléphone

#### Cas d'usage :
- Création d'une nouvelle entreprise
- Modification des informations légales (changement d'adresse, etc.)
- Mise à jour des coordonnées bancaires
- Ajout des réseaux sociaux

---

### 3️⃣ **FACTURATION** 📄
**Icône :** FileText | **Objectif :** Configuration de la facturation et des documents

#### Fonctionnalités :
- **Logo de l'entreprise**
  - Upload du logo (PNG, JPG, SVG)
  - Prévisualisation sur facture
  - Redimensionnement automatique
  - Position du logo (gauche/droite/centre)

- **Mentions légales**
  - Capital social
  - Mentions obligatoires (CGV, conditions de vente)
  - Mentions personnalisées
  - Notes de bas de page

- **Numérotation automatique**
  - Format des numéros (FACT-2024-001, FACT/2024/001, etc.)
  - Préfixe personnalisé
  - Compteur de factures
  - Numéro de devis (format séparé)
  - Réinitialisation du compteur

- **Template de facture**
  - Couleur principale
  - Police d'écriture
  - Mise en page (compacte/détaillée)
  - Informations affichées (TVA, remises, etc.)

- **Signature électronique**
  - Upload signature
  - Position sur facture
  - Activer/Désactiver

- **Paramètres PDF**
  - Qualité d'export
  - Nom du fichier (automatique/personnalisé)
  - Protection par mot de passe (optionnel)

#### Cas d'usage :
- Ajouter le logo sur les factures
- Personnaliser le format des numéros de facture
- Modifier les mentions légales pour conformité
- Changer le style des factures

---

### 4️⃣ **NOTIFICATIONS** 🔔
**Icône :** Bell | **Objectif :** Configuration des notifications et alertes

#### Fonctionnalités :
- **Notifications Email**
  - ✅ Nouvelles factures créées
  - ✅ Paiements reçus
  - ✅ Factures en retard
  - ✅ Rappels d'échéances (X jours avant)
  - ✅ Nouveaux clients ajoutés
  - ✅ Nouveaux abonnements
  - ✅ Alertes importantes
  - 📧 Fréquence (immédiat, quotidien, hebdomadaire)

- **Notifications In-App**
  - ✅ Activer/Désactiver les notifications push
  - ✅ Son de notification
  - ✅ Mode ne pas déranger (heures silencieuses)
  - ✅ Centre de notifications

- **Notifications SMS** (optionnel)
  - ✅ Activer SMS pour alertes critiques
  - Numéro de téléphone pour SMS
  - Types d'alertes (factures impayées uniquement)

- **Canaux spécifiques**
  - Email de notification personnalisé
  - Webhooks (URLs pour intégrations externes)
  - Slack / Discord / Teams (intégrations)

#### Cas d'usage :
- Configurer les rappels automatiques de factures
- Changer la fréquence des emails
- Activer les notifications push sur mobile
- Intégrer avec d'autres outils (Slack, etc.)

---

### 5️⃣ **SÉCURITÉ** 🔒
**Icône :** Lock | **Objectif :** Gestion de la sécurité du compte

#### Fonctionnalités :
- **Mot de passe**
  - Changer le mot de passe actuel
  - Exigences : 8+ caractères, majuscule, chiffre, caractère spécial
  - Historique des mots de passe (empêcher réutilisation)
  - Expiration du mot de passe (optionnel)

- **Authentification à deux facteurs (2FA)**
  - Activer/Désactiver 2FA
  - Méthodes disponibles :
    - 📱 Application authentificateur (Google Authenticator, Authy)
    - 📧 Email
    - 📱 SMS (si configuré)
  - Codes de récupération (à sauvegarder)
  - QR Code pour scanner avec l'app

- **Sessions actives**
  - Liste de tous les appareils connectés
  - Localisation (IP, ville, pays)
  - Date de dernière connexion
  - Déconnexion à distance d'un appareil
  - "Déconnexion de tous les appareils"

- **Historique de sécurité**
  - Logs de connexions
  - Changements de mot de passe
  - Modifications sensibles (email, 2FA, etc.)
  - Export des logs (CSV)

- **Paramètres avancés**
  - Délai d'inactivité avant déconnexion automatique
  - Restrictions d'IP (whitelist)
  - Alerte en cas de connexion depuis un nouvel appareil

#### Cas d'usage :
- Activer 2FA pour plus de sécurité
- Vérifier les sessions actives (détection d'intrusion)
- Changer le mot de passe après un oubli
- Déconnecter un appareil perdu/volé

---

### 6️⃣ **ABONNEMENT** 💳
**Icône :** CreditCard | **Objectif :** Gestion de l'abonnement et des paiements

#### Fonctionnalités :
- **Abonnement actif**
  - Plan actuel (Nom, prix, période)
  - Date de début / fin
  - Statut (actif, expiré, suspendu)
  - Prochaine date de renouvellement

- **Historique des paiements**
  - Liste de toutes les factures d'abonnement
  - Montant payé
  - Date de paiement
  - Méthode de paiement
  - Statut (payé, en attente, échoué)
  - Télécharger facture PDF

- **Gérer l'abonnement**
  - 🔄 Passer à un plan supérieur/inférieur
  - ⏸️ Suspendre temporairement
  - ❌ Résilier l'abonnement
  - 🔄 Réactiver après suspension

- **Méthodes de paiement**
  - Carte bancaire enregistrée (derniers 4 chiffres)
  - Ajouter une nouvelle carte
  - Modifier la carte par défaut
  - Supprimer une carte

- **Facturation**
  - Email de facturation
  - Adresse de facturation (peut différer du siège social)
  - TVA applicable
  - Facturation mensuelle/annuelle

- **Renouvellement automatique**
  - Activer/Désactiver le renouvellement auto
  - Date de renouvellement
  - Notification avant renouvellement (X jours avant)

- **Bon d'achat / Code promo**
  - Entrer un code promo
  - Historique des codes utilisés
  - Réductions appliquées

#### Cas d'usage :
- Vérifier la date de renouvellement de l'abonnement
- Changer de plan (upgrade/downgrade)
- Mettre à jour la carte bancaire
- Télécharger une facture d'abonnement
- Résilier l'abonnement

---

### 7️⃣ **DONNÉES** 💾
**Icône :** Database | **Objectif :** Export, import et gestion des données (RGPD)

#### Fonctionnalités :
- **Export des données**
  - 📥 Exporter toutes mes données (format JSON)
  - 📥 Exporter les factures (PDF ou CSV)
  - 📥 Exporter les clients (CSV/Excel)
  - 📥 Exporter les transactions (CSV/Excel)
  - 📥 Exporter les documents (ZIP)
  - ⏱️ Génération en arrière-plan (notification par email)

- **Import de données**
  - 📤 Importer des clients depuis CSV/Excel
  - 📤 Importer des factures depuis CSV
  - 📤 Importer des documents
  - Template de fichier à télécharger
  - Validation avant import

- **Données RGPD**
  - 📄 Télécharger mes données personnelles
  - 🗑️ Demander la suppression de mon compte
  - ⏱️ Délai de traitement (30 jours)
  - Confirmation par email

- **Sauvegarde automatique**
  - Fréquence des sauvegardes (quotidienne/hebdomadaire)
  - Rétention des sauvegardes (X jours)
  - Emplacement des sauvegardes (cloud/local)

- **Restauration**
  - Liste des sauvegardes disponibles
  - Restaurer depuis une sauvegarde
  - Prévisualisation des données avant restauration

- **Archivage**
  - Archiver les anciennes données (X mois)
  - Conserver les archives pendant X temps
  - Supprimer définitivement les archives

#### Cas d'usage :
- Exporter toutes les données pour backup
- Migrer vers une autre plateforme
- Respecter le RGPD (droit à l'oubli)
- Importer des clients en masse depuis un autre système
- Restaurer après une erreur

---

### 8️⃣ **GESTION CLIENTS** 👥
**Icône :** Users | **Objectif :** Gestion complète des clients (Super Admin uniquement)

#### Fonctionnalités :
- **Vue d'ensemble**
  - 📊 Statistiques en temps réel :
    - Nombre total de clients
    - Espaces membres créés
    - Super administrateurs clients
    - Espaces actifs/suspendus

- **Liste complète des clients**
  - Tableau avec tous les clients de toutes les entreprises
  - Colonnes : Entreprise, Client, Email, Rôle, Espace Client, Actions
  - Recherche globale (entreprise, nom, prénom, email)
  - Filtres par statut (actif, suspendu, sans espace)
  - Tri par colonnes

- **Actions sur chaque client**
  - ➕ Créer un espace membre
  - ⏸️ Suspendre/Activer l'espace
  - 📧 Renvoyer les identifiants par email
  - 🗑️ Supprimer complètement (avec confirmation)

- **Création d'espace membre**
  - Génération automatique de mot de passe
  - Attribution d'un plan d'abonnement
  - Sélection des options/modules
  - Modal d'affichage des identifiants
  - Envoi automatique par email

- **Gestion des identifiants**
  - Régénération de mot de passe
  - Envoi par email avec template professionnel
  - Historique des envois

#### Cas d'usage :
- Créer un espace membre pour un nouveau client
- Suspendre l'accès d'un client en retard de paiement
- Renvoyer les identifiants à un client qui les a oubliés
- Supprimer un client qui ne souhaite plus utiliser la plateforme
- Avoir une vue globale de tous les clients de toutes les entreprises

---

## 🎨 Design et UX

### Navigation
- **Onglets horizontaux** en haut de la page
- **Icônes** pour identification rapide
- **Indicateur visuel** de l'onglet actif (bordure colorée)
- **Responsive** : menu hamburger sur mobile

### Organisation
- **Sections groupées** par catégorie
- **Sauvegarde automatique** ou bouton "Enregistrer" explicite
- **Messages de confirmation** pour actions importantes
- **Validation en temps réel** des formulaires

### Accessibilité
- **Tooltips** sur les icônes
- **Messages d'aide** contextuels
- **Erreurs claires** avec suggestions de correction
- **Conforme WCAG 2.1** (contraste, navigation clavier)

---

## 🔄 Workflow Typique

### Premier utilisateur
1. **Profil** → Compléter les informations personnelles
2. **Entreprise** → Créer/configurer l'entreprise
3. **Facturation** → Uploader logo, configurer mentions légales
4. **Abonnement** → Choisir un plan et payer
5. **Sécurité** → Activer 2FA
6. **Notifications** → Configurer les préférences

### Utilisateur existant
- Consultation régulière de **Abonnement** (vérifier renouvellement)
- Modification dans **Entreprise** (changement d'adresse, etc.)
- Gestion dans **Gestion Clients** (pour super admins)

---

## 📈 Priorités d'Implémentation

### Phase 1 (Essentiel) ⭐⭐⭐
1. ✅ **Gestion Clients** (déjà implémenté)
2. 🔲 **Profil** (informations de base)
3. 🔲 **Entreprise** (SIRET, adresse, etc.)
4. 🔲 **Sécurité** (changer mot de passe, 2FA basique)

### Phase 2 (Important) ⭐⭐
5. 🔲 **Abonnement** (gestion plan, historique paiements)
6. 🔲 **Facturation** (logo, numérotation, mentions)
7. 🔲 **Notifications** (préférences email)

### Phase 3 (Amélioration) ⭐
8. 🔲 **Données** (export RGPD, import/export)
9. 🔲 **Notifications avancées** (SMS, webhooks)

---

## 🔗 Intégrations Futures

- **Stripe** pour gestion des paiements (Abonnement)
- **Resend/SendGrid** pour emails (Notifications)
- **Authy/Google Authenticator** pour 2FA (Sécurité)
- **AWS S3** pour stockage documents (Données)
- **Zapier/Make** pour webhooks (Notifications)

---

## 📝 Notes Techniques

- Toutes les modifications sont **auditées** (qui, quand, quoi)
- **RLS (Row Level Security)** pour protéger les données
- **Validation côté client ET serveur**
- **Cache** des paramètres pour performance
- **Synchronisation temps réel** entre onglets si nécessaire

---

**Dernière mise à jour :** 2025-01-22

