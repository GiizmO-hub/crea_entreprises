# 📋 INFORMATIONS STRIPE DEMANDÉES

## 🔍 Pour diagnostiquer complètement le problème, j'ai besoin des informations suivantes depuis Stripe Dashboard :

### 1. Configuration du Webhook

1. **URL du webhook** :
   - Stripe Dashboard → Developers → Webhooks
   - Quelle est l'URL configurée ? 
   - Format attendu : `https://[project-ref].supabase.co/functions/v1/stripe-webhooks`

2. **Événements sélectionnés** :
   - Quels événements sont sélectionnés pour ce webhook ?
   - ✅ `checkout.session.completed` (obligatoire)
   - Autres événements ?

3. **Signing secret** :
   - Stripe Dashboard → Developers → Webhooks → [Votre endpoint] → Signing secret
   - Copier le "Signing secret" (commence par `whsec_`)
   - À comparer avec `STRIPE_WEBHOOK_SECRET` dans Supabase

### 2. Logs des Webhooks

1. **Derniers événements reçus** :
   - Stripe Dashboard → Developers → Webhooks → [Votre endpoint] → Logs
   - Les derniers événements `checkout.session.completed` :
     - ✅ Reçus ? (statut 200)
     - ❌ Échecs ? (statut 400, 500, etc.)
     - Message d'erreur si échec ?

2. **Tentatives de livraison** :
   - Nombre de tentatives pour chaque événement
   - Dernière tentative réussie ou échouée

### 3. Paiements Stripe

1. **Paiements récents** :
   - Stripe Dashboard → Payments
   - Les 5 derniers paiements :
     - ID du paiement (commence par `pi_`)
     - Statut (succeeded, failed, pending)
     - Montant
     - Date

2. **Sessions Checkout** :
   - Stripe Dashboard → Payments → Checkout sessions
   - Les 5 dernières sessions :
     - ID de session (commence par `cs_`)
     - Statut (complete, expired, etc.)
     - `client_reference_id` (doit contenir le `paiement_id`)
     - `payment_status` (paid, unpaid, no_payment_required)

### 4. Configuration de l'API

1. **Clés API** :
   - Stripe Dashboard → Developers → API keys
   - Clé secrète utilisée (Test ou Live) ?
   - Format : `sk_test_...` ou `sk_live_...`
   - À comparer avec `STRIPE_SECRET_KEY` dans Supabase

2. **Mode** :
   - Mode Test ou Mode Live ?
   - Vérifier que les clés correspondent au bon mode

---

## 📤 FORMAT DE RÉPONSE SOUHAITÉ

Vous pouvez me donner ces informations dans n'importe quel format, par exemple :

```
WEBHOOK:
- URL: https://xxx.supabase.co/functions/v1/stripe-webhooks
- Événements: checkout.session.completed
- Signing secret: whsec_xxx
- Derniers événements: [réussis / échecs avec détails]

PAIEMENTS:
- Derniers paiements: [liste avec statuts]
- Sessions checkout: [liste avec statuts et client_reference_id]

CLÉS API:
- Clé secrète: sk_test_xxx
- Mode: Test
```

---

## 🧪 TEST SUGGÉRÉ

Si possible, effectuez un test de paiement et notez :

1. **Création de la session** :
   - ✅ Session créée dans Stripe ?
   - ID de la session

2. **Paiement** :
   - ✅ Paiement réussi sur Stripe ?
   - ID du paiement (`pi_`)

3. **Webhook** :
   - ✅ Webhook reçu par Supabase ?
   - Statut de la réponse (200, 400, 500, etc.)
   - Message d'erreur si échec

4. **Résultat final** :
   - ✅ Abonnement créé dans Supabase ?
   - ✅ Facture créée dans Supabase ?
   - ✅ Paiement marqué comme "payé" ?

---

**Merci de me fournir ces informations pour un diagnostic complet ! 🎯**

