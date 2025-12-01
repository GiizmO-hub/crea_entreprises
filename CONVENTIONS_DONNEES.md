# 📋 CONVENTIONS DE DONNÉES PARTAGÉES

Ce document définit les conventions de données pour garantir la cohérence dans toute l'application.

## 🎯 Objectif

Tous les fichiers qui manipulent des données communes doivent :
1. Utiliser les types définis dans `src/types/shared.ts`
2. Respecter les conventions de nommage et de valeurs
3. Toujours définir les champs obligatoires
4. Utiliser les valeurs par défaut correctes

## 📊 Tables Principales

### 1. FACTURES (`factures`)

#### Champs Obligatoires
- `id` (uuid)
- `numero` (string) - Format: `FACT-YYYY-XXXX` ou `PROFORMA-YYYY-XXXX`
- `client_id` (uuid) - Référence vers `clients.id`
- `entreprise_id` (uuid) - Référence vers `entreprises.id`
- `montant_ht` (number) - Montant hors taxes
- `montant_ttc` (number) - Montant toutes taxes comprises
- `statut` (string) - Valeurs possibles: `brouillon`, `envoyee`, `en_attente`, `payee`, `annulee`, `valide`

#### Champs Optionnels
- `type` (string) - `'facture'` ou `'proforma'` (défaut: `'facture'`)
- `date_facturation` (string) - Date ISO
- `date_emission` (string) - Date ISO (alias de `date_facturation`)
- `date_echeance` (string) - Date ISO
- `montant_tva` (number) - Montant de la TVA
- `tva` (number) - Alias de `montant_tva` (compatibilité)
- `taux_tva` (number) - Taux de TVA en pourcentage (défaut: 20)
- `notes` (string | null)
- `source` (string) - **⚠️ IMPORTANT** : `'plateforme'` ou `'client'` (défaut: `'plateforme'`)
- `created_at` (string) - Date ISO
- `updated_at` (string) - Date ISO

#### ⚠️ RÈGLE CRITIQUE : Champ `source`

Le champ `source` détermine qui a créé/édité la facture :

