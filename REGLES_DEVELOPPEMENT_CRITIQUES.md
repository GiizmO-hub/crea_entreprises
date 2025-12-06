# ⚠️ RÈGLES DE DÉVELOPPEMENT CRITIQUES - À RESPECTER ABSOLUMENT

**⚠️ TRÈS IMPORTANT :** La moindre erreur impacte toute l'application. Ces règles sont **OBLIGATOIRES** et **SANS EXCEPTION**.

---

## 🎯 RÈGLE #1 : FICHIER TAMPON (`src/types/shared.ts`)

### ✅ TOUJOURS UTILISER `shared.ts` - SANS EXCEPTION

**Pourquoi :**
- Évite les petites erreurs
- Évite les conflits entre modules
- Évite de perdre du temps à corriger

**Règles strictes :**
1. ✅ **TOUJOURS** importer depuis `shared.ts` pour les types partagés
2. ✅ **JAMAIS** créer de types dupliqués dans d'autres fichiers
3. ✅ **MÊME pour de petits ajouts** → Toujours dans `shared.ts`
4. ✅ Si un module a besoin d'un nouveau champ partagé → **AJOUTER ICI** (pas ailleurs)

**Exemple :**
```typescript
// ✅ CORRECT
import { Entreprise, Facture, Client } from '../../types/shared';

// ❌ INTERDIT - JAMAIS FAIRE ÇA
interface Entreprise {
  id: string;
  nom: string;
  // ...
}
```

**Checklist avant modification :**
- [ ] Le type existe-t-il déjà dans `shared.ts` ?
- [ ] Si non, l'ai-je ajouté dans `shared.ts` ?
- [ ] Ai-je importé depuis `shared.ts` et non créé localement ?

---

## 🎯 RÈGLE #2 : MIGRATIONS SQL - VÉRIFICATION OBLIGATOIRE

### ✅ TOUJOURS VÉRIFIER LES MIGRATIONS EXISTANTES AVANT DE CRÉER UNE NOUVELLE

**Pourquoi :**
- Évite les conflits
- Évite les bugs
- Évite le manque de données
- La moindre erreur impacte toute l'application

**Processus OBLIGATOIRE :**

1. **AVANT de créer une migration :**
   - [ ] Chercher TOUTES les migrations qui touchent les mêmes tables
   - [ ] Chercher TOUTES les migrations qui touchent les mêmes fonctions
   - [ ] Vérifier les contraintes existantes
   - [ ] Vérifier les triggers existants
   - [ ] Vérifier les colonnes existantes
   - [ ] Identifier les conflits potentiels

2. **Pendant la création :**
   - [ ] Utiliser `DROP IF EXISTS` / `CREATE OR REPLACE` partout
   - [ ] Vérifier l'existence avant de créer (DO $$ ... END $$)
   - [ ] Utiliser les types du fichier tampon (`shared.ts`) comme référence
   - [ ] Tester la migration sur une base de test si possible

3. **Vérifications spécifiques :**
   - [ ] Pas de colonnes déjà existantes
   - [ ] Pas de fonctions avec signatures différentes
   - [ ] Pas de triggers déjà créés
   - [ ] Pas de contraintes en double
   - [ ] Pas d'index dupliqués

**Exemple de migration sécurisée :**
```sql
-- ✅ CORRECT : Vérifier avant de créer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ma_table'
  ) THEN
    CREATE TABLE ma_table (...);
  END IF;
END $$;

-- ✅ CORRECT : Supprimer avant de recréer
DROP FUNCTION IF EXISTS ma_fonction CASCADE;
CREATE OR REPLACE FUNCTION ma_fonction(...) ...;

-- ❌ INTERDIT : Créer sans vérifier
CREATE TABLE ma_table (...); -- Erreur si existe déjà
```

**Checklist avant création migration :**
- [ ] Ai-je cherché toutes les migrations existantes qui touchent les mêmes tables/fonctions ?
- [ ] Ai-je identifié tous les conflits potentiels ?
- [ ] Ai-je utilisé `DROP IF EXISTS` / `CREATE OR REPLACE` ?
- [ ] Ai-je vérifié l'existence avant de créer ?
- [ ] Ai-je utilisé les types de `shared.ts` comme référence ?

---

## 🎯 RÈGLE #3 : PROCÉDER DIRECTEMENT AVEC CETTE MÉTHODOLOGIE

### ✅ SUIVRE LA MÉTHODOLOGIE = AUCUNE ERREUR

**Confiance :** Si je suis cette méthodologie, il n'y aura pas d'erreurs. C'est une certitude.

**Méthodologie à suivre :**

1. **Avant TOUTE modification :**
   - Vérifier `shared.ts` pour les types
   - Vérifier les migrations existantes
   - Vérifier les fichiers existants qui utilisent les mêmes données

2. **Pendant la modification :**
   - Utiliser `shared.ts` pour les types
   - Créer des migrations sécurisées
   - Respecter les conventions de nommage

3. **Après la modification :**
   - Vérifier qu'il n'y a pas de conflits
   - Vérifier que tout fonctionne
   - Documenter si nécessaire

---

## 📋 CHECKLIST GLOBALE AVANT TOUTE ACTION

### Avant de modifier un fichier :

- [ ] Ai-je vérifié `shared.ts` pour les types ?
- [ ] Ai-je importé depuis `shared.ts` et non créé localement ?
- [ ] Ai-je vérifié les migrations existantes si je modifie la DB ?
- [ ] Ai-je identifié tous les conflits potentiels ?
- [ ] Ai-je utilisé les bonnes pratiques (DROP IF EXISTS, etc.) ?

### Avant de créer une migration :

- [ ] Ai-je cherché TOUTES les migrations qui touchent les mêmes tables/fonctions ?
- [ ] Ai-je vérifié les contraintes, triggers, colonnes existants ?
- [ ] Ai-je utilisé `DROP IF EXISTS` / `CREATE OR REPLACE` ?
- [ ] Ai-je vérifié l'existence avant de créer ?
- [ ] Ai-je utilisé les types de `shared.ts` comme référence ?

### Avant d'ajouter un nouveau champ partagé :

- [ ] Le champ existe-t-il déjà dans `shared.ts` ?
- [ ] Si non, l'ai-je ajouté dans `shared.ts` ?
- [ ] Ai-je documenté pourquoi (ex: "Module Comptabilité") ?
- [ ] Ai-je vérifié l'impact sur les autres modules ?

---

## 🚨 RAPPEL CRITIQUE

**⚠️ LA MOINDRE ERREUR IMPACTE TOUTE L'APPLICATION**

- Une erreur dans `shared.ts` → Tous les modules sont affectés
- Une erreur dans une migration → Toute la base de données est affectée
- Un conflit de types → Tous les fichiers qui utilisent ce type sont affectés

**C'est pourquoi ces règles sont OBLIGATOIRES et SANS EXCEPTION.**

---

## ✅ RÉSULTAT ATTENDU

Si je suis cette méthodologie :
- ✅ Aucune erreur
- ✅ Aucun conflit
- ✅ Aucun bug
- ✅ Pas de perte de temps à corriger
- ✅ Application stable et cohérente

---

**Dernière mise à jour :** 2025-01-22  
**Statut :** ⚠️ RÈGLES CRITIQUES - À RESPECTER ABSOLUMENT

