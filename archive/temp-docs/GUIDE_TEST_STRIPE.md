# 🧪 GUIDE DE TEST STRIPE

Guide complet pour tester que Stripe fonctionne correctement dans votre application.

---

## ✅ VÉRIFICATIONS PRÉALABLES

### 1. Secrets configurés dans Supabase

Vérifiez dans **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets** :

- ✅ `STRIPE_SECRET_KEY` = `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
- ✅ `STRIPE_WEBHOOK_SECRET` = `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`
- ✅ `SUPABASE_URL` (devrait déjà être présent)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (devrait déjà être présent)

### 2. Webhook configuré dans Stripe

Vérifiez dans **Stripe Dashboard** → **Developers** → **Webhooks** :

- ✅ Endpoint URL : `https://[VOTRE-PROJET-ID].supabase.co/functions/v1/stripe-webhooks`
- ✅ Statut : **Enabled**
- ✅ Événements sélectionnés :
  - `checkout.session.completed`
  - `payment_intent.succeeded`

### 3. Edge Functions déployées

Vérifiez dans **Supabase Dashboard** → **Edge Functions** :

- ✅ `create-stripe-checkout` est déployée
- ✅ `stripe-webhooks` est déployée

---

## 🧪 TEST COMPLET DU WORKFLOW

### Étape 1 : Créer une entreprise

1. Dans votre application, allez sur la page de création d'entreprise
2. Remplissez le formulaire avec des données de test :
   - Nom de l'entreprise : `Test Stripe SA`
   - Forme juridique : `SARL`
   - Email : `test@example.com`
   - Etc.

3. Cliquez sur **"Créer l'entreprise"**

### Étape 2 : Choisir le paiement par carte

1. Le modal de choix de paiement s'affiche
2. Cliquez sur **"Payer par carte bancaire"**
3. Vous devez être redirigé vers Stripe Checkout

### Étape 3 : Effectuer le paiement de test

Dans Stripe Checkout, utilisez les informations de test :

- **Numéro de carte** : `4242 4242 4242 4242`
- **Date d'expiration** : `12/25` (ou toute date future)
- **CVC** : `123`
- **Code postal** : `12345`
- **Nom** : N'importe quel nom

Cliquez sur **"Pay"** ou **"Payer"**

### Étape 4 : Vérifier la redirection

Après le paiement, vous devriez être redirigé vers :
- `http://localhost:5173/payment-success?session_id=...&paiement_id=...`

### Étape 5 : Vérifier que tout est créé automatiquement

Vérifiez dans votre application et dans Supabase Dashboard :

#### ✅ 5.1 Le paiement est validé

Dans **Supabase Dashboard** → **Table Editor** → `paiements` :
- ✅ Le paiement a le statut `paye`
- ✅ `date_paiement` est renseignée
- ✅ `stripe_payment_id` est renseigné

#### ✅ 5.2 La facture est créée

Dans **Supabase Dashboard** → **Table Editor** → `factures` :
- ✅ Une facture existe avec le statut `payee`
- ✅ Elle est liée à l'entreprise créée
- ✅ Le montant correspond au paiement

#### ✅ 5.3 L'abonnement est créé

Dans **Supabase Dashboard** → **Table Editor** → `abonnements` :
- ✅ Un abonnement existe avec le statut `actif`
- ✅ Il est lié au client créé
- ✅ Le `montant_mensuel` est renseigné

#### ✅ 5.4 L'espace client est créé

Dans **Supabase Dashboard** → **Table Editor** → `espaces_membres_clients` :
- ✅ Un espace membre existe
- ✅ Il est lié au client et à l'entreprise

#### ✅ 5.5 Les droits admin sont créés

Dans **Supabase Dashboard** → **Table Editor** → `utilisateurs` :
- ✅ L'utilisateur a le rôle `client_super_admin`

---

## 🔍 VÉRIFICATION DES LOGS

### Logs Supabase Edge Functions

