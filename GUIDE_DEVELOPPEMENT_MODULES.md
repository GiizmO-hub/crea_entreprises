# 📘 GUIDE DE DÉVELOPPEMENT - MODULES ET FICHIER TAMPON

## ✅ COMPRÉHENSION CONFIRMÉE

### 1. FICHIER TAMPON (`src/types/shared.ts`)

**RÔLE CRITIQUE :**
- ✅ **UNIQUE SOURCE DE VÉRITÉ** pour tous les types/interfaces partagés entre modules
- ✅ **ÉVITE LES CONFLITS** de variables, types, et interfaces entre modules
- ✅ **GARANTIT LA COHÉRENCE** des données à travers toute l'application

**RÈGLES STRICTES :**
1. ✅ **TOUS** les modules DOIVENT utiliser les types définis dans `shared.ts`
2. ✅ Si un module a besoin d'un nouveau champ partagé → **AJOUTER ICI** (pas ailleurs)
3. ✅ **JAMAIS** créer de types dupliqués dans d'autres fichiers
4. ✅ Si un module modifie un type → **METTRE À JOUR ICI** et vérifier l'impact sur tous les modules

**EXEMPLE CONCRET :**
```typescript
// ✅ CORRECT : Utiliser le fichier tampon
import type { Entreprise } from '../../types/shared';

// ❌ INCORRECT : Créer un type dupliqué
export interface Entreprise { ... } // DANS clients/types.ts
```

**CHAMPS PARTAGÉS ACTUELS :**
- `Entreprise` : utilisé par Facturation, Comptabilité, CRM, Projets, Stock, etc.
- `Client` : utilisé par Facturation, CRM, Clients, etc.
- `Facture` : utilisé par Facturation, Comptabilité, etc.
- `Notification` : utilisé par tous les modules

---

### 2. MIGRATIONS - PROCÉDURE STRICTE

**AVANT DE CRÉER UNE MIGRATION :**

1. ✅ **ANALYSER** toutes les migrations existantes qui touchent les mêmes tables/fonctions
2. ✅ **VÉRIFIER** les conflits potentiels (DROP/CREATE, contraintes, colonnes)
3. ✅ **OPTIMISER** la migration pour éviter les erreurs "already exists", "does not exist", etc.
4. ✅ **UTILISER** `DROP IF EXISTS` / `CREATE OR REPLACE` pour éviter les conflits
5. ✅ **VÉRIFIER** que la migration utilise les types du fichier tampon (`shared.ts`)

**BONNES PRATIQUES :**
```sql
-- ✅ CORRECT : Vérifier avant de créer
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ma_table') THEN
    CREATE TABLE ma_table (...);
  END IF;
END $$;

-- ✅ CORRECT : Supprimer avant de recréer
DROP FUNCTION IF EXISTS ma_fonction CASCADE;
CREATE OR REPLACE FUNCTION ma_fonction(...) ...;

-- ❌ INCORRECT : Créer sans vérifier
CREATE TABLE ma_table (...); -- Erreur si existe déjà
```

**CONFLITS À ÉVITER :**
- ❌ Colonnes déjà existantes
- ❌ Fonctions avec signatures différentes
- ❌ Triggers déjà créés
- ❌ Contraintes en double
- ❌ Index dupliqués

---

### 3. MODULE CRÉATION D'ENTREPRISE - ÉTAT ACTUEL

**✅ VÉRIFICATIONS EFFECTUÉES :**

#### Frontend (`src/pages/entreprises/EntreprisesPlateforme.tsx`)
- ✅ Utilise `import type { Entreprise } from '../../types/shared'` (fichier tampon)
- ✅ Appel RPC correct : `create_complete_entreprise_automated`
- ✅ Tous les champs sont passés correctement (code_ape, code_naf, convention_collective)

