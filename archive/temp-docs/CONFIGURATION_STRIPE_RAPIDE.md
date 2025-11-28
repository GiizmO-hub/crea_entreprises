# ⚡ CONFIGURATION RAPIDE STRIPE

Vous avez fourni vos clés Stripe. Voici comment les configurer rapidement.

---

## ✅ VOS CLÉS STRIPE

```
✅ Clé Publique (Publishable Key) :
pk_test_51SXOlcEMmOXNQayfzSKwh9crLpjvSPzbMlNXgyiMUpICZeKjDqqMKQQKSSDglVpwjdWBg0jjfvev4mhAhgI8V5am00q1p2pZJx

✅ Clé Secrète (Secret Key) :
sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk

✅ Webhook Secret :
whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef
```

---

## 🔧 ÉTAPE 1 : CONFIGURER LES SECRETS DANS SUPABASE

### 1.1 Accéder aux Secrets

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings** (⚙️) → **Edge Functions** → **Secrets**

### 1.2 Ajouter les secrets

Cliquez sur **"Add new secret"** et ajoutez :

#### Secret 1 : STRIPE_SECRET_KEY
```
Nom : STRIPE_SECRET_KEY
Valeur : sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk
```

#### Secret 2 : STRIPE_WEBHOOK_SECRET
```
Nom : STRIPE_WEBHOOK_SECRET
Valeur : whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef
```

### 1.3 Vérifier les secrets existants

Vérifiez que ces secrets existent déjà (ils devraient être configurés automatiquement) :
- `SUPABASE_URL` : URL de votre projet
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role

Si l'un de ces secrets manque, vous pouvez le trouver dans :
- **Settings** → **API** → **Project URL** (pour SUPABASE_URL)
- **Settings** → **API** → **service_role key** (pour SUPABASE_SERVICE_ROLE_KEY)

---

## 🌐 ÉTAPE 2 : CONFIGURER LE WEBHOOK DANS STRIPE DASHBOARD

### 2.1 Accéder aux Webhooks

1. Allez sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Allez dans **Developers** → **Webhooks**

### 2.2 Créer ou vérifier l'endpoint webhook

Si vous n'avez pas encore créé d'endpoint :

1. Cliquez sur **"Add endpoint"**
2. **Endpoint URL** :
   ```
   https://[VOTRE-PROJET].supabase.co/functions/v1/stripe-webhooks
   ```
   ⚠️ Remplacez `[VOTRE-PROJET]` par l'ID de votre projet Supabase
   
   Exemple : `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhooks`

3. **Description** : `Supabase Edge Function - Webhooks`

### 2.3 Sélectionner les événements

Dans la section **"Select events to listen to"**, sélectionnez :

#### ✅ Événements REQUIS :
- [x] `checkout.session.completed`
- [x] `payment_intent.succeeded`

#### ✅ Événements RECOMMANDÉS :
- [x] `customer.subscription.created`
- [x] `customer.subscription.updated`
- [x] `customer.subscription.deleted`
- [x] `invoice.paid`
- [x] `invoice.payment_failed`

### 2.4 Vérifier le Webhook Secret

1. Après avoir créé l'endpoint, cliquez dessus
2. Dans la section **"Signing secret"**, vérifiez que c'est bien :
   ```
   whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef
   ```
3. Si différent, utilisez celui qui s'affiche dans Stripe Dashboard

---

## 📝 ÉTAPE 3 : CONFIGURER LA CLÉ PUBLIQUE (Frontend)

### 3.1 Option A : Variable d'environnement (recommandé)

Si vous avez un fichier `.env` à la racine du projet :

```bash
# .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SXOlcEMmOXNQayfzSKwh9crLpjvSPzbMlNXgyiMUpICZeKjDqqMKQQKSSDglVpwjdWBg0jjfvev4mhAhgI8V5am00q1p2pZJx
```

**Note** : La clé publique Stripe est actuellement gérée par l'Edge Function `create-stripe-checkout`, donc vous n'avez pas forcément besoin de la configurer dans le frontend si tout passe par l'Edge Function.

### 3.2 Option B : Vérifier que le frontend utilise l'Edge Function

Le frontend devrait appeler directement l'Edge Function `create-stripe-checkout` qui gère tout en backend.

---

## ✅ ÉTAPE 4 : VÉRIFICATION

