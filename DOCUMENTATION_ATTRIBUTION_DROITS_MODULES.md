# 📚 Documentation Complète : Attribution des Droits des Modules

## 🔄 Flux Complet d'Attribution des Droits (Étape par Étape)

### **ÉTAPE 1 : Création/Activation d'un Module**
**Fichier**: `src/pages/Modules.tsx`  
**Fonction**: `handleToggleModule()`  
**Action**: Super Admin active un module dans la plateforme

**Code**:
```typescript
await supabase
  .from('modules_activation')
  .upsert({
    module_code: "gestion-equipe",
    module_nom: "Gestion d'Équipe",
    module_description: "Gérer les équipes et les permissions",
    categorie: "admin",
    secteur_activite: "transversal",
    actif: true,          // ✅ Module actif dans la plateforme
    est_cree: true,       // ✅ Module créé et fonctionnel
    // ...
  }, {
    onConflict: 'module_code'
  });
```

**Table**: `modules_activation`
- `module_code` (PK, text) - Code unique du module
- `actif` (boolean) - Module actif dans la plateforme
- `est_cree` (boolean) - Module créé et fonctionnel
- `module_nom`, `module_description`, `categorie`, etc.

**Résultat**: 
- ✅ Module créé/activé dans `modules_activation`
- ✅ Le module est maintenant disponible pour être ajouté aux plans

---

### **ÉTAPE 2 : Ajout du Module à un Plan d'Abonnement**
**Fichier**: `src/pages/GestionPlans.tsx`  
**Fonction RPC**: `upsert_plan_with_modules`  
**Fichier SQL**: `supabase/migrations/20250122000050_create_plans_modules_system.sql`  
**Action**: Super Admin sélectionne des modules pour un plan

**Code Frontend**:
```typescript
await supabase.rpc('upsert_plan_with_modules', {
  p_plan_id: planId,
  p_modules: [
    {
      module_code: "gestion-equipe",
      inclus: true,           // ✅ Module inclus dans le plan
      prix_mensuel: 0,
      prix_annuel: 0
    },
    {
      module_code: "gestion-projets",
      inclus: true,
      prix_mensuel: 0,
      prix_annuel: 0
    },
    // ...
  ]
});
```

**Fonction SQL**: `upsert_plan_with_modules()`
```sql
1. Crée/met à jour le plan dans plans_abonnement
2. Supprime les anciennes associations dans plans_modules
3. Insère les nouveaux modules dans plans_modules avec:
   - plan_id
   - module_code
   - inclus = true/false
   - prix_mensuel, prix_annuel
4. Appelle sync_plan_modules_to_client_spaces() pour synchroniser
```

**Table**: `plans_modules`
- `plan_id` (FK) - Référence au plan
- `module_code` (FK) - Référence au module
- `inclus` (boolean) - Module inclus dans le plan
- `prix_mensuel`, `prix_annuel` - Prix optionnel

**Résultat**:
- ✅ Entrées créées dans `plans_modules` avec `inclus = true`
- ✅ Les modules sont maintenant inclus dans le plan
- ✅ **Synchronisation automatique** vers tous les espaces clients liés

---

### **ÉTAPE 3 : Client Souscrit à un Plan**
**Fichier**: `src/pages/Abonnements.tsx`  
**Fonction RPC**: `create_abonnement_complete`  
**Fichier SQL**: `supabase/migrations/20250122000019_create_abonnement_complete.sql`

**Code**:
```typescript
await supabase.rpc('create_abonnement_complete', {
  p_client_id: clientId,
  p_plan_id: planId,
  p_options_ids: selectedOptions,
  // ...
});
```

**Résultat**:
1. ✅ Abonnement créé dans `abonnements` avec `plan_id`
2. ✅ **TRIGGER 1**: `trigger_link_abonnement_to_client_spaces()` (migration 20250122000064)
   - Lie automatiquement `espaces_membres_clients.abonnement_id = abonnements.id`
3. ✅ **TRIGGER 2**: `trigger_sync_modules_on_abonnement_change()` (migration 20250122000059)
   - Appelle `sync_client_space_modules_from_abonnement()` lors de création/modification

