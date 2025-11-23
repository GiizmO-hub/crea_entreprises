# Analyse du Système de Modules, Options et Abonnements

## Problème Identifié

Les modules inclus dans un plan d'abonnement ne s'affichent pas dans l'espace client.

## Architecture du Système

### 1. Tables Principales

- **`modules_activation`** : Liste de tous les modules disponibles dans l'application
  - `module_code` : Code du module (ex: "gestion-equipe", "gestion-projets")
  - `module_nom` : Nom du module
  - `est_cree` : Le module est créé
  - `actif` : Le module est actif

- **`plans_abonnement`** : Plans d'abonnement disponibles
  - Plans: Starter, Business, Professional, Enterprise

- **`plans_modules`** : Modules inclus dans chaque plan
  - `plan_id` : Référence au plan
  - `module_code` : Code du module inclus
  - `inclus` : Boolean indiquant si le module est inclus

- **`abonnements`** : Abonnements des clients
  - `plan_id` : Plan souscrit
  - `entreprise_id` : Entreprise du client
  - `statut` : actif, suspendu, etc.

- **`espaces_membres_clients`** : Espaces clients
  - `abonnement_id` : Abonnement lié (peut être NULL)
  - `modules_actifs` : JSONB avec les modules actifs (ex: {"gestion-equipe": true, "factures": true})

### 2. Flux de Synchronisation

#### Étape 1: Création d'un Abonnement
Quand un abonnement est créé via `create_abonnement_complete`:
- L'abonnement est créé dans `abonnements`
- L'abonnement_id doit être lié à `espaces_membres_clients.abonnement_id`
- Les modules du plan doivent être synchronisés vers `espaces_membres_clients.modules_actifs`

#### Étape 2: Synchronisation Automatique
La fonction `sync_client_space_modules_from_abonnement`:
1. Récupère l'abonnement_id de l'espace client
2. Récupère le plan_id de l'abonnement
3. Récupère tous les modules inclus dans le plan depuis `plans_modules`
4. Construit un JSON avec les modules actifs
5. Met à jour `espaces_membres_clients.modules_actifs`

#### Étape 3: Affichage dans Layout.tsx
La fonction `loadActiveModules`:
1. Récupère `modules_actifs` depuis `espaces_membres_clients`
2. Mappe les codes de modules vers les IDs de menu
3. Filtre les modules admin
4. Affiche les modules dans la sidebar

## Problèmes Potentiels

1. **abonnement_id non lié** : L'espace membre n'a pas d'abonnement_id associé
2. **Modules non synchronisés** : Les modules du plan ne sont pas dans `modules_actifs`
3. **Codes de modules différents** : Les codes dans `plans_modules` ne correspondent pas au mapping
4. **Mapping incorrect** : Le mapping dans Layout.tsx ne correspond pas aux codes réels
5. **Synchronisation non déclenchée** : Les triggers ne se déclenchent pas

## Actions à Vérifier

1. Vérifier que l'espace client a un `abonnement_id`
2. Vérifier que l'abonnement a un `plan_id` et est actif
3. Vérifier les modules dans `plans_modules` pour ce plan
4. Vérifier les modules dans `espaces_membres_clients.modules_actifs`
5. Vérifier le mapping entre les codes et les IDs de menu
6. Vérifier que la synchronisation se déclenche automatiquement