### 4.1 Vérifier les secrets dans Supabase

1. Allez dans **Settings** → **Edge Functions** → **Secrets**
2. Vérifiez que vous avez bien :
   - ✅ `STRIPE_SECRET_KEY`
   - ✅ `STRIPE_WEBHOOK_SECRET`
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY`

### 4.2 Vérifier les Edge Functions déployées

1. Allez dans **Edge Functions** dans le menu Supabase
2. Vérifiez que vous avez :
   - ✅ `create-stripe-checkout`
   - ✅ `stripe-webhooks`

### 4.3 Tester le webhook

1. Dans Stripe Dashboard → **Webhooks** → Votre endpoint
2. Cliquez sur **"Send test webhook"**
3. Sélectionnez `checkout.session.completed`
4. Vérifiez les logs dans Supabase → **Edge Functions** → `stripe-webhooks` → **Logs**

Vous devriez voir :
```
✅ Stripe webhook received: checkout.session.completed
✅ Payment validated successfully
```

---

## 🧪 ÉTAPE 5 : TESTER UN PAIEMENT

### 5.1 Créer un paiement de test

1. Dans votre application, créez une entreprise
2. Choisissez **"Paiement par carte bancaire"**
3. Vous serez redirigé vers Stripe Checkout

### 5.2 Utiliser une carte de test

Dans Stripe Checkout, utilisez :
- **Numéro de carte** : `4242 4242 4242 4242`
- **Date d'expiration** : `12/25` (ou toute date future)
- **CVC** : `123` (ou n'importe quel code à 3 chiffres)
- **Code postal** : `12345` (ou n'importe quel code)

### 5.3 Vérifier le résultat

Après le paiement, vérifiez que :
- ✅ Le paiement est validé automatiquement
- ✅ La facture est créée
- ✅ L'abonnement est créé
- ✅ L'espace client est créé
- ✅ Les droits admin sont créés

---

## 🔍 DÉPANNAGE RAPIDE

### ❌ Erreur : "Configuration Stripe manquante"

**Solution** :
- Vérifiez que `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont bien dans Supabase Dashboard → Edge Functions → Secrets

### ❌ Erreur : "Signature Stripe invalide"

**Solution** :
- Vérifiez que le `STRIPE_WEBHOOK_SECRET` dans Supabase correspond au "Signing secret" dans Stripe Dashboard → Webhooks → Votre endpoint

### ❌ Webhook non reçu

**Solution** :
- Vérifiez que l'URL du webhook est correcte dans Stripe Dashboard
- L'URL doit être : `https://[VOTRE-PROJET].supabase.co/functions/v1/stripe-webhooks`
- Vérifiez que l'endpoint est bien actif (statut "Enabled")

### ❌ Paiement validé mais rien ne se passe

**Solution** :
- Vérifiez les logs dans Supabase Dashboard → Logs → Postgres Logs
- Recherchez les logs avec `[valider_paiement_carte_immediat]` ou `[creer_facture_et_abonnement_apres_paiement]`

---

## ✅ CHECKLIST FINALE

Avant de tester, vérifiez :

- [ ] `STRIPE_SECRET_KEY` ajouté dans Supabase Dashboard → Edge Functions → Secrets
- [ ] `STRIPE_WEBHOOK_SECRET` ajouté dans Supabase Dashboard → Edge Functions → Secrets
- [ ] Webhook créé dans Stripe Dashboard avec la bonne URL
- [ ] Événements `checkout.session.completed` et `payment_intent.succeeded` sélectionnés
- [ ] Edge Functions `create-stripe-checkout` et `stripe-webhooks` déployées
- [ ] Webhook testé avec succès dans Stripe Dashboard
- [ ] Prêt à tester avec un paiement de test

---

## 🎯 RÉSUMÉ ULTRA-RAPIDE

1. **Supabase Dashboard** → Settings → Edge Functions → Secrets
   - Ajouter `STRIPE_SECRET_KEY` = `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
   - Ajouter `STRIPE_WEBHOOK_SECRET` = `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`

2. **Stripe Dashboard** → Webhooks → Créer endpoint
   - URL : `https://[VOTRE-PROJET].supabase.co/functions/v1/stripe-webhooks`
   - Événements : `checkout.session.completed`, `payment_intent.succeeded`

3. **Tester** avec un paiement de test

**C'est tout ! 🚀**