---

### **ÉTAPE 4 : Synchronisation des Modules vers l'Espace Client**
**Fonction**: `sync_client_space_modules_from_abonnement(p_espace_id)`  
**Fichier SQL**: `supabase/migrations/20250122000059_auto_sync_modules_on_abonnement_change.sql`

**Logique**:
```sql
1. Récupérer abonnement_id depuis espaces_membres_clients
2. Récupérer plan_id depuis abonnements
3. Récupérer tous les modules inclus depuis plans_modules:
   WHERE plans_modules.plan_id = plan_id
   AND plans_modules.inclus = true
   AND modules_activation.est_cree = true
   AND modules_activation.actif = true
4. Construire JSON: {"gestion-equipe": true, "gestion-projets": true, ...}
5. Mettre à jour espaces_membres_clients.modules_actifs = JSON
```

**Table**: `espaces_membres_clients.modules_actifs` (JSONB)
```json
{
  "gestion-equipe": true,
  "gestion-projets": true,
  "gestion-collaborateurs": true,
  "factures": true,
  "documents": true,
  ...
}
```

**Résultat**:
- ✅ `espaces_membres_clients.modules_actifs` contient les modules du plan sous forme JSON
- ✅ Les modules sont maintenant disponibles pour l'affichage dans le Layout

---

### **ÉTAPE 5 : Affichage dans le Layout Client**
**Fichier**: `src/components/Layout.tsx`  
**Fonction**: `loadActiveModules()`  
**Action**: Lit et mappe les modules actifs pour affichage dans la sidebar

**Logique**:
```typescript
1. Récupérer espaces_membres_clients.modules_actifs pour le client connecté
2. Parcourir chaque module_code dans le JSON:
   Object.keys(modulesActifs).forEach((moduleCode) => {
     if (modulesActifs[moduleCode] === true) {
       // Module actif
     }
   })
3. Mapper vers menu ID via moduleCodeToMenuId:
   - "gestion-equipe" → "gestion-equipe"
   - "gestion-projets" → "gestion-projets"
   - "gestion-collaborateurs" → "collaborateurs"
   - "factures" → "factures"
   - etc.
4. Filtrer les modules admin (superAdminOnly === true)
5. Ajouter les modules actifs à activeModules (Set)
6. Afficher dans la sidebar
```

**Mapping** (Layout.tsx ligne 251-310):
```typescript
const moduleCodeToMenuId: Record<string, string> = {
  'gestion-equipe': 'gestion-equipe',
  'gestion_equipe': 'gestion-equipe',
  'gestion-projets': 'gestion-projets',
  'gestion_projets': 'gestion-projets',
  'gestion-collaborateurs': 'collaborateurs',
  'gestion_des_collaborateurs': 'collaborateurs',
  // ...
};
```

**Résultat**:
- ✅ Les modules apparaissent dans la sidebar du client
- ✅ Seuls les modules inclus dans le plan sont affichés

---

## ⚠️ Points d'Attention

### **1. Codes de Modules**
- Les codes dans `plans_modules.module_code` doivent correspondre exactement au mapping dans `Layout.tsx`
- Formats acceptés (avec mapping automatique):
  - `gestion-equipe` (avec tiret) ✅
  - `gestion_equipe` (avec underscore) ✅
  - Les deux sont mappés vers `gestion-equipe` dans le menu

### **2. Conditions pour Affichage**
Un module doit remplir **TOUTES** ces conditions pour s'afficher:
- ✅ `modules_activation.actif = true`
- ✅ `modules_activation.est_cree = true`
- ✅ `plans_modules.inclus = true` (pour le plan souscrit)
- ✅ Présent dans `espaces_membres_clients.modules_actifs` avec valeur `true`
- ✅ Code présent dans le mapping `moduleCodeToMenuId` de `Layout.tsx`

