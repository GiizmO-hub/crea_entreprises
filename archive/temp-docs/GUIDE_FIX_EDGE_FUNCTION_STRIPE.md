# 🔧 GUIDE : CORRIGER L'ERREUR EDGE FUNCTION STRIPE

**Erreur:** "Failed to send a request to the Edge Function"

---

## 📋 ÉTAPE 1 : DIAGNOSTIC (CRÉER)

### Problèmes possibles :
1. ❌ L'Edge Function `create-stripe-checkout` n'est pas déployée
2. ❌ Les secrets ne sont pas configurés
3. ❌ L'Edge Function n'est pas accessible depuis le frontend

---

## 🧪 ÉTAPE 2 : TESTER

### Test 1 : Vérifier que l'Edge Function existe localement

```bash
cd /Users/user/Downloads/cursor
ls -la supabase/functions/create-stripe-checkout/
```

**Résultat attendu :** Vous devriez voir `index.ts`

### Test 2 : Vérifier dans Supabase Dashboard

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Edge Functions**
4. Vérifiez si `create-stripe-checkout` apparaît dans la liste

**Si elle n'apparaît pas :** L'Edge Function n'est pas déployée ❌

---

## 🔧 ÉTAPE 3 : CORRIGER

### Solution 1 : Déployer l'Edge Function

#### Option A : Via Supabase CLI (Recommandé)

```bash
cd /Users/user/Downloads/cursor

# 1. Vérifier que Supabase CLI est installé
supabase --version

# 2. Se connecter à Supabase
supabase link --project-ref VOTRE_PROJECT_REF

# 3. Déployer l'Edge Function
supabase functions deploy create-stripe-checkout
```

#### Option B : Via Supabase Dashboard

1. Allez dans **Edge Functions**
2. Cliquez sur **Create new function**
3. Nom : `create-stripe-checkout`
4. Copiez le contenu de `supabase/functions/create-stripe-checkout/index.ts`
5. Collez dans l'éditeur
6. Cliquez sur **Deploy**

### Solution 2 : Vérifier les secrets

L'Edge Function a besoin de ces secrets :

1. **STRIPE_SECRET_KEY** = `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
2. **STRIPE_WEBHOOK_SECRET** = `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`

#### Configurer les secrets :

1. Allez dans **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**
2. Ajoutez :
   - **Nom :** `STRIPE_SECRET_KEY`
   - **Valeur :** `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
3. Cliquez sur **Add secret**
4. Répétez pour `STRIPE_WEBHOOK_SECRET`

⚠️ **IMPORTANT :** Après avoir ajouté/modifié les secrets, vous devez **REDÉPLOYER** l'Edge Function !

---

## ✅ ÉTAPE 4 : RE-TESTER

### Test dans le navigateur :

1. **Rafraîchissez votre navigateur** (Cmd+R)
2. **Créez une entreprise** (si nécessaire)
3. **Cliquez sur "Payer par carte bancaire"**
4. **Vérifiez la console** (F12) pour voir les erreurs détaillées

### Test via script :

```bash
node scripts/test-edge-function-stripe.mjs
```

---

## 🚀 ÉTAPE 5 : BUILD - VÉRIFICATIONS FINALES

### Checklist :

- [ ] Edge Function `create-stripe-checkout` déployée
- [ ] Secret `STRIPE_SECRET_KEY` configuré
- [ ] Secret `STRIPE_WEBHOOK_SECRET` configuré
- [ ] Edge Function redéployée après configuration des secrets
- [ ] Test dans le navigateur fonctionne
- [ ] Pas d'erreurs dans la console

---

## 🔍 DIAGNOSTIC DÉTAILLÉ

### Si l'erreur persiste, vérifiez :

1. **Console du navigateur (F12)** :
   - Regardez les erreurs réseau
   - Vérifiez les requêtes vers `/functions/v1/create-stripe-checkout`

2. **Logs Supabase** :
   - Dashboard → Edge Functions → `create-stripe-checkout` → **Logs**
   - Vérifiez les erreurs récentes

3. **Authentification** :
   - L'Edge Function nécessite un utilisateur authentifié
   - Vérifiez que vous êtes bien connecté

---

## 📝 COMMANDES RAPIDES

```bash
# Vérifier les Edge Functions déployées
supabase functions list

# Déployer create-stripe-checkout
supabase functions deploy create-stripe-checkout

# Voir les logs en temps réel
supabase functions logs create-stripe-checkout

# Tester localement (si Supabase CLI configuré)
supabase functions serve create-stripe-checkout
```

---

## ⚠️ NOTES IMPORTANTES

1. **Les secrets sont différents des variables d'environnement frontend**
   - Les secrets sont configurés dans **Supabase Dashboard → Edge Functions → Secrets**
   - Ils ne sont PAS dans le fichier `.env` du projet

2. **Redéployer après modification des secrets**
   - Les modifications de secrets nécessitent un redéploiement
   - Utilisez : `supabase functions deploy create-stripe-checkout`

3. **Mode développement vs production**
   - Les Edge Functions sont déployées sur Supabase
   - Elles ne sont PAS dans votre environnement local
   - Elles sont accessibles via : `https://VOTRE_PROJECT.supabase.co/functions/v1/create-stripe-checkout`


