# Analyse du Système d'Attribution des Droits des Modules

## 📋 Vue d'ensemble du Flux

### 1. Création/Activation d'un Module
- **Table**: `modules_activation`
- **Interface**: `Modules.tsx` (page super admin)
- **Action**: Activer/désactiver un module dans la base
- **Champs importants**:
  - `module_code` (ex: "gestion-equipe", "gestion-projets")
  - `module_nom` (nom affiché)
  - `actif` (boolean) - Module actif dans la plateforme
  - `est_cree` (boolean) - Module créé et fonctionnel

### 2. Attribution du Module à un Plan
- **Table**: `plans_modules`
- **Interface**: `GestionPlans.tsx` (page super admin)
- **Fonction RPC**: `upsert_plan_with_modules`
- **Action**: Ajouter un module à un plan d'abonnement
- **Champs importants**:
  - `plan_id` (référence au plan)
  - `module_code` (référence au module)
  - `inclus` (boolean) - Module inclus dans le plan
  - `prix_mensuel`, `prix_annuel` (prix optionnel)

### 3. Synchronisation vers l'Espace Client
- **Table**: `espaces_membres_clients.modules_actifs` (JSONB)
- **Fonction**: `sync_client_space_modules_from_abonnement`
- **Trigger**: Automatique lors de création/modification d'abonnement
- **Action**: Copier les modules du plan vers `modules_actifs`

### 4. Affichage dans le Layout
- **Fichier**: `Layout.tsx`
- **Fonction**: `loadActiveModules()`
- **Action**: Lire `modules_actifs` et mapper vers les IDs de menu

## 🔄 Flux Complet

```
1. Super Admin active un module
   └─> modules_activation.actif = true
   └─> modules_activation.est_cree = true

2. Super Admin ajoute le module à un plan
   └─> plans_modules.inclus = true
   └─> plans_modules.module_code = "gestion-equipe"

3. Client souscrit à un plan
   └─> abonnements.plan_id = [plan avec modules]
   └─> TRIGGER: trigger_link_abonnement_to_client_spaces()
   └─> Lien: espaces_membres_clients.abonnement_id = abonnements.id
   └─> TRIGGER: trigger_sync_modules_on_abonnement_change()
   └─> SYNC: sync_client_space_modules_from_abonnement()
   └─> RESULTAT: espaces_membres_clients.modules_actifs = {"gestion-equipe": true, ...}

4. Client se connecte
   └─> Layout.tsx.loadActiveModules()
   └─> Lit: espaces_membres_clients.modules_actifs
   └─> Mappe: "gestion-equipe" → "gestion-equipe" (menu ID)
   └─> Affiche: Menu item dans la sidebar
```

## ⚠️ Points d'Attention

### Problème Potentiel 1: Codes de Modules
- Les codes dans `plans_modules.module_code` doivent correspondre exactement au mapping dans `Layout.tsx`
- Exemples de formats possibles:
  - `gestion-equipe` (avec tiret)
  - `gestion_equipe` (avec underscore)
  - `gestion d'équipe` (avec espace et apostrophe)

### Problème Potentiel 2: Synchronisation
- La synchronisation se fait uniquement si `abonnement_id` est lié
- Si l'abonnement est créé après l'espace, il faut utiliser le trigger `trigger_link_abonnement_to_client_spaces`

### Problème Potentiel 3: Modules Inactifs
- Un module doit être:
  - `actif = true` dans `modules_activation`
  - `est_cree = true` dans `modules_activation`
  - `inclus = true` dans `plans_modules`
  - Présent dans `modules_actifs` de l'espace client

## 🔍 Tables Concernées

### modules_activation
```sql
- module_code (text, unique) - Code du module
- module_nom (text) - Nom affiché
- module_description (text) - Description
- categorie (text) - core, premium, option, admin
- secteur_activite (text) - Secteur d'activité
- priorite (integer) - Priorité d'affichage
- actif (boolean) - Module actif
- est_cree (boolean) - Module créé et fonctionnel
- icone (text) - Nom de l'icône
- route (text) - Route de navigation
```

### plans_modules
```sql
- plan_id (uuid) - Plan d'abonnement
- module_code (text) - Code du module
- inclus (boolean) - Module inclus dans le plan
- prix_mensuel (numeric) - Prix mensuel optionnel
- prix_annuel (numeric) - Prix annuel optionnel
```

### espaces_membres_clients.modules_actifs
```jsonb
{
  "gestion-equipe": true,
  "gestion-projets": true,
  "gestion-collaborateurs": true,
  "factures": true,
  ...
}
```

