# 📋 PRD - Création de Modules

**Product Requirements Document**  
**Version :** 1.0  
**Date :** 29 janvier 2025  
**Statut :** ✅ Approuvé

---

## 📊 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Objectifs](#objectifs)
3. [Architecture actuelle](#architecture-actuelle)
4. [Spécifications techniques](#spécifications-techniques)
5. [Processus de création](#processus-de-création)
6. [Standards et conventions](#standards-et-conventions)
7. [Structure de fichiers](#structure-de-fichiers)
8. [Intégration base de données](#intégration-base-de-données)
9. [Tests et validation](#tests-et-validation)
10. [Documentation](#documentation)
11. [Roadmap](#roadmap)

---

## 🎯 VUE D'ENSEMBLE

### Contexte

L'application **Crea+Entreprises** est une plateforme SaaS multi-tenant permettant aux entreprises de gérer leur activité via un système modulaire. Chaque entreprise peut activer/désactiver des modules selon son abonnement et ses besoins.

### État actuel

- ✅ **9 modules Core** créés et fonctionnels
- ✅ **Système d'activation/désactivation** opérationnel
- ✅ **Intégration avec abonnements** fonctionnelle
- ⏳ **48+ modules métier** à créer progressivement

### Portée du PRD

Ce document définit le processus complet de création de nouveaux modules, de la conception à la mise en production, en garantissant la cohérence, la qualité et la maintenabilité.

---

## 🎯 OBJECTIFS

### Objectifs principaux

1. **Standardiser** le processus de création de modules
2. **Garantir la qualité** et la cohérence du code
3. **Faciliter la maintenance** et l'évolution
4. **Réutiliser** les fonctionnalités existantes
5. **Documenter** chaque module créé

### Objectifs secondaires

- Réduire le temps de développement
- Minimiser les bugs en production
- Faciliter l'onboarding de nouveaux développeurs
- Assurer la scalabilité du système

---

## 🏗️ ARCHITECTURE ACTUELLE

### Structure des modules

```
src/
├── pages/                    # Pages principales (1 page = 1 module)
│   ├── Dashboard.tsx         # ✅ Module Dashboard
│   ├── Clients.tsx           # ✅ Module Clients
│   ├── Factures.tsx          # ✅ Module Facturation
│   ├── Documents.tsx           # ✅ Module Documents
│   ├── Collaborateurs.tsx    # ✅ Module Collaborateurs
│   ├── GestionEquipe.tsx     # ✅ Module Gestion d'Équipe
│   ├── GestionProjets.tsx    # ✅ Module Gestion de Projets
│   └── [nouveau-module].tsx  # ⏳ Nouveau module à créer
│
├── components/               # Composants réutilisables
│   ├── Layout.tsx            # Layout principal avec sidebar
│   └── [composants].tsx      # Autres composants
│
├── services/                 # Services métier
│   ├── moduleService.ts      # Service de gestion des modules
│   └── [services].ts         # Autres services
│
├── hooks/                    # Hooks React personnalisés
│   ├── useAuth.ts            # Hook d'authentification
│   └── useClientModules.ts   # Hook de gestion des modules clients
│
└── lib/                      # Utilitaires
    ├── supabase.ts           # Client Supabase
    └── moduleReuse.ts         # Système de réutilisation de modules
```

### Base de données

#### Tables principales

1. **`modules_activation`** - Catalogue des modules
   ```sql
   - module_code (text, PK)      -- Code unique du module
   - module_nom (text)            -- Nom affiché
   - module_description (text)   -- Description
   - categorie (text)            -- core, premium, option, admin
   - secteur_activite (text)     -- BTP, Commerce, etc.
   - actif (boolean)              -- Module actif dans la plateforme
   - est_cree (boolean)          -- Module créé et fonctionnel
   - prix_optionnel (numeric)    -- Prix si module optionnel
   ```

2. **`plans_modules`** - Modules inclus dans les plans
   ```sql
   - plan_id (uuid, FK)
   - module_code (text, FK)
   - inclus (boolean)            -- Module inclus dans le plan
   - prix_mensuel (numeric)      -- Prix optionnel
   - prix_annuel (numeric)       -- Prix optionnel
   ```

3. **`espaces_membres_clients`** - Modules actifs par client
   ```sql
   - modules_actifs (jsonb)      -- {"module_code": true, ...}
   - abonnement_id (uuid, FK)    -- Abonnement lié
   ```

4. **`modules_dependencies`** - Dépendances entre modules
   ```sql
   - module_code (text, FK)
   - module_depend_de (text, FK) -- Module requis
   - type_dependance (text)      -- requis, optionnel, reutilise
   ```

---

## 🔧 SPÉCIFICATIONS TECHNIQUES

### Stack technique

- **Frontend :** React 19 + TypeScript + Vite 7
- **Backend :** Supabase (PostgreSQL + Auth + Storage)
- **Styling :** Tailwind CSS 3
- **Icons :** Lucide React
- **Build :** Vite (code splitting automatique)

### Standards de code

#### TypeScript

- ✅ **Strict mode** activé
- ✅ **Pas de `any`** (utiliser `unknown` ou types spécifiques)
- ✅ **Interfaces** pour tous les objets de données
- ✅ **Types** pour les props de composants

#### React

- ✅ **Hooks** pour la logique métier
- ✅ **Composants fonctionnels** uniquement
- ✅ **Lazy loading** pour les pages
- ✅ **Error boundaries** pour la gestion d'erreurs

#### Supabase

- ✅ **Gestion d'erreurs** systématique
- ✅ **RLS (Row Level Security)** activé
- ✅ **Types générés** depuis la base (optionnel)
- ✅ **Transactions** pour les opérations complexes

---

## 📝 PROCESSUS DE CRÉATION

### Étape 1 : Conception et planification

#### 1.1 Définition du module

**Checklist :**
- [ ] Nom du module clair et unique
- [ ] Code du module (format : `kebab-case`, ex: `gestion-stock`)
- [ ] Description fonctionnelle complète
- [ ] Secteur d'activité ciblé
- [ ] Priorité d'implémentation
- [ ] Dépendances identifiées

**Exemple :**
```markdown
**Module :** Gestion de Stock
**Code :** `gestion-stock`
**Secteur :** Transversal
**Priorité :** 2
**Dépendances :** Documents (optionnel), Factures (optionnel)
```

#### 1.2 Spécifications fonctionnelles

**Documenter :**
- Fonctionnalités principales
- Cas d'usage
- Règles métier
- Permissions requises
- Intégrations nécessaires

#### 1.3 Spécifications techniques

**Définir :**
- Tables de base de données nécessaires
- Relations avec tables existantes
- RLS policies requises
- Fonctions RPC nécessaires
- Composants React à créer

---

### Étape 2 : Création de la base de données

#### 2.1 Migration SQL

**Fichier :** `supabase/migrations/YYYYMMDDHHMMSS_create_module_[nom].sql`

**Contenu minimal :**
```sql
-- 1. Créer les tables nécessaires
CREATE TABLE IF NOT EXISTS [nom_table] (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  -- Autres colonnes
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Activer RLS
ALTER TABLE [nom_table] ENABLE ROW LEVEL SECURITY;

-- 3. Créer les policies RLS
CREATE POLICY "[nom]_select_policy"
  ON [nom_table] FOR SELECT
  TO authenticated
  USING (
    -- Super admin voit tout
    EXISTS (
      SELECT 1 FROM utilisateurs 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Utilisateur voit les données de son entreprise
    entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
    OR
    -- Client voit les données de son entreprise
    entreprise_id IN (
      SELECT entreprise_id FROM espaces_membres_clients
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "[nom]_insert_policy"
  ON [nom_table] FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Même logique que SELECT
  );

-- 4. Créer les fonctions RPC si nécessaire
CREATE OR REPLACE FUNCTION [nom_fonction](
  p_param1 type1,
  p_param2 type2
) RETURNS jsonb AS $$
BEGIN
  -- Logique de la fonction
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ajouter le module dans modules_activation
INSERT INTO modules_activation (
  module_code,
  module_nom,
  module_description,
  categorie,
  secteur_activite,
  actif,
  est_cree
) VALUES (
  '[code-module]',
  '[Nom du Module]',
  '[Description]',
  'premium', -- ou 'option'
  '[secteur]',
  true,
  true
) ON CONFLICT (module_code) DO UPDATE SET
  est_cree = true,
  actif = true;
```

#### 2.2 Vérifications

- [ ] Migration testée localement
- [ ] RLS policies testées
- [ ] Fonctions RPC testées
- [ ] Index créés si nécessaire
- [ ] Contraintes de validation ajoutées

---

### Étape 3 : Création du composant React

#### 3.1 Structure du fichier

**Fichier :** `src/pages/[NomModule].tsx`

**Structure minimale :**
```typescript
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { [Icons] } from 'lucide-react';

// Interfaces TypeScript
interface [Nom]Data {
  id: string;
  entreprise_id: string;
  // Autres champs
  created_at: string;
}

export default function [NomModule]() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<[Nom]Data[]>([]);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');

  // Chargement des données
  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedEntreprise]);

  const loadData = async () => {
    if (!user || !selectedEntreprise) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('[nom_table]')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement:', error);
      alert('Erreur: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Rendu
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Contenu du module */}
    </div>
  );
}
```

#### 3.2 Fonctionnalités requises

**Obligatoires :**
- [ ] Gestion d'erreurs complète
- [ ] États de chargement
- [ ] Sélection d'entreprise (si multi-entreprise)
- [ ] CRUD complet (Create, Read, Update, Delete)
- [ ] Validation des données
- [ ] Messages de confirmation/erreur

**Recommandées :**
- [ ] Recherche/filtrage
- [ ] Pagination (si beaucoup de données)
- [ ] Export de données
- [ ] Actions en lot
- [ ] Historique des modifications

---

### Étape 4 : Intégration dans l'application

#### 4.1 Ajout dans App.tsx

```typescript
// Lazy loading
const [NomModule] = lazy(() => import('./pages/[NomModule]'));

// Route dans renderPage()
case '[route]':
  return (
    <Suspense fallback={<PageLoader />}>
      <[NomModule] />
    </Suspense>
  );
```

#### 4.2 Ajout dans Layout.tsx

**Menu item :**
```typescript
{
  id: '[route]',
  label: '[Nom du Module]',
  icon: [IconComponent],
  superAdminOnly: false, // ou true si réservé super admin
}
```

#### 4.3 Mapping dans moduleService.ts

```typescript
export const moduleCodeToMenuId: Record<string, string> = {
  // ...
  '[code-module]': '[route]',
  '[code-module-alt]': '[route]', // Variantes possibles
};
```

---

### Étape 5 : Gestion des rôles et permissions

#### 5.1 Détection du rôle

```typescript
const [isClient, setIsClient] = useState(false);
const [isSuperAdmin, setIsSuperAdmin] = useState(false);

useEffect(() => {
  checkUserRole();
}, [user]);

const checkUserRole = async () => {
  if (!user) return;
  
  // Vérifier si client
  const { data: espaceClient } = await supabase
    .from('espaces_membres_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  setIsClient(!!espaceClient);
  
  // Vérifier si super admin
  if (!espaceClient) {
    const { data: isAdmin } = await supabase.rpc('is_platform_super_admin');
    setIsSuperAdmin(isAdmin === true);
  }
};
```

#### 5.2 Adaptation de l'interface

- **Clients :** Afficher uniquement leurs données
- **Super Admin :** Afficher toutes les données
- **Masquer** les fonctionnalités non autorisées

---

### Étape 6 : Tests et validation

#### 6.1 Tests fonctionnels

**Checklist :**
- [ ] Création d'un élément fonctionne
- [ ] Modification d'un élément fonctionne
- [ ] Suppression d'un élément fonctionne
- [ ] Recherche/filtrage fonctionne
- [ ] Gestion d'erreurs testée
- [ ] RLS policies respectées

#### 6.2 Tests de rôles

**Checklist :**
- [ ] Client voit uniquement ses données
- [ ] Super admin voit toutes les données
- [ ] Permissions respectées
- [ ] Actions non autorisées bloquées

#### 6.3 Tests de performance

**Checklist :**
- [ ] Chargement rapide (< 2s)
- [ ] Pas de requêtes N+1
- [ ] Pagination si nécessaire
- [ ] Optimisation des images/assets

---

## 📋 STANDARDS ET CONVENTIONS

### Nommage

#### Fichiers
- **Pages :** `PascalCase.tsx` (ex: `GestionStock.tsx`)
- **Composants :** `PascalCase.tsx` (ex: `StockCard.tsx`)
- **Services :** `camelCase.ts` (ex: `stockService.ts`)
- **Hooks :** `camelCase.ts` avec préfixe `use` (ex: `useStock.ts`)
- **Types :** `camelCase.ts` (ex: `stockTypes.ts`)

#### Variables et fonctions
- **Variables :** `camelCase` (ex: `stockItems`)
- **Fonctions :** `camelCase` (ex: `loadStock()`)
- **Constantes :** `UPPER_SNAKE_CASE` (ex: `MAX_STOCK_ITEMS`)
- **Interfaces :** `PascalCase` (ex: `StockItem`)

#### Base de données
- **Tables :** `snake_case` (ex: `stock_items`)
- **Colonnes :** `snake_case` (ex: `entreprise_id`)
- **Fonctions RPC :** `snake_case` avec préfixe (ex: `get_stock_items`)

### Code style

#### TypeScript
```typescript
// ✅ BON
interface StockItem {
  id: string;
  nom: string;
  quantite: number;
}

const loadStock = async (): Promise<StockItem[]> => {
  // ...
};

// ❌ MAUVAIS
const loadStock = async (): Promise<any[]> => {
  // ...
};
```

#### React
```typescript
// ✅ BON - Gestion d'erreurs
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  setData(data || []);
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Erreur';
  console.error('Erreur:', error);
  alert(errorMessage);
}

// ❌ MAUVAIS - Pas de gestion d'erreurs
const { data } = await supabase.from('table').select('*');
setData(data);
```

---

## 📁 STRUCTURE DE FICHIERS

### Module simple

```
src/pages/
└── GestionStock.tsx          # Page principale du module
```

### Module complexe

```
src/pages/
└── gestion-stock/            # Dossier du module
    ├── GestionStock.tsx       # Page principale (routeur)
    ├── StockList.tsx          # Liste des éléments
    ├── StockForm.tsx          # Formulaire création/édition
    ├── StockDetails.tsx       # Détails d'un élément
    └── types.ts               # Types TypeScript du module
```

### Services associés

```
src/services/
└── stockService.ts            # Service métier du module
```

---

## 🗄️ INTÉGRATION BASE DE DONNÉES

### Tables

#### Convention de nommage
- Préfixe avec le nom du module (ex: `stock_items`, `stock_mouvements`)
- Toujours inclure `entreprise_id` pour l'isolation multi-tenant
- Toujours inclure `created_at` et `updated_at`

#### Structure minimale
```sql
CREATE TABLE stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  nom text NOT NULL,
  quantite integer DEFAULT 0,
  -- Autres colonnes
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### RLS Policies

#### Policy SELECT (lecture)
```sql
CREATE POLICY "stock_items_select_policy"
  ON stock_items FOR SELECT
  TO authenticated
  USING (
    -- Super admin voit tout
    EXISTS (
      SELECT 1 FROM utilisateurs 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Utilisateur voit les données de son entreprise
    entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
    OR
    -- Client voit les données de son entreprise
    entreprise_id IN (
      SELECT entreprise_id FROM espaces_membres_clients
      WHERE user_id = auth.uid()
    )
  );
```

#### Policy INSERT (création)
```sql
CREATE POLICY "stock_items_insert_policy"
  ON stock_items FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Même logique que SELECT
    entreprise_id IN (
      SELECT id FROM entreprises WHERE user_id = auth.uid()
    )
    OR
    entreprise_id IN (
      SELECT entreprise_id FROM espaces_membres_clients
      WHERE user_id = auth.uid()
    )
  );
```

#### Policy UPDATE (modification)
```sql
CREATE POLICY "stock_items_update_policy"
  ON stock_items FOR UPDATE
  TO authenticated
  USING (
    -- Même logique que SELECT
  )
  WITH CHECK (
    -- Même logique que SELECT
  );
```

#### Policy DELETE (suppression)
```sql
CREATE POLICY "stock_items_delete_policy"
  ON stock_items FOR DELETE
  TO authenticated
  USING (
    -- Même logique que SELECT
  );
```

### Fonctions RPC

#### Convention
- Préfixe avec verbe d'action (ex: `get_`, `create_`, `update_`, `delete_`)
- Paramètres avec préfixe `p_` (ex: `p_stock_id`)
- Retourner `jsonb` avec `{ success: boolean, data?: any, error?: string }`

#### Exemple
```sql
CREATE OR REPLACE FUNCTION get_stock_items(
  p_entreprise_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_items jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(s))
  INTO v_items
  FROM stock_items s
  WHERE s.entreprise_id = p_entreprise_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'data', COALESCE(v_items, '[]'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ✅ TESTS ET VALIDATION

### Checklist de validation

#### Fonctionnalités
- [ ] Toutes les fonctionnalités principales fonctionnent
- [ ] Gestion d'erreurs complète
- [ ] Validation des données côté client
- [ ] Messages utilisateur clairs

#### Sécurité
- [ ] RLS policies testées et fonctionnelles
- [ ] Permissions respectées selon les rôles
- [ ] Pas de données exposées entre entreprises
- [ ] Validation côté serveur (via RPC si nécessaire)

#### Performance
- [ ] Chargement rapide (< 2s)
- [ ] Pas de requêtes inutiles
- [ ] Pagination si > 100 éléments
- [ ] Optimisation des images/assets

#### Code quality
- [ ] Aucune erreur TypeScript
- [ ] Aucune erreur ESLint
- [ ] Code documenté
- [ ] Pas de code dupliqué

#### UX/UI
- [ ] Interface cohérente avec le reste de l'app
- [ ] Responsive (mobile, tablette, desktop)
- [ ] Accessible (contrastes, navigation clavier)
- [ ] Messages d'erreur clairs

---

## 📚 DOCUMENTATION

### Documentation requise

#### 1. Documentation technique

**Fichier :** `docs/modules/[nom-module].md`

**Contenu :**
- Description du module
- Architecture technique
- Tables de base de données
- Fonctions RPC
- Composants React
- Services associés

#### 2. Documentation utilisateur

**Fichier :** `docs/user-guide/[nom-module].md`

**Contenu :**
- Guide d'utilisation
- Captures d'écran
- Cas d'usage
- FAQ

#### 3. Changelog

**Fichier :** `CHANGELOG.md`

**Format :**
```markdown
## [Version] - YYYY-MM-DD

### Added
- Nouveau module : Gestion de Stock
- Fonctionnalité X
- Fonctionnalité Y

### Changed
- Amélioration de Z

### Fixed
- Correction bug A
```

---

## 🗺️ ROADMAP

### Phase 1 : Modules Transversaux (Priorité 1-10)

**Objectif :** Créer les modules utiles pour tous les secteurs

1. ✅ **Gestion de Projets** (`gestion-projets`) - **FAIT**
2. ⏳ **Gestion de Stock Générique** (`gestion-stock`) - Priorité 2
3. ⏳ **CRM Avancé** (`crm-avance`) - Priorité 3
4. ⏳ **Time Tracking** (`time-tracking`) - Priorité 4
5. ⏳ **Gestion de Budget** (`gestion-budget`) - Priorité 5

**Durée estimée :** 2-3 semaines par module

### Phase 2 : Modules Métier (Priorité 11+)

**Objectif :** Créer les modules spécifiques par secteur

**Ordre de priorité :**
1. BTP / Construction (5 modules)
2. Services / Conseil (3 modules)
3. Commerce / Retail (5 modules)
4. Industrie / Production (4 modules)
5. Autres secteurs selon demande

**Durée estimée :** 1-2 semaines par module

---

## 📊 TEMPLATE DE CRÉATION

### Template de migration SQL

```sql
-- Migration: Create [Nom Module]
-- Date: YYYY-MM-DD
-- Auteur: [Nom]

-- 1. Créer les tables
CREATE TABLE IF NOT EXISTS [nom_table] (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  -- Colonnes spécifiques
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_[nom_table]_entreprise ON [nom_table](entreprise_id);
CREATE INDEX IF NOT EXISTS idx_[nom_table]_created ON [nom_table](created_at);

-- 3. RLS
ALTER TABLE [nom_table] ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "[nom]_select" ON [nom_table] FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM utilisateurs WHERE id = auth.uid() AND role = 'super_admin')
  OR entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "[nom]_insert" ON [nom_table] FOR INSERT TO authenticated WITH CHECK (
  entreprise_id IN (SELECT id FROM entreprises WHERE user_id = auth.uid())
  OR entreprise_id IN (SELECT entreprise_id FROM espaces_membres_clients WHERE user_id = auth.uid())
);

CREATE POLICY "[nom]_update" ON [nom_table] FOR UPDATE TO authenticated USING (
  -- Même logique que SELECT
) WITH CHECK (
  -- Même logique que SELECT
);

CREATE POLICY "[nom]_delete" ON [nom_table] FOR DELETE TO authenticated USING (
  -- Même logique que SELECT
);

-- 4. Fonctions RPC si nécessaire
CREATE OR REPLACE FUNCTION [nom_fonction](
  p_entreprise_id uuid
) RETURNS jsonb AS $$
BEGIN
  -- Logique
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ajouter le module
INSERT INTO modules_activation (
  module_code, module_nom, module_description, categorie, secteur_activite, actif, est_cree
) VALUES (
  '[code-module]', '[Nom]', '[Description]', 'premium', '[secteur]', true, true
) ON CONFLICT (module_code) DO UPDATE SET est_cree = true, actif = true;
```

### Template de composant React

```typescript
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { [Icons] } from 'lucide-react';

interface [Nom]Data {
  id: string;
  entreprise_id: string;
  // Champs spécifiques
  created_at: string;
}

export default function [NomModule]() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<[Nom]Data[]>([]);
  const [selectedEntreprise, setSelectedEntreprise] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedEntreprise]);

  const loadData = async () => {
    if (!user || !selectedEntreprise) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('[nom_table]')
        .select('*')
        .eq('entreprise_id', selectedEntreprise)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur chargement:', error);
      alert('Erreur: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">[Nom du Module]</h1>
        <p className="text-gray-300">[Description]</p>
      </div>

      {/* Contenu du module */}
    </div>
  );
}
```

---

## 🎯 CRITÈRES D'ACCEPTATION

### Pour qu'un module soit considéré comme "terminé"

1. ✅ **Fonctionnel**
   - Toutes les fonctionnalités principales implémentées
   - Pas de bugs critiques
   - Gestion d'erreurs complète

2. ✅ **Sécurisé**
   - RLS policies testées et fonctionnelles
   - Permissions respectées
   - Pas de fuite de données

3. ✅ **Testé**
   - Tests fonctionnels passés
   - Tests de rôles passés
   - Tests de performance acceptables

4. ✅ **Documenté**
   - Documentation technique complète
   - Documentation utilisateur créée
   - Code commenté si nécessaire

5. ✅ **Intégré**
   - Module visible dans le menu
   - Activation/désactivation fonctionnelle
   - Synchronisation avec abonnements OK

6. ✅ **Code quality**
   - Aucune erreur TypeScript
   - Aucune erreur ESLint
   - Code conforme aux standards

---

## 📈 MÉTRIQUES DE SUCCÈS

### Indicateurs techniques

- **Taux d'erreurs :** < 1% des requêtes
- **Temps de chargement :** < 2 secondes
- **Couverture de tests :** > 80% (objectif)
- **Code quality score :** A (ESLint)

### Indicateurs fonctionnels

- **Taux d'adoption :** % d'entreprises utilisant le module
- **Satisfaction utilisateur :** Feedback positif
- **Taux de bugs :** < 5 bugs critiques par mois

---

## 🔄 PROCESSUS DE MAINTENANCE

### Mises à jour

1. **Correction de bugs :** Hotfix immédiat
2. **Améliorations mineures :** Version patch
3. **Nouvelles fonctionnalités :** Version mineure
4. **Refactoring majeur :** Version majeure

### Versioning

**Format :** `MAJOR.MINOR.PATCH`

- **MAJOR :** Changements incompatibles
- **MINOR :** Nouvelles fonctionnalités compatibles
- **PATCH :** Corrections de bugs

---

## 📞 SUPPORT ET RESSOURCES

### Ressources disponibles

- **Documentation technique :** `/docs/`
- **Templates :** Voir section "Template de création"
- **Exemples :** Modules existants (Dashboard, Clients, Factures)
- **Services :** `moduleService.ts`, `moduleReuse.ts`

### Processus de support

1. **Question technique :** Consulter la documentation
2. **Bug détecté :** Créer une issue avec détails
3. **Demande de fonctionnalité :** Proposer via PRD

---

## ✅ CONCLUSION

Ce PRD définit le processus complet de création de modules pour l'application Crea+Entreprises. En suivant ces guidelines, nous garantissons :

- ✅ **Cohérence** entre les modules
- ✅ **Qualité** du code
- ✅ **Sécurité** des données
- ✅ **Maintenabilité** à long terme
- ✅ **Scalabilité** du système

**Prochaine étape :** Commencer la création du premier module selon la roadmap définie.

---

**Document créé le :** 29 janvier 2025  
**Dernière mise à jour :** 29 janvier 2025  
**Version :** 1.0

