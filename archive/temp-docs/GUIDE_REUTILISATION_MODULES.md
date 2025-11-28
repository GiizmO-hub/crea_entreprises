# 🔄 Guide : Réutilisation des Modules Existants

**Objectif :** Éviter de recréer des fonctionnalités déjà existantes en réutilisant les modules de base (facturation, documents, équipes, etc.)

---

## 🎯 Principe

Lors de la création d'un nouveau module, **ne pas recréer** les fonctionnalités qui existent déjà. À la place, **réutiliser** les modules existants via le système de dépendances.

---

## 📋 Modules Existants à Réutiliser

### Modules Core Disponibles :

1. **`clients`** - Gestion des Clients
   - CRUD clients
   - Fiches clients
   - Historique

2. **`facturation`** - Facturation
   - Création factures
   - Lignes de facturation
   - PDF
   - Statuts (brouillon, envoyée, payée)
   - Proforma, avoirs

3. **`documents`** - Gestion de Documents
   - Upload/download
   - Dossiers hiérarchiques
   - Catégorisation
   - Tags
   - Archivage

4. **`collaborateurs`** - Gestion des Collaborateurs
   - CRUD collaborateurs
   - Rôles
   - Statuts

5. **`gestion-equipe`** - Gestion d'Équipe
   - Création équipes
   - Attribution membres
   - Permissions dossiers

---

## 🔗 Comment Définir les Dépendances

### Dans la Migration SQL :

```sql
-- Exemple : Gestion de Projets réutilise Gestion d'Équipe
INSERT INTO modules_dependencies (
  module_code,
  module_depend_de,
  type_dependance,
  description,
  configuration
) VALUES (
  'gestion-projets',        -- Module qui utilise
  'gestion-equipe',         -- Module réutilisé
  'reutilise',              -- Type : 'requis', 'optionnel', ou 'reutilise'
  'Utilise le module Gestion d''Équipe pour assigner des équipes aux projets',
  '{"use_teams": true, "assign_teams_to_projects": true}'::jsonb
);
```

### Types de Dépendances :

1. **`requis`** : Le module NE PEUT PAS fonctionner sans celui-ci
   - Exemple : Time Tracking → Collaborateurs (requis)
   - Si Collaborateurs est désactivé, Time Tracking ne peut pas être activé

2. **`reutilise`** : Le module réutilise les fonctionnalités existantes
   - Exemple : Gestion de Projets → Gestion d'Équipe (réutilise)
   - Utilise directement les équipes existantes

3. **`optionnel`** : Le module peut utiliser cette fonctionnalité si disponible
   - Exemple : Gestion de Stock → Facturation (optionnel)
   - Peut facturer les mouvements de stock si Facturation est activée

---

## 💻 Utilisation dans le Code Frontend

### 1. Récupérer les Dépendances

```typescript
import { getModuleDependencies, canReuseModule } from '../lib/moduleReuse';

// Récupérer toutes les dépendances d'un module
const dependencies = await getModuleDependencies('gestion-projets');

// Vérifier si un module spécifique peut être réutilisé
const canReuse = await canReuseModule('gestion-projets', 'gestion-equipe');
```

### 2. Naviguer vers un Module Réutilisable

```typescript
import { navigateToReusableModule } from '../lib/moduleReuse';

// Dans un composant
const handleOpenTeams = () => {
  navigateToReusableModule('gestion-equipe', onNavigate);
};
```

### 3. Afficher un Lien vers un Module Réutilisable

```typescript
import { getModuleLabel, getModuleIcon } from '../lib/moduleReuse';

// Afficher un bouton/lien
<button onClick={() => navigateToReusableModule('gestion-equipe', onNavigate)}>
  <Icon name={getModuleIcon('gestion-equipe')} />
  {getModuleLabel('gestion-equipe')}
</button>
```

---

## 🎨 Exemple d'Implémentation : Gestion de Projets

### Structure de la Page

```typescript
import { getModuleDependencies, canReuseModule, navigateToReusableModule, getModuleLabel } from '../lib/moduleReuse';

export default function GestionProjets({ onNavigate }: Props) {
  const [dependencies, setDependencies] = useState<ModuleDependency[]>([]);
  
  useEffect(() => {
    loadDependencies();
  }, []);
  
  const loadDependencies = async () => {
    const deps = await getModuleDependencies('gestion-projets');
    setDependencies(deps);
  };
  
  // Fonction pour ouvrir le module d'équipe réutilisé
  const handleOpenTeams = async () => {
    const canReuse = await canReuseModule('gestion-projets', 'gestion-equipe');
    if (canReuse) {
      navigateToReusableModule('gestion-equipe', onNavigate);
    } else {
      alert('Le module Gestion d\'Équipe doit être activé pour utiliser cette fonctionnalité');
    }
  };
  
  return (
    <div>
      {/* Section principale du module */}
      
      {/* Section réutilisation : Assigner une équipe */}
      {dependencies.find(d => d.module_depend_de === 'gestion-equipe') && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 mb-2">
            Ce projet peut utiliser les équipes existantes
          </p>
          <button 
            onClick={handleOpenTeams}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Ouvrir {getModuleLabel('gestion-equipe')}
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Dépendances Configurées (Phase 1)

### Gestion de Projets
- ✅ Réutilise **Gestion d'Équipe** (assigner équipes aux projets)
- ✅ Réutilise **Collaborateurs** (assigner collaborateurs aux tâches)
- ⚠️ Optionnel **Documents** (stockage fichiers projets)

### Gestion de Stock
- ✅ Réutilise **Documents** (fiches produits, images)
- ⚠️ Optionnel **Facturation** (facturer mouvements)

### CRM Avancé
- ✅ Réutilise **Clients** (base CRM existante)
- ⚠️ Optionnel **Documents** (documents commerciaux)

### Time Tracking
- 🔴 Requis **Collaborateurs** (nécessite collaborateurs)
- ⚠️ Optionnel **Facturation** (facturation heures)

### Gestion de Budget
- 🔴 Requis **Facturation** (analyse revenus)

---

## ✅ Checklist lors de la Création d'un Nouveau Module

1. [ ] Identifier les fonctionnalités déjà existantes
2. [ ] Définir les dépendances dans la migration SQL
3. [ ] Utiliser `getModuleDependencies()` pour charger les dépendances
4. [ ] Vérifier avec `canReuseModule()` avant d'utiliser un module
5. [ ] Afficher des liens vers les modules réutilisables
6. [ ] Ne pas recréer les fonctionnalités existantes

---

## 🔍 Vérifier les Dépendances dans la Console

```typescript
// Tester dans la console du navigateur
import { getModuleDependencies } from './lib/moduleReuse';

const deps = await getModuleDependencies('gestion-projets');
console.log('Dépendances:', deps);
```

---

**En réutilisant les modules existants, on évite la duplication de code et on garantit la cohérence !** 🎯




