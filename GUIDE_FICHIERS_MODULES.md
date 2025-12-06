# 📁 GUIDE DES FICHIERS PAR MODULE

Ce guide explique quels fichiers sont utilisés pour chaque module de l'application.

---

## 🏗️ ARCHITECTURE GÉNÉRALE DES MODULES

### Fichiers communs à TOUS les modules :

1. **`src/services/moduleService.ts`** ⭐
   - Mapping des codes de modules → IDs de menu
   - Normalisation des codes (tirets, underscores)
   - Filtrage des modules actifs
   - **À MODIFIER** : Ajouter le mapping pour chaque nouveau module

2. **`src/hooks/useClientModules.ts`** ⭐
   - Charge les modules actifs depuis `espaces_membres_clients.modules_actifs`
   - Gère le mapping codes → menu IDs
   - Filtre les modules selon les permissions
   - **À MODIFIER** : Si besoin de logique spécifique par module

3. **`src/components/Layout.tsx`** ⭐
   - Affiche les modules dans la sidebar
   - Utilise `useClientModules` pour filtrer les modules visibles
   - **À MODIFIER** : Ajouter l'entrée de menu pour chaque nouveau module

4. **`src/App.tsx`** ⭐
   - Définit les routes pour chaque module
   - Lazy loading des composants
   - **À MODIFIER** : Ajouter la route pour chaque nouveau module

5. **`src/pages/Modules.tsx`**
   - Interface Super Admin pour activer/désactiver les modules
   - Gère la table `modules_activation`
   - **À MODIFIER** : Ajouter le module dans la liste si nécessaire

---

## 📋 FICHIERS PAR MODULE

### 1. **Module Comptabilité** (`comptabilite`)

#### Frontend :
- ✅ **`src/pages/Comptabilite.tsx`** - Composant principal (3034 lignes)
- ✅ **`src/services/cotisationsService.ts`** - Calcul des cotisations
- ✅ **`src/lib/pdfGeneratorFichePaie.ts`** - Génération PDF fiches de paie

#### Backend (Migrations SQL) :
- ✅ **`supabase/migrations/20250201000001_create_comptabilite_module_structure.sql`** - Structure complète
- ✅ **`supabase/migrations/20250201000002_init_plan_comptable_francais.sql`** - Plan comptable PCG
- ✅ **`supabase/migrations/20250201000003_comptabilite_automatisation.sql`** - Automatisations
- ✅ **`supabase/migrations/20250201000004_fix_comptabilite_constraints.sql`** - Corrections
- ✅ **`supabase/migrations/20250203000006_fix_comptabilite_remove_facture_id.sql`** - Correction fonction paiement

#### Tables Base de Données :
- `plan_comptable`
- `journaux_comptables`
- `ecritures_comptables`
- `fiches_paie`
- `declarations_fiscales`
- `bilans_comptables`
- `parametres_comptables`

#### Mapping dans `moduleService.ts` :
```typescript
'comptabilite': 'comptabilite',
'comptabilité': 'comptabilite',
'comptabilite-avancee': 'comptabilite',
'fiches-paie': 'comptabilite',
'bilans-comptables': 'comptabilite',
```

---

### 2. **Module Facturation** (`factures`)

#### Frontend :
- ✅ **`src/pages/Factures.tsx`** - Composant principal
- ✅ **`src/lib/pdfGenerator.ts`** - Génération PDF factures

#### Backend :
- Tables : `factures`, `facture_lignes`, `paiements`

#### Mapping dans `moduleService.ts` :
```typescript
'facturation': 'factures',
'factures': 'factures',
```

---

### 3. **Module Clients/CRM** (`clients`)

#### Frontend :
- ✅ **`src/pages/Clients.tsx`** - Composant principal
- ✅ **`src/pages/clients/`** - Sous-composants (ClientCard, ClientForm, etc.)
- ✅ **`src/components/ClientDetailsModal.tsx`** - Modal détails client

