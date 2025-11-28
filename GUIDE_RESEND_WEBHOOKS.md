# 📧 Guide de Configuration des Webhooks Resend

## 🔍 Diagnostic du problème

Les erreurs dans les logs Supabase indiquent :

```
❌ Erreur Resend 403: "You can only send testing emails to your own email address"
```

**Cause** : Votre compte Resend est en **MODE TEST/DÉVELOPPEMENT**.

En mode test, Resend limite l'envoi à votre propre adresse email uniquement :
- `fm4qdzgwgt@privaterelay.appleid.com`

---

## ✅ Solution 1 : Passer en mode production (Recommandé)

### Étapes détaillées :

1. **Aller sur le Dashboard Resend**
   - 👉 https://resend.com/dashboard
   - Se connecter avec votre compte

2. **Ajouter un domaine**
   - Dans le menu de gauche, cliquer sur **"Domains"**
   - Cliquer sur le bouton **"Add Domain"**
   - Entrer votre domaine (ex: `votredomaine.com`)
   - Cliquer sur **"Add"**

3. **Configurer les DNS**
   Resend affichera 3 à 4 enregistrements DNS à ajouter :
   
   **SPF Record** (Type TXT) :
   ```
   v=spf1 include:_spf.resend.com ~all
   ```
   
   **DKIM Records** (2 records de type TXT) :
   - Resend fournira deux clés uniques
   - Format : `resend._domainkey.votredomaine.com`
   
   **DMARC Record** (Optionnel mais recommandé) :
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@votredomaine.com
   ```

4. **Vérifier le domaine**
   - Une fois les DNS configurés, attendre 5-15 minutes
   - Resend vérifiera automatiquement
   - Un badge ✅ vert apparaîtra quand c'est vérifié

5. **Mode production activé**
   - Une fois vérifié, vous pouvez envoyer à n'importe quelle adresse
   - Mettez à jour `RESEND_FROM_EMAIL` dans Supabase avec votre domaine

---

## 📬 Solution 2 : Configurer les Webhooks Resend (Optionnel)

Les webhooks permettent de **tracker les événements** de vos emails en temps réel :
- ✅ `email.delivered` - Email livré
- ❌ `email.bounced` - Email rebondi
- ⚠️ `email.complained` - Email marqué comme spam
- 👁️ `email.opened` - Email ouvert
- 🖱️ `email.clicked` - Lien cliqué dans l'email

### Étape 1 : Edge Function déjà déployée ✅

L'Edge Function `resend-webhooks` est déjà créée et déployée :
- ✅ Fichier : `supabase/functions/resend-webhooks/index.ts`
- ✅ Déployée sur : `https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/resend-webhooks`
- ✅ JWT désactivé dans `config.toml`

### Étape 2 : Créer le webhook dans Resend

1. **Aller sur Resend Webhooks**
   - 👉 https://resend.com/webhooks
   - Se connecter avec votre compte

2. **Créer un nouveau webhook**
   - Cliquer sur **"Create Webhook"**
   - **Name** : `Supabase Email Events`
   - **URL** :
     ```
     https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/resend-webhooks
     ```
   - **Description** (optionnel) : `Track email events in Supabase`

3. **Sélectionner les événements**
   Cochez les événements à recevoir :
   - ✅ `email.sent` - Email envoyé
   - ✅ `email.delivered` - Email livré
   - ✅ `email.delivery_delayed` - Livraison retardée
   - ✅ `email.bounced` - Email rebondi
   - ✅ `email.complained` - Marqué comme spam
   - ✅ `email.opened` - Email ouvert
   - ✅ `email.clicked` - Lien cliqué

4. **Enregistrer le webhook**
   - Cliquer sur **"Create"**
   - Resend affichera une **clé webhook secrète**
   - Format : `whsec_...` (différent de Stripe)

### Étape 3 : Configurer la clé dans Supabase

1. **Copier la clé webhook**
   - Dans Resend Dashboard → Webhooks
   - Cliquer sur votre webhook
   - Copier la clé secrète (`whsec_...`)

2. **Ajouter dans Supabase**
   - Aller dans **Supabase Dashboard**
   - **Settings** → **Edge Functions** → **Secrets**
   - Cliquer sur **"Add new secret"**
   - **Name** : `RESEND_WEBHOOK_SECRET`
   - **Value** : Coller la clé (`whsec_...`)
   - Cliquer sur **"Save"**

### Étape 4 : Vérifier le fonctionnement

1. **Envoyer un email de test**
   - Utiliser votre application pour envoyer un email
   - Vérifier que l'email est bien envoyé

2. **Vérifier les logs**
   - Supabase Dashboard → **Edge Functions** → **resend-webhooks** → **Logs**
   - Vous devriez voir : `📬 Webhook Resend reçu: email.delivered`

3. **Vérifier la table email_logs**
   - Supabase Dashboard → **Table Editor** → **email_logs**
   - Le statut devrait être mis à jour automatiquement :
     - `status: 'delivered'` pour les emails livrés
     - `status: 'bounced'` pour les rebonds
     - etc.

---

## 🔑 Différence entre Stripe et Resend Webhooks

### Stripe Webhooks
- **Clé** : `STRIPE_WEBHOOK_SECRET`
- **Format** : `whsec_...`
- **Edge Function** : `stripe-webhooks`
- **Événements** : Paiements, abonnements, factures

### Resend Webhooks
- **Clé** : `RESEND_WEBHOOK_SECRET`
- **Format** : `whsec_...` (mais clé différente)
- **Edge Function** : `resend-webhooks`
- **Événements** : Emails (livré, rebondi, ouvert, etc.)

⚠️ **Important** : Les deux utilisent le même format de clé (`whsec_...`) mais ce sont des clés **différentes**. Ne les mélangez pas !

---

## 📊 Fonctionnalités des webhooks Resend

L'Edge Function `resend-webhooks` fait automatiquement :

1. **Vérification de la signature**
   - Valide que le webhook vient bien de Resend
   - Protège contre les faux événements

2. **Mise à jour de `email_logs`**
   - Met à jour le `status` selon l'événement
   - Enregistre les erreurs (rebonds, spam, etc.)
   - Met à jour `updated_at`

3. **Logs détaillés**
   - Enregistre chaque événement dans les logs Supabase
   - Permet de déboguer les problèmes

---

## 🧪 Tester les webhooks

### Option 1 : Test manuel via Resend
1. Aller sur https://resend.com/webhooks
2. Cliquer sur votre webhook
3. Utiliser **"Send Test Event"**
4. Vérifier les logs Supabase

### Option 2 : Envoi réel
1. Envoyer un email via votre application
2. Vérifier les logs dans Supabase Dashboard
3. Vérifier `email_logs` pour les mises à jour automatiques

---

## ✅ Checklist finale

- [x] Edge Function `resend-webhooks` créée ✅
- [x] Edge Function `resend-webhooks` déployée ✅
- [x] Migration `20250130000003` appliquée (status dans email_logs) ✅
- [ ] Compte Resend passé en mode production
- [ ] Webhook créé dans Resend Dashboard (optionnel)
- [ ] `RESEND_WEBHOOK_SECRET` configuré dans Supabase (optionnel)
- [ ] Test d'envoi d'email réussi
- [ ] Vérification des logs et de `email_logs`

---

## 📝 Notes importantes

1. **Mode test Resend** :
   - Limite l'envoi à votre propre email
   - Nécessite un domaine vérifié pour passer en production
   - Les webhooks fonctionnent même en mode test

2. **Webhooks optionnels** :
   - Les emails fonctionnent sans webhooks
   - Les webhooks ajoutent du tracking (livré, rebondi, ouvert, etc.)
   - Recommandé pour une meilleure visibilité

3. **Sécurité** :
   - Les webhooks sont signés par Resend
   - La vérification de signature est automatique
   - JWT désactivé pour `resend-webhooks` (comme pour Stripe)

4. **Performance** :
   - Les webhooks sont asynchrones
   - N'affectent pas la vitesse d'envoi
   - Les logs sont mis à jour en arrière-plan

---

**✨ Tout est maintenant configuré et prêt !**

Une fois le domaine Resend vérifié, vous pourrez :
- ✅ Envoyer des emails à n'importe quelle adresse
- ✅ Tracker les événements via webhooks
- ✅ Voir le statut de chaque email dans `email_logs`

