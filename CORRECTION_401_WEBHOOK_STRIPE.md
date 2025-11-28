# 🔧 CORRECTION ERREUR 401 - WEBHOOK STRIPE

## ❌ PROBLÈME

**Erreur :** `{"code":401,"message":"Missing authorization header"}`

**Cause :** Supabase Edge Functions nécessitent une authentification par défaut, mais les webhooks Stripe n'envoient PAS d'en-tête d'autorisation. Ils utilisent uniquement la signature Stripe.

**Impact :** Tous les webhooks échouent (125/125 dans votre cas), donc le workflow s'arrête à 40%.

---

## ✅ SOLUTION

### Option 1 : Configuration dans Supabase Dashboard (RECOMMANDÉ)

1. **Ouvrir Supabase Dashboard → Edge Functions → stripe-webhooks**
2. **Désactiver l'authentification requise :**
   - Chercher "Verify JWT" ou "Require Authentication"
   - Désactiver cette option
   - OU configurer la fonction comme "Public"

### Option 2 : Créer un fichier `config.toml`

Créer un fichier `supabase/config.toml` avec :

```toml
[functions.stripe-webhooks]
verify_jwt = false
```

### Option 3 : Modifier le code pour ignorer l'auth (DÉJÀ FAIT ✅)

Le code a été modifié pour :
- ✅ Ne PAS vérifier l'authentification Supabase
- ✅ Utiliser uniquement la signature Stripe pour la vérification
- ✅ Retourner 200 OK si la signature Stripe est valide

**MAIS** Supabase peut quand même bloquer au niveau infrastructure.

---

## 🔧 CORRECTION APPLIQUÉE DANS LE CODE

Le fichier `supabase/functions/stripe-webhooks/index.ts` a été modifié pour :

1. ✅ **Ne pas vérifier l'authentification Supabase** - Les webhooks Stripe n'ont pas besoin d'auth Supabase
2. ✅ **Vérifier uniquement la signature Stripe** - C'est la sécurité pour les webhooks
3. ✅ **Ajouter des logs détaillés** - Pour diagnostiquer les problèmes

### Changements principaux :

```typescript
// AVANT : Vérifiait l'auth Supabase (bloquait les webhooks)
// APRÈS : Vérifie uniquement la signature Stripe
if (!signature) {
  return new Response(
    JSON.stringify({ error: 'Signature Stripe absente' }),
    { status: 400, headers: corsHeaders }
  );
}

// Vérifier la signature Stripe (c'est l'authentification)
event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
```

---

## 📋 VÉRIFICATIONS REQUISES

### 1. Configuration du Secret Stripe

**Dans Supabase Dashboard :**
- Settings → Edge Functions → Secrets
- Vérifier que `STRIPE_WEBHOOK_SECRET` existe
- Valeur : `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`

### 2. Configuration du Webhook dans Stripe

**Dans Stripe Dashboard :**
- Developers → Webhooks → [Votre endpoint]
- URL : `https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks`
- Signing secret : `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`
- Événements : `checkout.session.completed`

### 3. Désactiver l'authentification dans Supabase Dashboard

**IMPORTANT :** Même si le code ne vérifie pas l'auth, Supabase peut bloquer au niveau infrastructure.

**Solution :**
1. Ouvrir Supabase Dashboard → Edge Functions → `stripe-webhooks`
2. Chercher "Verify JWT" ou "Authentication"
3. Désactiver cette option
4. OU dans Settings → Edge Functions → Autorisations → Rendre `stripe-webhooks` publique

---

## 🧪 TEST

1. **Déployer l'Edge Function mise à jour**
2. **Effectuer un paiement de test**
3. **Vérifier dans Stripe Dashboard → Webhooks → Logs :**
   - Le statut doit être `200 OK` (au lieu de `401`)
4. **Vérifier dans Supabase Dashboard → Edge Functions → Logs :**
   - Les logs doivent montrer `🔔 [WEBHOOK] Checkout completed`
   - Le workflow doit se compléter

---

## 🚀 DÉPLOIEMENT

Pour déployer l'Edge Function mise à jour :

```bash
cd /Users/user/Downloads/cursor
supabase functions deploy stripe-webhooks
```

OU via Supabase Dashboard :
1. Edge Functions → stripe-webhooks → Deploy
2. Uploader le fichier `supabase/functions/stripe-webhooks/index.ts`

---

**Date :** 2025-01-29
**Statut :** ✅ Code corrigé - En attente de déploiement et configuration Dashboard

