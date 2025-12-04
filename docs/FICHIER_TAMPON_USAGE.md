# 📋 GUIDE D'UTILISATION DU FICHIER TAMPON

## ⚠️ CRITIQUE : Fichier `src/types/shared.ts`

Ce fichier sert de **TAMPON** entre tous les modules pour éviter les conflits de variables et garantir la cohérence des données.

## 🎯 RÈGLES D'OR

### ✅ À FAIRE

1. **TOUJOURS importer depuis `shared.ts`** :
```typescript
import { Entreprise, Facture, Client } from '../../types/shared';
```

2. **Si un module a besoin d'un nouveau champ partagé** :
   - L'ajouter dans `shared.ts` dans l'interface correspondante
   - Documenter pourquoi (ex: "Module Comptabilité")
   - Vérifier l'impact sur les autres modules

3. **Si un module modifie un type** :
   - Mettre à jour dans `shared.ts`
   - Vérifier tous les fichiers qui utilisent ce type
   - Tester tous les modules concernés

### ❌ À NE JAMAIS FAIRE

1. **Ne JAMAIS créer de types dupliqués** :
```typescript
// ❌ MAUVAIS
interface Entreprise {
  id: string;
  nom: string;
  // ...
}

// ✅ BON
import { Entreprise } from '../../types/shared';
```

2. **Ne JAMAIS modifier un type directement dans un module** :
```typescript
// ❌ MAUVAIS
interface Entreprise {
  code_ape?: string; // Ajouté localement
}

// ✅ BON
// Modifier dans shared.ts, puis importer
```

## 📝 EXEMPLE : Module Comptabilité

### Problème
Le module Comptabilité a besoin de `code_ape`, `code_naf`, `convention_collective` dans `Entreprise`.

### Solution
1. Ajouter dans `src/types/shared.ts` :
```typescript
export interface Entreprise {
  // ... champs existants
  // ✅ AJOUTÉ PAR MODULE COMPTABILITÉ
  code_ape?: string | null;
  code_naf?: string | null;
  convention_collective?: string | null;
}
```

2. Importer dans tous les fichiers qui utilisent `Entreprise` :
```typescript
import { Entreprise } from '../../types/shared';
```

3. Mettre à jour la fonction SQL `create_complete_entreprise_automated` pour accepter ces paramètres.

## 🔄 WORKFLOW DE MODIFICATION

1. **Identifier le besoin** : Un module a besoin d'un nouveau champ
2. **Vérifier `shared.ts`** : Le champ existe-t-il déjà ?
3. **Si non, ajouter dans `shared.ts`** : Avec documentation
4. **Mettre à jour les fonctions SQL** : Si nécessaire
5. **Remplacer les interfaces locales** : Par import depuis `shared.ts`
6. **Tester tous les modules** : Vérifier qu'il n'y a pas de régression

## 📊 MODULES CONCERNÉS

- ✅ **Facturation** : Utilise `Facture`, `FactureLigne`, `Client`
- ✅ **Comptabilité** : Utilise `Entreprise` (avec code_ape, code_naf, convention_collective)
- ✅ **CRM** : Utilise `Client`, `ClientContact`
- ✅ **Entreprises** : Utilise `Entreprise`
- ✅ **Notifications** : Utilise `Notification`
- ✅ **Documents** : Utilise `ParametresDocuments`

## 🚨 EN CAS DE CONFLIT

Si deux modules modifient le même champ différemment :

1. **Analyser les besoins** : Qu'est-ce que chaque module veut faire ?
2. **Créer un champ commun** : Dans `shared.ts`
3. **Adapter les deux modules** : Pour utiliser le champ commun
4. **Tester** : Vérifier que tout fonctionne

## ✅ CHECKLIST AVANT DE MODIFIER UN TYPE

- [ ] Le champ n'existe pas déjà dans `shared.ts` ?
- [ ] J'ai documenté pourquoi j'ajoute ce champ ?
- [ ] J'ai vérifié l'impact sur les autres modules ?
- [ ] J'ai remplacé les interfaces locales par l'import depuis `shared.ts` ?
- [ ] J'ai testé tous les modules concernés ?