#### Backend (Migrations)
- ✅ Dernière migration : `20250203000008_fix_create_entreprise_signature_final.sql`
- ✅ Fonction `create_complete_entreprise_automated` avec signature EXACTE
- ✅ Utilise `DROP FUNCTION IF EXISTS ... CASCADE` avant création
- ✅ Crée `workflow_data` pour stocker les données du workflow
- ✅ Gère correctement les champs partagés (code_ape, code_naf, convention_collective)

#### Fonctions SQL
- ✅ `create_complete_entreprise_automated` : Crée entreprise + client + paiement + workflow_data
- ✅ `creer_facture_et_abonnement_apres_paiement` : Crée facture + abonnement + espace client
- ✅ `valider_paiement_carte_immediat` : Valide le paiement et déclenche le workflow complet

#### Suppression (`delete_entreprise_complete`)
- ✅ Supprime abonnements et options
- ✅ CASCADE supprime automatiquement : clients, espaces, factures, projets, CRM, stock, compta
- ✅ Triggers AFTER DELETE suppriment les auth.users liés
- ✅ Protection du compte créateur (meddecyril@icloud.com)

**✅ STATUT : CLEAN**
- ✅ Plus d'erreurs de signature de fonction
- ✅ Plus de conflits de types (fichier tampon utilisé)
- ✅ Plus d'erreurs de colonnes manquantes
- ✅ Workflow complet fonctionnel (0% → 100%)
- ✅ Suppression complète sans résidus

---

### 4. CHECKLIST AVANT CRÉATION D'UN NOUVEAU MODULE

**ÉTAPE 1 : ANALYSER LES BESOINS**
- [ ] Quels types/interfaces seront partagés avec d'autres modules ?
- [ ] Quelles tables seront créées/modifiées ?
- [ ] Y a-t-il des relations avec des tables existantes ?

**ÉTAPE 2 : UTILISER LE FICHIER TAMPON**
- [ ] Vérifier si les types nécessaires existent déjà dans `shared.ts`
- [ ] Si non, les ajouter dans `shared.ts` (pas ailleurs)
- [ ] Importer depuis `shared.ts` dans le nouveau module

**ÉTAPE 3 : ANALYSER LES MIGRATIONS EXISTANTES**
- [ ] Chercher toutes les migrations qui touchent les mêmes tables
- [ ] Vérifier les contraintes, triggers, fonctions existants
- [ ] Identifier les conflits potentiels

**ÉTAPE 4 : CRÉER LA MIGRATION OPTIMISÉE**
- [ ] Utiliser `DROP IF EXISTS` / `CREATE OR REPLACE` partout
- [ ] Vérifier l'existence avant de créer (DO $$ ... END $$)
- [ ] Tester la migration sur une base de test avant application

**ÉTAPE 5 : VÉRIFIER LA COHÉRENCE**
- [ ] Le frontend utilise les types de `shared.ts`
- [ ] Les migrations utilisent les mêmes noms de colonnes que `shared.ts`
- [ ] Pas de duplication de types/interfaces

---

## 🎯 RÉSULTAT ATTENDU

**AVANT (PROBLÈMES) :**
- ❌ Types dupliqués dans plusieurs fichiers
- ❌ Conflits de migrations ("already exists", "does not exist")
- ❌ Erreurs de signature de fonction
- ❌ Données incohérentes entre modules

**APRÈS (SOLUTION) :**
- ✅ Un seul fichier tampon (`shared.ts`) pour tous les types partagés
- ✅ Migrations optimisées sans conflits
- ✅ Fonctions SQL avec signatures correctes
- ✅ Données cohérentes à travers tous les modules
- ✅ Développement plus rapide et sans régression

---

## 📝 NOTES IMPORTANTES

1. **Le fichier tampon est CRITIQUE** : Ne jamais le contourner ou créer des types ailleurs
2. **Les migrations doivent être ANALYSÉES** avant création pour éviter les conflits
3. **Tester TOUJOURS** une migration sur une base de test avant application
4. **Documenter** les changements dans le fichier tampon pour référence future

---

**Dernière mise à jour :** 2025-02-03
**Statut module création entreprise :** ✅ CLEAN ET FONCTIONNEL

