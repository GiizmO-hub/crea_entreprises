# 🔍 GUIDE DE DIAGNOSTIC - Workflow s'arrête à 60%

## 📋 PROBLÈME
Le workflow s'arrête à 60% après le paiement Stripe. Il faut identifier où exactement ça bloque.

## ✅ SOLUTION : Migration de diagnostic créée

### ÉTAPE 1 : Appliquer la migration SQL

1. Ouvrez : `https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new`
2. Ouvrez le fichier : `APPLY_THIS_SQL.sql`
3. Copiez tout (Cmd+A, Cmd+C)
4. Collez dans l'éditeur SQL
5. Cliquez sur "Run"

Cette migration ajoute :
- ✅ Table `workflow_logs` pour tracer chaque étape
- ✅ Fonction `diagnostic_workflow_paiement(paiement_id)` pour vérifier l'état
- ✅ Logs détaillés dans toutes les fonctions

### ÉTAPE 2 : Redéployer le webhook Stripe

Le webhook a été amélioré avec des logs détaillés. Il faut le redéployer :

```bash
cd /Users/user/Downloads/cursor
npx supabase functions deploy stripe-webhooks
```

Ou via le Dashboard Supabase :
1. Allez dans Edge Functions
2. Ouvrez `stripe-webhooks`
3. Redéployez

### ÉTAPE 3 : Tester un nouveau paiement

1. Créez une nouvelle entreprise
2. Effectuez un paiement Stripe
3. Attendez 10-20 secondes

### ÉTAPE 4 : Diagnostiquer le problème

#### Option A : Via SQL (RECOMMANDÉ)

```sql
-- Remplacer 'VOTRE_PAIEMENT_ID' par l'ID réel du paiement
SELECT * FROM diagnostic_workflow_paiement('VOTRE_PAIEMENT_ID');
```

Cette fonction vous dira :
- ✅ Si le paiement est marqué comme 'paye'
- ✅ Si la facture existe
- ✅ Si l'abonnement existe
- ✅ Si l'espace membre existe
- ✅ Si le workflow est complet (100%)

#### Option B : Voir tous les logs

```sql
-- Voir tous les logs d'un paiement
SELECT * FROM workflow_logs 
WHERE paiement_id = 'VOTRE_PAIEMENT_ID'
ORDER BY created_at ASC;
```

#### Option C : Vérifier les logs Supabase

1. Allez dans : `Supabase Dashboard → Edge Functions → stripe-webhooks → Logs`
2. Recherchez les logs avec `[WEBHOOK]`
3. Vérifiez si `valider_paiement_carte_immediat` est appelé
4. Vérifiez les erreurs éventuelles

#### Option D : Vérifier les logs PostgreSQL

1. Allez dans : `Supabase Dashboard → Logs → Postgres Logs`
2. Recherchez les logs avec `[valider_paiement_carte_immediat]` ou `[WORKFLOW_LOG]`
3. Vérifiez où le processus s'arrête

## 🔍 POINTS DE VÉRIFICATION

### 1. Le webhook est-il appelé ?
- ✅ Vérifiez les logs Edge Function `stripe-webhooks`
- ✅ Cherchez `[WEBHOOK] Checkout completed` ou `[WEBHOOK] Payment intent succeeded`

### 2. Le paiement_id est-il trouvé ?
- ✅ Vérifiez dans les logs : `[WEBHOOK] Paiement ID trouvé: ...`
- ❌ Si manquant : Le `client_reference_id` n'est pas passé correctement

### 3. valider_paiement_carte_immediat est-il appelé ?
- ✅ Vérifiez dans les logs : `[WEBHOOK] Appel de valider_paiement_carte_immediat...`
- ✅ Vérifiez dans les logs PostgreSQL : `[valider_paiement_carte_immediat] DÉBUT`

### 4. creer_facture_et_abonnement_apres_paiement est-elle exécutée ?
- ✅ Vérifiez dans les logs : `[creer_facture_et_abonnement_apres_paiement] DÉBUT`
- ❌ Si absente : La fonction n'est pas appelée ou échoue silencieusement

### 5. Les logs workflow_logs sont-ils créés ?
- ✅ Vérifiez avec : `SELECT * FROM workflow_logs WHERE paiement_id = '...'`
- ❌ Si vide : La fonction n'est pas exécutée

## 🛠️ CORRECTIONS POSSIBLES

### Problème 1 : Webhook non appelé
**Solution :** Vérifier la configuration du webhook dans Stripe Dashboard

### Problème 2 : paiement_id manquant
**Solution :** Vérifier que `create-stripe-checkout` passe bien `client_reference_id: paiement_id`

### Problème 3 : valider_paiement_carte_immediat échoue
**Solution :** Vérifier les logs d'erreur et corriger la fonction

### Problème 4 : creer_facture_et_abonnement_apres_paiement échoue
**Solution :** Vérifier les logs et corriger les erreurs SQL

## 📊 EXEMPLE DE RÉSULTAT ATTENDU

Après un paiement réussi, vous devriez voir :

```json
{
  "success": true,
  "paiement": {
    "statut": "paye",
    "montant_ttc": 100.00
  },
  "facture": {
    "existe": true,
    "numero": "FACT-2025-1234"
  },
  "abonnement": {
    "existe": true,
    "statut": "actif"
  },
  "espace_membre": {
    "existe": true,
    "role": "client_super_admin"
  },
  "workflow_complet": true
}
```

Si `workflow_complet` est `false`, regardez quels éléments manquent.

## 🚀 PROCHAINES ÉTAPES

1. ✅ Appliquer la migration SQL
2. ✅ Redéployer le webhook Stripe
3. ✅ Tester un nouveau paiement
4. ✅ Diagnostiquer avec `diagnostic_workflow_paiement`
5. ✅ Partager les résultats pour correction

