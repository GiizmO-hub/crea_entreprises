# Guide : Création d'Espace Membre pour un Client

Ce guide explique comment créer un espace membre pour un client existant dans l'application.

## Prérequis

1. ✅ Un client doit être créé dans l'application (sans espace membre)
2. ✅ Le client doit avoir un email valide
3. ✅ Les migrations SQL doivent être appliquées (voir ci-dessous)

## Étapes pour appliquer la migration SQL

### 1. Ouvrir Supabase Dashboard

1. Connectez-vous à votre projet Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**

### 2. Appliquer la migration

La migration `20250122000005_create_espace_membre_from_client.sql` contient :

- ✅ Fonction `create_espace_membre_from_client` : Crée un espace membre pour un client existant
- ✅ Fonction `get_client_credentials` : Récupère les identifiants d'un client
- ✅ Extension `pgcrypto` : Nécessaire pour le cryptage des mots de passe

**Copiez et exécutez** le contenu du fichier `supabase/migrations/20250122000005_create_espace_membre_from_client.sql` dans le SQL Editor.

### 3. Vérifier que l'extension pgcrypto est activée

La migration vérifie automatiquement et active l'extension `pgcrypto` si nécessaire. Vous pouvez également vérifier manuellement :

```sql
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

Si elle n'est pas installée :

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Utilisation dans l'application

### 1. Créer un client

1. Allez dans la page **Clients**
2. Cliquez sur **"Ajouter un client"**
3. Remplissez les informations du client (⚠️ **l'email est obligatoire** pour créer un espace membre)
4. Cliquez sur **"Créer"**

### 2. Créer un espace membre pour le client

1. Sur la **fiche client**, cliquez sur le bouton **"Créer espace membre"** (bouton vert avec l'icône `+`)
2. Dans le modal qui s'ouvre :
   - **Mot de passe** : Entrez un mot de passe (minimum 8 caractères)
   - **Plan d'abonnement** : Sélectionnez un plan (obligatoire)
   - **Options/Modules** : Sélectionnez les modules supplémentaires (optionnel)
3. Cliquez sur **"Créer l'espace membre"**

### 3. Récupérer les identifiants

Après la création de l'espace membre, un modal s'affiche automatiquement avec :
- ✅ **Email** : L'email du client
- ✅ **Mot de passe** : Le mot de passe que vous avez défini

⚠️ **Important** : Ces identifiants sont affichés **une seule fois**. Copiez-les avant de fermer la fenêtre.

### 4. Copier les identifiants

Dans le modal des identifiants :
- Cliquez sur l'icône **📋** à côté de l'email pour copier l'email
- Cliquez sur l'icône **📋** à côté du mot de passe pour copier le mot de passe
- L'icône se transforme en **✓** pendant 2 secondes pour confirmer la copie

### 5. Envoyer les identifiants par email

Le bouton **"Envoyer par email"** est disponible mais la fonctionnalité complète d'envoi d'email sera implémentée ultérieurement.

## Fonctionnalités

### Création automatique

Lors de la création d'un espace membre, le système :

1. ✅ Vérifie que le client existe et a un email
2. ✅ Vérifie qu'un espace membre n'existe pas déjà
3. ✅ Génère un UUID pour l'utilisateur
4. ✅ Crée l'utilisateur dans `auth.users` avec le mot de passe crypté
5. ✅ Crée un abonnement avec le plan sélectionné
6. ✅ Crée les options/modules souscrits
7. ✅ Crée l'entrée dans la table `utilisateurs` avec le rôle `client`
8. ✅ Retourne les identifiants (email + mot de passe en clair)

### Sécurité

- 🔒 Les mots de passe sont cryptés avec `pgcrypto` (algorithme bcrypt)
- 🔒 Les identifiants ne sont affichés qu'une seule fois lors de la création
- 🔒 Seuls les propriétaires de l'entreprise peuvent créer des espaces membres pour leurs clients

## Résolution de problèmes

### Erreur : "Le client doit avoir un email"

**Solution** : Modifiez le client et ajoutez un email valide.

### Erreur : "Un espace membre existe déjà pour ce client"

**Solution** : L'espace membre a déjà été créé. Utilisez le bouton clé (🔑) pour récupérer l'email.

### Erreur : "Un utilisateur avec cet email existe déjà"

**Solution** : Un compte existe déjà avec cet email dans `auth.users`. Vérifiez dans Supabase Dashboard > Authentication.

### L'extension pgcrypto n'est pas disponible

**Solution** : Exécutez manuellement dans Supabase SQL Editor :

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Le mot de passe ne peut pas être récupéré

**Sécurité** : Par sécurité, les mots de passe ne peuvent pas être récupérés après création. 

**Solution** : Utilisez la fonction de réinitialisation de mot de passe de Supabase ou créez un nouvel espace membre (l'ancien sera remplacé).

## Structure de la base de données

### Tables concernées

- `clients` : Informations du client
- `auth.users` : Utilisateurs d'authentification Supabase
- `utilisateurs` : Utilisateurs de l'application (lié à `auth.users`)
- `abonnements` : Abonnements des clients
- `abonnement_options` : Options/modules souscrits
- `plans_abonnement` : Plans disponibles
- `options_supplementaires` : Options/modules disponibles

### Fonctions SQL

- `create_espace_membre_from_client` : Crée un espace membre complet
- `get_client_credentials` : Récupère les identifiants d'un client

## Prochaines étapes

- [ ] Implémenter l'envoi d'email automatique avec les identifiants
- [ ] Ajouter une fonction de réinitialisation de mot de passe
- [ ] Ajouter une fonction de régénération de mot de passe
- [ ] Ajouter la gestion des abonnements depuis la fiche client
- [ ] Afficher le statut de l'espace membre sur la fiche client




