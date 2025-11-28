# 📋 GUIDE D'UTILISATION - DIAGNOSTIC WORKFLOW

## ✅ Migration créée

**Fichier:** `supabase/migrations/20250123000037_diagnostic_workflow_complet.sql`

## 🎯 Ce que fait cette migration

Cette migration crée **deux fonctions de diagnostic** pour vérifier que tout le workflow est en place :

### 1. `diagnostic_workflow_complet()`
Fonction complète qui retourne un JSON détaillé avec :
- ✅ Liste de toutes les fonctions RPC (existence, criticité)
- ✅ Liste de tous les triggers (existence, activation)
- ✅ Liste de toutes les tables (existence)
- ✅ Liste de tous les problèmes trouvés (critiques et avertissements)
- ✅ Résumé statistique complet

### 2. `test_diagnostic_rapide()`
Fonction simple qui retourne un message texte lisible avec le résumé du diagnostic.

## 📊 Comment utiliser

### Option 1 : Via Supabase Dashboard (recommandé)

1. Ouvrez le **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Exécutez cette requête :

```sql
SELECT test_diagnostic_rapide();
```

Vous obtiendrez un message texte clair indiquant :
- Le nombre de fonctions/triggers/tables présents
- Le nombre de problèmes critiques
- La liste des problèmes critiques s'il y en a

### Option 2 : Diagnostic complet (JSON détaillé)

Pour obtenir tous les détails en JSON :

```sql
SELECT diagnostic_workflow_complet();
```

Cela retournera un JSON complet avec tous les détails de chaque élément vérifié.

### Option 3 : Via le terminal (psql)

```bash
psql $DATABASE_URL -c "SELECT test_diagnostic_rapide();"
```

## 🔍 Ce qui est vérifié

### ✅ Fonctions RPC vérifiées :
1. `create_complete_entreprise_automated` (CRITIQUE)
2. `valider_paiement_carte_immediat` (CRITIQUE)
3. `choisir_paiement_virement` (CRITIQUE)
4. `creer_facture_et_abonnement_apres_paiement` (CRITIQUE)
5. `finaliser_creation_apres_paiement` (CRITIQUE)
6. `get_paiement_info_for_stripe` (important)
7. `valider_paiement_virement_manuel` (important)

### ✅ Triggers vérifiés :
1. `trigger_paiement_creer_facture_abonnement` (CRITIQUE)
   - Vérifie qu'il existe
   - Vérifie qu'il est activé
   - Vérifie qu'il est sur la bonne table (`paiements`)

### ✅ Tables vérifiées :
1. `entreprises` (CRITIQUE)
2. `paiements` (CRITIQUE)
3. `clients` (CRITIQUE)
4. `factures` (CRITIQUE)
5. `abonnements` (CRITIQUE)
6. `espaces_membres_clients` (CRITIQUE)
7. `plans_abonnement` (CRITIQUE)

### ✅ Colonnes critiques vérifiées (table paiements) :
1. `notes` - Doit être `text` ou `jsonb`
2. `entreprise_id` - Doit exister
3. `statut` - Doit exister

### ✅ Contraintes vérifiées :
- Vérifie que le statut `en_attente_validation` est autorisé pour les virements

## 📝 Exemple de résultat

### Résultat du diagnostic rapide :

```
📊 DIAGNOSTIC WORKFLOW COMPLET
═══════════════════════════════════════════════

✅ Fonctions: 7/7
✅ Triggers: 1/1
✅ Tables: 7/7

❌ Problèmes critiques: 0
⚠️  Avertissements: 0

✅ Tous les éléments critiques sont en place !
```

### Si des problèmes sont trouvés :

```
📊 DIAGNOSTIC WORKFLOW COMPLET
═══════════════════════════════════════════════

✅ Fonctions: 5/7
✅ Triggers: 1/1
✅ Tables: 7/7

❌ Problèmes critiques: 2
⚠️  Avertissements: 1

🚨 PROBLÈMES CRITIQUES:
─────────────────────────────────────
  • missing_function: valider_paiement_carte_immediat: Fonction essentielle pour valider un paiement par carte
  • missing_trigger: trigger_paiement_creer_facture_abonnement: Trigger essentiel pour créer automatiquement facture et abonnement après paiement

❌ Des éléments critiques manquent. Veuillez corriger avant de continuer.
```

## 🚀 Prochaines étapes

1. **Exécuter la migration** (si ce n'est pas déjà fait)
2. **Lancer le diagnostic** avec `SELECT test_diagnostic_rapide();`
3. **Identifier les problèmes** s'il y en a
4. **Corriger les problèmes** un par un
5. **Relancer le diagnostic** pour vérifier que tout est corrigé

## 💡 Astuce

Si vous voulez voir le résultat formaté dans Supabase Dashboard, utilisez :

```sql
SELECT jsonb_pretty(diagnostic_workflow_complet());
```

Cela affichera le JSON de manière lisible et formatée.


