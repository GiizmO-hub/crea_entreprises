# 🚀 GUIDE COMPLET : ACTIVATION DE STRIPE

Ce guide vous explique étape par étape comment activer Stripe dans votre application.

---

## 📋 PRÉREQUIS

1. ✅ **Compte Stripe** (Test ou Production)
   - Créer un compte sur [stripe.com](https://stripe.com)
   - Récupérer vos clés API dans le Dashboard Stripe

2. ✅ **Projet Supabase** configuré
   - Les Edge Functions Stripe sont déjà déployées dans le projet
   - Vous avez accès au Dashboard Supabase

---

## 🔑 ÉTAPE 1 : RÉCUPÉRER LES CLÉS STRIPE

### 1.1 Dans Stripe Dashboard

1. Connectez-vous à [dashboard.stripe.com](https://dashboard.stripe.com)
2. Allez dans **Developers** → **API keys**
3. **Mode Test** (pour développement) :
   - **Publishable key** : `pk_test_...`
   - **Secret key** : `sk_test_...`
4. **Mode Production** (pour mise en production) :
   - Basculer sur "Live mode"
   - **Publishable key** : `pk_live_...`
   - **Secret key** : `sk_live_...`

### 1.2 Clés nécessaires

Vous aurez besoin de **2 clés** :
- `STRIPE_SECRET_KEY` : La clé secrète (sk_test_... ou sk_live_...)
- `STRIPE_WEBHOOK_SECRET` : À créer dans l'étape suivante (whsec_...)

---

## 🌐 ÉTAPE 2 : CONFIGURER LE WEBHOOK STRIPE

### 2.1 Créer l'endpoint webhook

1. Dans Stripe Dashboard : **Developers** → **Webhooks**
2. Cliquez sur **"Add endpoint"**
3. **Endpoint URL** :
   ```
   https://[VOTRE-PROJET].supabase.co/functions/v1/stripe-webhooks
   ```
   Exemple : `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhooks`

4. **Description** : `Supabase Edge Function - Webhooks`

### 2.2 Sélectionner les événements

Dans la section **"Select events to listen to"**, sélectionnez :

#### ✅ Événements REQUIS (minimum) :
- `checkout.session.completed` ⭐ **CRITIQUE**
- `payment_intent.succeeded` ⭐ **CRITIQUE**

#### ✅ Événements RECOMMANDÉS (optionnels mais utiles) :
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### 2.3 Récupérer le Webhook Secret

1. Après avoir créé l'endpoint, cliquez dessus
2. Dans la section **"Signing secret"**, cliquez sur **"Reveal"**
3. Copiez la clé qui commence par `whsec_...`
4. **⚠️ IMPORTANT** : C'est votre `STRIPE_WEBHOOK_SECRET`

---

## ⚙️ ÉTAPE 3 : CONFIGURER LES VARIABLES D'ENVIRONNEMENT

### 3.1 Dans Supabase Dashboard

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **Edge Functions** → **Secrets**

### 3.2 Ajouter les secrets

Ajoutez les 4 secrets suivants :

```bash
# 1. Clé secrète Stripe (TEST ou PRODUCTION)
STRIPE_SECRET_KEY=sk_test_...  # ou sk_live_... en production

# 2. Secret du webhook Stripe
STRIPE_WEBHOOK_SECRET=whsec_...

# 3. URL de votre projet Supabase (déjà configurée normalement)
SUPABASE_URL=https://[VOTRE-PROJET].supabase.co

# 4. Service Role Key (déjà configurée normalement)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Dans Settings → API → service_role key
```

### 3.3 Vérification

Vérifiez que tous les secrets sont bien configurés :
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_WEBHOOK_SECRET`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 ÉTAPE 4 : DÉPLOYER LES EDGE FUNCTIONS (si pas déjà fait)

Les Edge Functions Stripe sont déjà dans le projet :
- ✅ `supabase/functions/create-stripe-checkout/`
- ✅ `supabase/functions/stripe-webhooks/`

### 4.1 Vérifier le déploiement

Vérifiez dans Supabase Dashboard → **Edge Functions** que :
- ✅ `create-stripe-checkout` est déployée
- ✅ `stripe-webhooks` est déployée

### 4.2 Si besoin de redéployer

```bash
# Dans le terminal, depuis la racine du projet
cd /Users/user/Downloads/cursor

# Déployer les Edge Functions
supabase functions deploy create-stripe-checkout
supabase functions deploy stripe-webhooks
```

**Note** : Assurez-vous d'avoir la CLI Supabase installée et connectée.

---

## ✅ ÉTAPE 5 : VÉRIFIER LA CONFIGURATION

### 5.1 Test du webhook

1. Dans Stripe Dashboard → **Webhooks**
2. Cliquez sur votre endpoint webhook
3. Cliquez sur **"Send test webhook"**
4. Sélectionnez `checkout.session.completed`
5. Vérifiez les logs dans Supabase Dashboard → **Edge Functions** → **Logs**

### 5.2 Vérifier les logs

Dans Supabase Dashboard → **Edge Functions** → `stripe-webhooks` → **Logs**, vous devriez voir :
```
✅ Stripe webhook received: checkout.session.completed
✅ Payment validated successfully
```

Si vous voyez des erreurs, vérifiez :
- Les secrets sont bien configurés
- L'URL du webhook est correcte
- Les événements sont bien sélectionnés

---

## 🧪 ÉTAPE 6 : TESTER UN PAIEMENT

### 6.1 Créer un paiement de test

1. Dans votre application, créez une entreprise
2. Choisissez **"Paiement par carte bancaire"**
3. Le système appellera automatiquement `create-stripe-checkout`

### 6.2 Utiliser les cartes de test Stripe

Dans Stripe Checkout, utilisez :
- **Carte valide** : `4242 4242 4242 4242`
- **Date d'expiration** : N'importe quelle date future (ex: 12/25)
- **CVC** : N'importe quel code à 3 chiffres (ex: 123)
- **Code postal** : N'importe quel code (ex: 12345)

### 6.3 Vérifier le résultat

Après le paiement, vérifiez que :
1. ✅ Le paiement est validé automatiquement
2. ✅ La facture est créée
3. ✅ L'abonnement est créé
4. ✅ L'espace client est créé
5. ✅ Les droits admin sont créés

---

## 🔍 DÉPANNAGE

### Problème : "Configuration Stripe manquante"

**Solution** :
- Vérifiez que `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont bien configurés dans Supabase Dashboard → Edge Functions → Secrets

### Problème : "Signature Stripe invalide"

**Solution** :
- Vérifiez que `STRIPE_WEBHOOK_SECRET` correspond bien au secret de votre endpoint webhook dans Stripe Dashboard
- Le secret doit commencer par `whsec_...`

### Problème : Webhook non reçu

**Solution** :
- Vérifiez que l'URL du webhook est correcte : `https://[PROJET].supabase.co/functions/v1/stripe-webhooks`
- Vérifiez que l'endpoint webhook est bien actif dans Stripe Dashboard
- Vérifiez les logs dans Supabase Dashboard → Edge Functions → Logs

### Problème : Paiement validé mais facture non créée

**Solution** :
- Vérifiez les logs dans Supabase Dashboard → Logs → Postgres Logs
- Recherchez les logs avec `[valider_paiement_carte_immediat]` ou `[creer_facture_et_abonnement_apres_paiement]`

---

## 📚 RESSOURCES

- **Documentation Stripe** : https://stripe.com/docs
- **Documentation Supabase Edge Functions** : https://supabase.com/docs/guides/functions
- **Stripe Testing** : https://stripe.com/docs/testing

---

## ✅ CHECKLIST DE VÉRIFICATION

Avant de passer en production, vérifiez :

- [ ] Compte Stripe créé et vérifié
- [ ] Clés API Stripe récupérées (Test et Production)
- [ ] Webhook Stripe créé avec la bonne URL
- [ ] Tous les événements nécessaires sélectionnés
- [ ] Webhook Secret (`whsec_...`) récupéré
- [ ] Tous les secrets configurés dans Supabase Dashboard
- [ ] Edge Functions déployées
- [ ] Webhook testé avec succès
- [ ] Paiement de test effectué avec succès
- [ ] Vérification que facture + abonnement + espace client sont créés automatiquement

---

## 🎯 RÉSUMÉ RAPIDE

1. **Récupérer les clés** dans Stripe Dashboard (API keys)
2. **Créer le webhook** dans Stripe Dashboard → Webhooks
3. **Configurer les secrets** dans Supabase Dashboard → Edge Functions → Secrets
4. **Tester** avec un paiement de test
5. **Vérifier** que tout fonctionne automatiquement

**C'est tout ! 🎉**

---

## 📞 SUPPORT

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans Supabase Dashboard
2. Vérifiez les logs dans Stripe Dashboard → Webhooks → Votre endpoint
3. Vérifiez que toutes les étapes de ce guide sont bien suivies


