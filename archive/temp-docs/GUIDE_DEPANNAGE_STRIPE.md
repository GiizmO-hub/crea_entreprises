# 🔍 GUIDE DE DÉPANNAGE STRIPE

Guide pour résoudre l'erreur "Erreur lors de la création de la session de paiement".

---

## ❌ ERREUR COMMUNE : "Erreur lors de la création de la session de paiement"

Cette erreur peut avoir plusieurs causes. Suivez ce guide pour la diagnostiquer et la résoudre.

---

## 🔍 DIAGNOSTIC ÉTAPE PAR ÉTAPE

### Étape 1 : Vérifier les logs détaillés

#### 1.1 Dans le navigateur

1. Ouvrez la **console du navigateur** (F12 ou Cmd+Option+I)
2. Allez dans l'onglet **Console**
3. Cliquez sur "Payer par carte bancaire"
4. Regardez les erreurs affichées

Vous devriez voir quelque chose comme :
```javascript
Erreur création session Stripe: {error: "...", details: "..."}
```

#### 1.2 Dans Supabase Dashboard

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Edge Functions** → `create-stripe-checkout`
4. Cliquez sur l'onglet **Logs**
5. Regardez les erreurs récentes

---

## 🐛 CAUSES POSSIBLES ET SOLUTIONS

### Cause 1 : STRIPE_SECRET_KEY non configuré

**Symptôme** :
- Erreur : `STRIPE_SECRET_KEY non configuré`
- Dans les logs : `STRIPE_SECRET_KEY non configuré dans les secrets Edge Functions`

**Solution** :
1. Allez dans **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Vérifiez que `STRIPE_SECRET_KEY` existe
3. Si absent, ajoutez-le :
   - Nom : `STRIPE_SECRET_KEY`
   - Valeur : `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
4. **Important** : Redéployez l'Edge Function après avoir ajouté le secret

---

### Cause 2 : Fonction RPC `get_paiement_info_for_stripe` non trouvée

**Symptôme** :
- Erreur : `Erreur lors de la récupération des informations de paiement`
- Code d'erreur : `42883` (function does not exist)

**Solution** :
1. Vérifiez que la fonction existe dans votre base de données
2. Si elle n'existe pas, appliquez la migration qui la crée :
   ```sql
   -- Migration: 20250123000017_payment_immediate_choice_workflow.sql
   ```
3. Ou créez-la manuellement (voir code dans les migrations)

---

### Cause 3 : Paiement non trouvé

**Symptôme** :
- Erreur : `Paiement non trouvé`
- `get_paiement_info_for_stripe` retourne `success: false`

**Solution** :
1. Vérifiez que le `paiement_id` passé est correct
2. Vérifiez dans **Supabase Dashboard** → **Table Editor** → `paiements` que le paiement existe
3. Vérifiez que l'utilisateur a les droits pour voir ce paiement (RLS)

---

### Cause 4 : Edge Function non redéployée après modification

**Symptôme** :
- Les modifications de code ne sont pas prises en compte
- L'erreur persiste même après correction

**Solution** :
1. Redéployez l'Edge Function :
   ```bash
   supabase functions deploy create-stripe-checkout
   ```
2. Ou via **Supabase Dashboard** :
   - **Edge Functions** → `create-stripe-checkout` → **Deploy** ou **Redeploy**

---

### Cause 5 : Problème avec la clé Stripe

**Symptôme** :
- Erreur Stripe API : `Invalid API Key` ou similaire
- L'Edge Function ne peut pas se connecter à Stripe

**Solution** :
1. Vérifiez que la clé `STRIPE_SECRET_KEY` est correcte
2. Vérifiez qu'elle commence par `sk_test_...` (mode test) ou `sk_live_...` (mode production)
3. Vérifiez que la clé n'a pas expiré ou été révoquée dans Stripe Dashboard
4. Régénérez la clé si nécessaire dans **Stripe Dashboard** → **Developers** → **API keys**

---

## ✅ VÉRIFICATION RAPIDE

### Checklist de vérification

- [ ] `STRIPE_SECRET_KEY` configuré dans Supabase Dashboard → Edge Functions → Secrets
- [ ] `STRIPE_WEBHOOK_SECRET` configuré (même si pas utilisé pour la création de session)
- [ ] `SUPABASE_URL` configuré (devrait être automatique)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configuré (devrait être automatique)
- [ ] Edge Function `create-stripe-checkout` est déployée
- [ ] Fonction RPC `get_paiement_info_for_stripe` existe dans la base de données
- [ ] Le paiement existe dans la table `paiements`
- [ ] L'utilisateur est bien authentifié
- [ ] La clé Stripe est valide et active

---

## 🧪 TEST APRÈS CORRECTION

1. **Ouvrez la console du navigateur** (F12)
2. **Rafraîchissez la page** (Cmd+R ou F5)
3. **Créez une nouvelle entreprise** (si nécessaire)
4. **Cliquez sur "Payer par carte bancaire"**
5. **Vérifiez les logs** dans la console :
   - Si l'erreur persiste, les détails seront maintenant affichés
   - Notez le message d'erreur exact
6. **Vérifiez les logs dans Supabase Dashboard** → Edge Functions → `create-stripe-checkout` → Logs

---

## 📞 SI L'ERREUR PERSISTE

Si après toutes ces vérifications l'erreur persiste :

1. **Copiez le message d'erreur exact** depuis la console du navigateur
2. **Copiez les logs** de l'Edge Function dans Supabase Dashboard
3. **Vérifiez** :
   - Le `paiement_id` utilisé
   - Si le paiement existe dans la base de données
   - Si les secrets sont bien configurés

Les messages d'erreur sont maintenant plus détaillés et devraient indiquer exactement où se situe le problème.

---

## 🔧 COMMANDES UTILES

### Redéployer l'Edge Function

```bash
cd /Users/user/Downloads/cursor
supabase functions deploy create-stripe-checkout
```

### Vérifier les secrets configurés

Dans Supabase Dashboard → Settings → Edge Functions → Secrets

### Tester la fonction RPC

```sql
SELECT get_paiement_info_for_stripe('VOTRE_PAIEMENT_ID');
```

---

## 📝 NOTES IMPORTANTES

- ⚠️ **Important** : Après avoir ajouté/modifié un secret dans Supabase, vous devez **redéployer l'Edge Function** pour qu'elle prenne en compte le nouveau secret
- ⚠️ Les Edge Functions utilisent des variables d'environnement spécifiques, différentes de celles du frontend
- ⚠️ Vérifiez toujours les logs dans Supabase Dashboard pour avoir les détails complets des erreurs

---

## ✅ RÉSOLUTION RAPIDE

**Si vous venez de configurer Stripe pour la première fois :**

1. Vérifiez que les secrets sont ajoutés dans Supabase Dashboard
2. **Redéployez l'Edge Function** `create-stripe-checkout`
3. Rafraîchissez votre navigateur
4. Réessayez

Cela devrait résoudre la plupart des problèmes ! 🚀