Dans **Supabase Dashboard** → **Edge Functions** → `stripe-webhooks` → **Logs** :

Vous devriez voir :
```
✅ Stripe webhook received: checkout.session.completed
✅ Payment validated successfully
```

### Logs PostgreSQL

Dans **Supabase Dashboard** → **Logs** → **Postgres Logs** :

Vous devriez voir des logs avec :
- `[valider_paiement_carte_immediat]`
- `[creer_facture_et_abonnement_apres_paiement]`
- `[finaliser_creation_apres_paiement]`

---

## 🐛 DÉPANNAGE

### Problème : Redirection vers Stripe Checkout ne fonctionne pas

**Symptômes** :
- Erreur lors de l'appel à `create-stripe-checkout`
- Message "Erreur lors de la création de la session de paiement"

**Solutions** :
1. Vérifiez que `STRIPE_SECRET_KEY` est bien configuré dans Supabase
2. Vérifiez les logs de l'Edge Function `create-stripe-checkout`
3. Vérifiez que la clé Stripe est valide (commence par `sk_test_...`)

### Problème : Paiement validé mais rien ne se crée

**Symptômes** :
- Le paiement apparaît comme `paye` dans Stripe
- Mais aucune facture/abonnement/espace client n'est créé

**Solutions** :
1. Vérifiez que le webhook Stripe est bien configuré
2. Vérifiez les logs de l'Edge Function `stripe-webhooks`
3. Vérifiez que `STRIPE_WEBHOOK_SECRET` correspond au secret dans Stripe Dashboard
4. Vérifiez les logs PostgreSQL pour voir les erreurs éventuelles

### Problème : Erreur "Signature Stripe invalide"

**Symptômes** :
- Erreur dans les logs de `stripe-webhooks`
- "Signature Stripe invalide"

**Solutions** :
1. Vérifiez que `STRIPE_WEBHOOK_SECRET` dans Supabase correspond au "Signing secret" dans Stripe Dashboard
2. Le secret doit commencer par `whsec_...`
3. Si différent, mettez à jour le secret dans Supabase avec celui affiché dans Stripe Dashboard

---

## 📊 CARTES DE TEST STRIPE

Voici d'autres cartes de test que vous pouvez utiliser :

### ✅ Carte valide
- Numéro : `4242 4242 4242 4242`
- Date : `12/25`
- CVC : `123`

### ❌ Carte refusée
- Numéro : `4000 0000 0000 0002`
- Date : `12/25`
- CVC : `123`

### 💳 Carte nécessitant une authentification 3D Secure
- Numéro : `4000 0027 6000 3184`
- Date : `12/25`
- CVC : `123`

### 🌍 Carte internationale
- Numéro : `4000 0032 0000 3043`
- Date : `12/25`
- CVC : `123`

---

## ✅ CHECKLIST DE TEST

Avant de passer en production, vérifiez :

- [ ] Secrets configurés dans Supabase Dashboard
- [ ] Webhook configuré dans Stripe Dashboard
- [ ] Edge Functions déployées
- [ ] Test de paiement réussi avec carte de test
- [ ] Paiement validé automatiquement
- [ ] Facture créée automatiquement
- [ ] Abonnement créé automatiquement
- [ ] Espace client créé automatiquement
- [ ] Droits admin créés automatiquement
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] Redirection après paiement fonctionne
- [ ] Email de confirmation reçu (si configuré)

---

## 🎉 SUCCÈS !

Si tous les tests passent, Stripe est correctement configuré et fonctionne ! 🚀

Vous pouvez maintenant :
- Créer des entreprises avec paiement par carte
- Les paiements seront traités automatiquement
- Tout se crée automatiquement (facture, abonnement, espace client, droits admin)

---

## 📞 BESOIN D'AIDE ?

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans Supabase Dashboard
2. Vérifiez les logs dans Stripe Dashboard → Webhooks
3. Consultez le guide de dépannage ci-dessus
4. Vérifiez que toutes les étapes de configuration ont été suivies