#### Backend :
- Tables : `clients`, `espaces_membres_clients`, `abonnements`

#### Mapping dans `moduleService.ts` :
```typescript
'clients': 'clients',
'gestion_clients': 'clients',
'gestion-clients': 'clients',
'crm': 'clients',
```

---

### 4. **Module Documents** (`documents`)

#### Frontend :
- ✅ **`src/pages/Documents.tsx`** - Composant principal

#### Backend :
- Tables : `documents`, `dossiers`, `permissions_dossiers`

#### Mapping dans `moduleService.ts` :
```typescript
'documents': 'documents',
'gestion_documents': 'documents',
'documents-entreprise': 'documents',
```

---

### 5. **Module Collaborateurs** (`collaborateurs`)

#### Frontend :
- ✅ **`src/pages/Collaborateurs.tsx`** - Composant principal
- ✅ **`src/lib/pdfGeneratorCollaborateur.ts`** - Génération PDF collaborateurs

#### Backend :
- Tables : `collaborateurs_entreprise`, `salaries` (si existe)

#### Mapping dans `moduleService.ts` :
```typescript
'collaborateurs': 'collaborateurs',
'salaries': 'collaborateurs',
'gestion-collaborateurs': 'collaborateurs',
```

---

### 6. **Module Gestion d'Équipe** (`gestion-equipe`)

#### Frontend :
- ✅ **`src/pages/GestionEquipe.tsx`** - Composant principal

#### Backend :
- Tables : `equipes`, `collaborateurs_equipes`, `permissions_dossiers`

#### Mapping dans `moduleService.ts` :
```typescript
'gestion-equipe': 'gestion-equipe',
'gestion_equipe': 'gestion-equipe',
```

---

### 7. **Module Gestion de Projets** (`gestion-projets`)

#### Frontend :
- ✅ **`src/pages/GestionProjets.tsx`** - Composant principal

#### Backend :
- Tables : `projets`, `taches`, `jalons` (à vérifier)

#### Mapping dans `moduleService.ts` :
```typescript
'gestion-projets': 'gestion-projets',
'gestion_projets': 'gestion-projets',
```

---

### 8. **Module Gestion de Stock** (`gestion-stock`)

#### Frontend :
- ✅ **`src/pages/GestionStock.tsx`** - Composant principal

#### Backend :
- Tables : `produits`, `mouvements_stock`, `inventaires` (à vérifier)

#### Mapping dans `moduleService.ts` :
```typescript
'gestion-stock': 'gestion-stock',
'stock': 'gestion-stock',
```

---

### 9. **Module CRM Avancé** (`crm-avance`)

#### Frontend :
- ✅ **`src/pages/GestionCRM.tsx`** - Composant principal

#### Backend :
- Tables : `opportunites`, `activites`, `campagnes` (à vérifier)

#### Mapping dans `moduleService.ts` :
```typescript
'crm-avance': 'crm-avance',
'crm_avance': 'crm-avance',
```

---

### 10. **Module Finance** (`finance`)

#### Frontend :
- ✅ **`src/pages/Finance.tsx`** - Composant principal

#### Backend :
- Tables : (à vérifier selon implémentation)

#### Mapping dans `moduleService.ts` :
```typescript
'finance': 'finance',
'finances': 'finance',
'previsionnel': 'finance',
'gestion-budget': 'finance',
```

---

### 11. **Module Dashboard** (`dashboard`)

#### Frontend :
- ✅ **`src/pages/Dashboard.tsx`** - Composant principal

#### Mapping dans `moduleService.ts` :
```typescript
'dashboard': 'dashboard',
'tableau_de_bord': 'dashboard',
```

---

### 12. **Module Entreprises** (`entreprises`)

#### Frontend :
- ✅ **`src/pages/Entreprises.tsx`** - Composant principal
- ✅ **`src/pages/entreprises/`** - Sous-composants

#### Mapping dans `moduleService.ts` :
```typescript
'entreprises': 'entreprises',
'mon_entreprise': 'entreprises',
```

