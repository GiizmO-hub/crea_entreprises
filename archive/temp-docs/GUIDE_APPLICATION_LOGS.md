# 📋 Guide d'Application de la Migration de Logs

## 🎯 Objectif

Cette migration ajoute des logs détaillés (`RAISE NOTICE` et `RAISE WARNING`) dans toutes les fonctions RPC critiques du workflow de création d'entreprise et de paiement. Cela permettra de diagnostiquer exactement où le workflow bloque.

## 📄 Migration

**Fichier:** `supabase/migrations/20250123000039_add_detailed_logs_workflow.sql`

**Taille:** ~825 lignes

**Fonctions modifiées:**
1. ✅ `create_complete_entreprise_automated` - Logs à chaque étape de création
2. ✅ `valider_paiement_carte_immediat` - Logs de validation
3. ✅ `trigger_creer_facture_abonnement_apres_paiement` - Logs du trigger
4. ✅ `creer_facture_et_abonnement_apres_paiement` - Logs de création facture/abonnement
5. ✅ `finaliser_creation_apres_paiement` - Logs de finalisation

---

## 🚀 Méthode 1: Via Dashboard Supabase (Recommandé)

### Étapes:

1. **Ouvrir Supabase Dashboard**
   - Allez sur: https://app.supabase.com
   - Sélectionnez votre projet

2. **Ouvrir SQL Editor**
   - Dans le menu de gauche, cliquez sur **"SQL Editor"**

3. **Créer une nouvelle requête**
   - Cliquez sur **"New query"**

4. **Copier le contenu de la migration**
   - Ouvrez le fichier: `supabase/migrations/20250123000039_add_detailed_logs_workflow.sql`
   - Sélectionnez tout le contenu (Ctrl+A / Cmd+A)
   - Copiez (Ctrl+C / Cmd+C)

5. **Coller dans SQL Editor**
   - Collez le contenu dans l'éditeur SQL (Ctrl+V / Cmd+V)

6. **Exécuter la migration**
   - Cliquez sur le bouton **"Run"** (ou appuyez sur Ctrl+Enter)
   - Attendez la fin de l'exécution

7. **Vérifier le résultat**
   - Vous devriez voir un message de succès
   - Si des erreurs apparaissent, notez-les

---

## 🚀 Méthode 2: Via Script Node.js (Alternative)

Si vous avez configuré les variables d'environnement:

```bash
# Depuis la racine du projet
node scripts/apply-logs-migration.mjs
```

**Variables nécessaires dans `.env.local` ou `.env`:**
```
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

**Note:** Cette méthode peut ne pas fonctionner si la fonction RPC `exec_sql` n'existe pas dans votre projet. Dans ce cas, utilisez la Méthode 1.

---

## ✅ Vérification Après Application

### 1. Vérifier que les fonctions sont mises à jour

Exécutez cette requête dans SQL Editor:

```sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) LIKE '%RAISE NOTICE%' as has_logs
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_complete_entreprise_automated',
    'valider_paiement_carte_immediat',
    'trigger_creer_facture_abonnement_apres_paiement',
    'creer_facture_et_abonnement_apres_paiement',
    'finaliser_creation_apres_paiement'
  );
```

**Résultat attendu:** Toutes les fonctions doivent avoir `has_logs = true`

### 2. Tester la création d'une entreprise

1. Allez dans votre application
2. Créez une nouvelle entreprise avec un plan
3. Vérifiez les logs dans **Supabase Dashboard → Logs → Postgres Logs**

---

## 📊 Comment Lire les Logs

### Où voir les logs:

1. **Supabase Dashboard → Logs → Postgres Logs**
   - Filtrer par niveau: `NOTICE` ou `WARNING`
   - Rechercher: `[create_complete_entreprise_automated]` ou `[valider_paiement_carte_immediat]`

2. **Format des logs:**

```
🚀 [create_complete_entreprise_automated] DÉBUT - Nom entreprise: Ma Société
🔍 [create_complete_entreprise_automated] User ID: abc-123-def
💰 [create_complete_entreprise_automated] Plan trouvé - Montant mensuel: 49.00
✅ [create_complete_entreprise_automated] Entreprise créée - ID: xyz-789
...
```

### Types de logs:

- 🚀 **DÉBUT** - Début d'une fonction
- ✅ **Succès** - Étape réussie
- ❌ **Erreur** - Problème détecté
- ⚠️ **Avertissement** - Situation inhabituelle mais non bloquante
- 🔍 **Recherche** - Requête en cours
- 📝 **Création** - Insertion en base
- 🔄 **Trigger** - Déclenchement d'un trigger

---

## 🎯 Utilisation pour Diagnostic

Après avoir appliqué la migration, créez une entreprise de test et suivez les logs:

1. **Logs de création d'entreprise:**
   - Vérifier que l'entreprise est créée
   - Vérifier que le paiement est créé (si plan sélectionné)
   - Vérifier que le client est créé

2. **Logs de paiement:**
   - Vérifier que le paiement est validé
   - Vérifier que le trigger se déclenche
   - Vérifier que la facture est créée
   - Vérifier que l'abonnement est créé

3. **Logs de finalisation:**
   - Vérifier que l'espace client est créé
   - Vérifier que l'utilisateur auth est créé

---

## 🔧 En Cas d'Erreur

Si vous rencontrez des erreurs lors de l'application:

1. **Erreur de syntaxe SQL:**
   - Vérifiez que vous avez copié tout le contenu du fichier
   - Vérifiez qu'il n'y a pas de caractères étranges

2. **Erreur de permission:**
   - Vérifiez que vous utilisez un compte avec les droits d'administration
   - Ou utilisez le SERVICE_ROLE_KEY via l'API

3. **Erreur "function already exists":**
   - C'est normal, les fonctions sont recréées avec `CREATE OR REPLACE`
   - Ignorez cette erreur si elle apparaît

4. **Erreur "relation does not exist":**
   - Vérifiez que toutes les migrations précédentes ont été appliquées
   - Vérifiez que les tables existent

---

## 📞 Support

Si vous rencontrez des problèmes:
1. Notez le message d'erreur exact
2. Notez à quelle étape l'erreur se produit
3. Vérifiez les logs Postgres pour plus de détails

---

✅ **Une fois la migration appliquée, tous les logs seront actifs et vous pourrez diagnostiquer précisément où le workflow bloque !**