- **`'plateforme'`** : Facture créée/éditée par un utilisateur de la plateforme (super admin, propriétaire d'entreprise)
- **`'client'`** : Facture créée/éditée par un client depuis son espace client

**Règles d'attribution :**
1. Lors de la **création** :
   - Si `isClient === true` → `source = 'client'`
   - Sinon → `source = 'plateforme'`

2. Lors de la **modification** :
   - Si `isClient === true` → `source = 'client'` (même si la facture était initialement créée par la plateforme)
   - Sinon → Préserver la `source` existante, ou `'plateforme'` si absente

3. **Filtrage** :
   - **Clients** : Voient uniquement leurs factures (filtrées par `client_id`)
   - **Plateforme** : Voit uniquement les factures avec `source = 'plateforme'` (exclut `source = 'client'`)

#### Exemple d'Insertion

```typescript
const { data, error } = await supabase
  .from('factures')
  .insert({
    entreprise_id: entrepriseId,
    client_id: clientId,
    numero: 'FACT-2025-0001',
    type: 'facture',
    date_emission: new Date().toISOString().split('T')[0],
    montant_ht: 1000,
    tva: 200,
    montant_ttc: 1200,
    statut: 'envoyee',
    source: isClient ? 'client' : 'plateforme', // ✅ TOUJOURS définir source
  });
```

### 2. CLIENTS (`clients`)

#### Champs Obligatoires
- `id` (uuid)
- `entreprise_id` (uuid) - Référence vers `entreprises.id`
- `email` (string)

#### Champs Optionnels
- `nom` (string | null)
- `prenom` (string | null)
- `entreprise_nom` (string | null)
- `telephone` (string | null)
- `adresse` (string | null)
- `code_postal` (string | null)
- `ville` (string | null)
- `siret` (string | null)
- `created_at` (string)
- `updated_at` (string)

### 3. ENTREPRISES (`entreprises`)

#### Champs Obligatoires
- `id` (uuid)
- `user_id` (uuid) - Référence vers `auth.users.id` (propriétaire)
- `nom` (string)

#### Champs Optionnels
- `forme_juridique` (string | null)
- `siret` (string | null)
- `email` (string | null)
- `telephone` (string | null)
- `adresse` (string | null)
- `code_postal` (string | null)
- `ville` (string | null)
- `site_web` (string | null)
- `created_at` (string)
- `updated_at` (string)

### 4. NOTIFICATIONS (`notifications`)

#### Champs Obligatoires
- `id` (uuid)
- `user_id` (uuid) - Référence vers `auth.users.id`
- `title` (string)
- `message` (string)
- `type` (string) - Valeurs: `'info'`, `'success'`, `'warning'`, `'error'`, `'invoice'`, `'client'`, `'payment'`, `'subscription'`, `'system'`
- `read` (boolean) - Défaut: `false`

#### Champs Optionnels
- `link_url` (string | null)
- `link_text` (string | null)
- `read_at` (string | null)
- `metadata` (jsonb | null)
- `expires_at` (string | null)
- `created_at` (string)

## 🔍 Validation

### Script de Validation

Un script de validation est disponible pour vérifier la cohérence :

```bash
node scripts/validate-data-consistency.mjs
```

Ce script vérifie :
- ✅ Présence du champ `source` lors des insertions de factures
- ✅ Valeurs valides pour `source` (`'plateforme'` ou `'client'`)
- ✅ Valeurs par défaut correctes
- ✅ Filtres utilisant des valeurs valides

### Types TypeScript

Tous les types sont centralisés dans `src/types/shared.ts` :

```typescript
import { Facture, FactureLigne, Client, Entreprise, Notification } from '../types/shared';
```

## 📝 Checklist de Vérification

Avant de créer/modifier une facture, vérifier :

- [ ] Le champ `source` est défini (`'plateforme'` ou `'client'`)
- [ ] Le `client_id` correspond à un client valide
- [ ] L'`entreprise_id` correspond à une entreprise valide
- [ ] Le `numero` est unique et suit le format attendu
- [ ] Les montants (`montant_ht`, `montant_tva`, `montant_ttc`) sont cohérents
- [ ] Le `statut` utilise une valeur valide
- [ ] Le `type` est `'facture'` ou `'proforma'`

## 🚨 Erreurs Courantes à Éviter

1. **Oublier le champ `source`** lors de l'insertion
   ```typescript
   // ❌ MAUVAIS
   .insert({ entreprise_id, client_id, numero, ... })
   
   // ✅ BON
   .insert({ entreprise_id, client_id, numero, source: isClient ? 'client' : 'plateforme', ... })
   ```

2. **Utiliser une valeur invalide pour `source`**
   ```typescript
   // ❌ MAUVAIS
   source: 'admin' // ❌ Valeur invalide
   
   // ✅ BON
   source: 'plateforme' // ✅ Valeur valide
   ```

3. **Ne pas filtrer par `source` pour la plateforme**
   ```typescript
   // ❌ MAUVAIS (plateforme voit tout)
   .select('*')
   
   // ✅ BON (plateforme exclut les factures client)
   .select('*')
   .then(data => data.filter(f => f.source !== 'client'))
   ```

## 📚 Fichiers de Référence

- **Types partagés** : `src/types/shared.ts`
- **Validation** : `scripts/validate-data-consistency.mjs`
- **Page Factures** : `src/pages/Factures.tsx`
- **Composant Entreprise** : `src/components/EntrepriseAccordion.tsx`

## 🔄 Mise à Jour

Si vous modifiez les conventions, mettez à jour :
1. Ce document (`CONVENTIONS_DONNEES.md`)
2. Les types dans `src/types/shared.ts`
3. Le script de validation `scripts/validate-data-consistency.mjs`
4. Tous les fichiers qui utilisent ces données