---

### 13. **Module Abonnements** (`abonnements`)

#### Frontend :
- ✅ **`src/pages/Abonnements.tsx`** - Composant principal
- ✅ **`src/pages/abonnements/`** - Sous-composants

#### Backend :
- Tables : `abonnements`, `plans_abonnement`, `plans_modules`

#### Mapping dans `moduleService.ts` :
```typescript
'abonnements': 'abonnements',
```

---

### 14. **Module Paramètres** (`settings`)

#### Frontend :
- ✅ **`src/pages/Parametres.tsx`** - Composant principal

#### Mapping dans `moduleService.ts` :
```typescript
'parametres': 'settings',
'settings': 'settings',
```

---

## 🔧 COMMENT AJOUTER UN NOUVEAU MODULE

### Étape 1 : Créer le composant Frontend
Créer `src/pages/NomModule.tsx` avec le composant React.

### Étape 2 : Ajouter la route dans `App.tsx`
```typescript
const NomModule = lazy(() => import('./pages/NomModule'));

// Dans les routes :
case 'nom-module':
  return <NomModule />;
```

### Étape 3 : Ajouter le mapping dans `moduleService.ts`
```typescript
export const moduleCodeToMenuId: Record<string, string> = {
  // ... autres modules
  'nom-module': 'nom-module',
  'nom_module': 'nom-module',
  'nomModule': 'nom-module',
};
```

### Étape 4 : Ajouter l'entrée dans `Layout.tsx`
```typescript
{
  id: 'nom-module',
  label: 'Nom Module',
  icon: IconComponent,
  moduleCode: 'nom-module'
}
```

### Étape 5 : Créer les migrations SQL (si nécessaire)
Créer `supabase/migrations/YYYYMMDDHHMMSS_create_nom_module.sql` avec :
- Tables nécessaires
- Fonctions RPC
- Triggers
- RLS Policies

### Étape 6 : Activer le module dans `Modules.tsx` (Super Admin)
Le module apparaîtra automatiquement dans la liste si :
- Il est dans `modules_activation` avec `est_cree = true`
- Il est mappé dans `moduleService.ts`

---

## 📊 RÉSUMÉ DES FICHIERS CLÉS

### Fichiers à modifier pour TOUS les modules :
1. ⭐ **`src/services/moduleService.ts`** - Mapping codes → menu IDs
2. ⭐ **`src/App.tsx`** - Routes
3. ⭐ **`src/components/Layout.tsx`** - Entrées de menu

### Fichiers spécifiques par module :
- **Frontend** : `src/pages/NomModule.tsx`
- **Services** : `src/services/nomModuleService.ts` (si nécessaire)
- **Backend** : `supabase/migrations/..._create_nom_module.sql`

### Fichiers de configuration :
- **`src/hooks/useClientModules.ts`** - Gestion des modules actifs (rarement modifié)
- **`src/pages/Modules.tsx`** - Interface activation (rarement modifié)

---

## 🎯 EXEMPLE : Module Comptabilité

### Fichiers utilisés :
1. ✅ **Frontend** : `src/pages/Comptabilite.tsx`
2. ✅ **Service** : `src/services/cotisationsService.ts`
3. ✅ **PDF** : `src/lib/pdfGeneratorFichePaie.ts`
4. ✅ **Mapping** : `src/services/moduleService.ts` (lignes 68-73)
5. ✅ **Route** : `src/App.tsx` (ligne 27, 104-110, 246-249)
6. ✅ **Menu** : `src/components/Layout.tsx` (ligne 67)
7. ✅ **Migrations** : 5 fichiers SQL dans `supabase/migrations/`

### Tables utilisées :
- `plan_comptable`
- `journaux_comptables`
- `ecritures_comptables`
- `fiches_paie`
- `declarations_fiscales`
- `bilans_comptables`
- `parametres_comptables`

---

**Dernière mise à jour :** 2025-01-22