### **3. Synchronisation Automatique**
La synchronisation se fait automatiquement via:
- **Trigger 1**: `trigger_link_abonnement_to_client_spaces()` - Lie l'abonnement à l'espace
- **Trigger 2**: `trigger_sync_modules_on_abonnement_change()` - Synchronise les modules
- **Fonction**: `sync_client_space_modules_from_abonnement()` - Copie les modules

### **4. Synchronisation Manuelle**
Si nécessaire, synchroniser manuellement:
```sql
-- Synchroniser tous les espaces clients
SELECT sync_all_client_spaces_modules();

-- Synchroniser un espace spécifique
SELECT sync_client_space_modules_from_abonnement(espace_id);
```

---

## 🔧 Fonctions SQL Principales

### `upsert_plan_with_modules`
- **Fichier**: `20250122000050_create_plans_modules_system.sql`
- **Rôle**: Créer/modifier un plan avec ses modules
- **Appel**: Depuis `GestionPlans.tsx`
- **Action**: Insère dans `plans_modules` et synchronise automatiquement

### `get_plan_modules`
- **Fichier**: `20250122000050_create_plans_modules_system.sql`
- **Rôle**: Récupérer les modules d'un plan avec leurs statuts
- **Appel**: Depuis `Abonnements.tsx` et `GestionPlans.tsx`
- **Retour**: Table avec `module_code`, `inclus`, `prix_mensuel`, etc.

### `sync_client_space_modules_from_abonnement`
- **Fichier**: `20250122000059_auto_sync_modules_on_abonnement_change.sql`
- **Rôle**: Synchroniser les modules d'un plan vers un espace client
- **Appel**: Automatique via trigger, ou manuellement
- **Action**: Met à jour `espaces_membres_clients.modules_actifs`

### `link_abonnement_to_client_spaces`
- **Fichier**: `20250122000064_link_abonnement_to_existing_client_spaces.sql`
- **Rôle**: Lier un abonnement aux espaces clients de l'entreprise
- **Appel**: Automatique via trigger `trigger_link_abonnement_to_client_spaces`
- **Action**: Met à jour `espaces_membres_clients.abonnement_id`

---

## 📊 Tables Principales

### `modules_activation`
```sql
- module_code (text, PK) - Code unique du module
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

### `plans_modules`
```sql
- plan_id (uuid, FK) - Plan d'abonnement
- module_code (text, FK) - Code du module
- inclus (boolean) - Module inclus dans le plan
- prix_mensuel (numeric) - Prix mensuel optionnel
- prix_annuel (numeric) - Prix annuel optionnel
- UNIQUE(plan_id, module_code)
```

### `espaces_membres_clients.modules_actifs`
```jsonb
{
  "gestion-equipe": true,
  "gestion-projets": true,
  "gestion-collaborateurs": true,
  "factures": true,
  "documents": true,
  ...
}
```

---

## 🎯 Résumé du Flux

```
1. Super Admin active module
   └─> modules_activation.actif = true, est_cree = true

2. Super Admin ajoute module au plan
   └─> plans_modules.inclus = true
   └─> SYNC automatique vers espaces clients

3. Client souscrit au plan
   └─> abonnements.plan_id = [plan]
   └─> TRIGGER: Lie abonnement à espace client
   └─> TRIGGER: Synchronise modules vers modules_actifs

4. Modules synchronisés
   └─> espaces_membres_clients.modules_actifs = {"module": true, ...}

5. Client se connecte
   └─> Layout.tsx lit modules_actifs
   └─> Mappe codes vers IDs de menu
   └─> Affiche dans la sidebar
```

---

## ✅ Checklist pour Vérifier qu'un Module S'Affiche

- [ ] Module créé dans `modules_activation` avec `actif = true` et `est_cree = true`
- [ ] Module ajouté au plan dans `plans_modules` avec `inclus = true`
- [ ] Client a un abonnement actif lié au plan
- [ ] `espaces_membres_clients.abonnement_id` est lié à l'abonnement
- [ ] `espaces_membres_clients.modules_actifs` contient le module avec valeur `true`
- [ ] Le code du module correspond au mapping dans `Layout.tsx`
- [ ] Le module n'est pas marqué comme `superAdminOnly` dans le menu
