# 🔍 ANALYSE DES PROBLÈMES STRIPE

## ❌ PROBLÈMES IDENTIFIÉS

### 1. Utilisation de `stripe!.` sans vérification
**Ligne 148** dans `stripe-webhooks/index.ts` :
```typescript
sessionDetails = await stripe!.checkout.sessions.retrieve(session_id, {
```
**Problème :** Si `stripe` est `null`, cela va crasher.

**Solution :** Ajouter une vérification avant utilisation.

### 2. Type `SupabaseClient` non importé
**Ligne 128** : Utilisation de `SupabaseClient` mais pas importé explicitement.

**Solution :** Ajouter `SupabaseClient` à l'import.

---

## ✅ CORRECTIONS APPLIQUÉES

### Correction 1 : Vérification de `stripe` avant utilisation
```typescript
if (!stripe) {
  console.error('❌ [WEBHOOK] Stripe client non initialisé');
  return;
}

sessionDetails = await stripe.checkout.sessions.retrieve(session_id, {
  expand: ['payment_intent']
});
```

### Correction 2 : Import du type `SupabaseClient`
```typescript
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

---

## 🔍 INFORMATIONS NÉCESSAIRES POUR DIAGNOSTIQUER

Pour mieux diagnostiquer le problème, j'aurais besoin de :

1. **Message d'erreur exact** quand vous testez
   - Depuis la console du navigateur (F12)
   - Depuis les logs Supabase (Dashboard → Edge Functions → Logs)
   - Depuis Stripe Dashboard → Webhooks → Logs

2. **Configuration actuelle** :
   - ✅ Les secrets Stripe sont-ils configurés dans Supabase Dashboard ?
     - `STRIPE_SECRET_KEY`
     - `STRIPE_WEBHOOK_SECRET`
   
   - ✅ L'Edge Function `stripe-webhooks` est-elle déployée ?
     - URL: `https://[project-ref].supabase.co/functions/v1/stripe-webhooks`
   
   - ✅ Le webhook est-il configuré dans Stripe Dashboard ?
     - Endpoint URL
     - Événements sélectionnés
     - Signing secret

3. **Ce qui se passe exactement** :
   - Le paiement passe-t-il sur Stripe ?
   - Le webhook est-il reçu par Supabase ?
   - Y a-t-il des erreurs dans les logs ?

---

## 📋 CHECKLIST DE VÉRIFICATION

- [ ] `STRIPE_SECRET_KEY` configuré dans Supabase Dashboard → Edge Functions → Secrets
- [ ] `STRIPE_WEBHOOK_SECRET` configuré dans Supabase Dashboard → Edge Functions → Secrets
- [ ] Edge Function `stripe-webhooks` déployée
- [ ] Webhook configuré dans Stripe Dashboard avec la bonne URL
- [ ] Événement `checkout.session.completed` sélectionné dans Stripe
- [ ] Signing secret dans Stripe correspond à `STRIPE_WEBHOOK_SECRET` dans Supabase

---

## 🧪 TESTS À EFFECTUER

1. **Test création de session** :
   - Créer une entreprise
   - Choisir paiement Stripe
   - Vérifier que la session Stripe est créée

2. **Test paiement** :
   - Utiliser une carte de test : `4242 4242 4242 4242`
   - Vérifier que le paiement passe sur Stripe

3. **Test webhook** :
   - Vérifier dans Stripe Dashboard → Webhooks → Logs
   - Vérifier dans Supabase Dashboard → Edge Functions → Logs

---

**Merci de me fournir ces informations pour mieux diagnostiquer !**

