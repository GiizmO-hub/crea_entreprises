# 📍 OÙ TROUVER L'ERREUR 401 "En-tête d'autorisation manquant"

## 🔍 OÙ CETTE ERREUR APPARAÎT

### 1. Dans le Navigateur (Test Direct)

**Quand :** Vous ouvrez directement l'URL du webhook dans votre navigateur

**URL :** `https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks`

**Message affiché :**
```json
{"code":401,"message":"En-tête d'autorisation manquant"}
```

**Pourquoi :**
- Le navigateur ne fournit pas d'en-tête d'autorisation
- Supabase Edge Functions nécessitent une authentification par défaut
- C'est **NORMAL** pour un test direct dans le navigateur

---

### 2. Dans Stripe Dashboard → Webhooks → Logs

**Quand :** Stripe essaie d'envoyer un webhook à votre endpoint

**Où voir :**
- Stripe Dashboard → Developers → Webhooks
- Cliquer sur votre endpoint (`crea-entreprise`)
- Onglet "Événements envoyés" ou "Logs"

**Message affiché :**
- Statut : `401 Unauthorized`
- Erreur : `Missing authorization header` ou similaire
- **Tous les webhooks échouent** (125/125 dans votre cas)

**Pourquoi :**
- Stripe n'envoie PAS d'en-tête d'autorisation Supabase
- Stripe utilise uniquement la signature Stripe (`stripe-signature`)
- Supabase bloque la requête avant même qu'elle n'atteigne votre code

---

### 3. Dans Supabase Dashboard → Edge Functions → Logs

**Quand :** Les webhooks Stripe sont bloqués par Supabase

**Où voir :**
- Supabase Dashboard → Edge Functions → `stripe-webhooks`
- Onglet "Logs"

**Message affiché :**
- Peut montrer des erreurs 401
- Ou peut ne rien montrer si Supabase bloque avant d'exécuter le code

---

## ✅ SOLUTION

### Problème Principal

**L'erreur 401 vient de Supabase au niveau INFRASTRUCTURE**, pas de votre code.

Même si votre code ne vérifie pas l'authentification, Supabase peut bloquer les requêtes sans en-tête `Authorization`.

### Solution 1 : Rendre la Fonction Publique (RECOMMANDÉ)

1. **Ouvrir Supabase Dashboard**
   - Aller sur : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr

2. **Edge Functions → stripe-webhooks**
   - Cliquer sur "Edge Functions" dans le menu gauche
   - Cliquer sur `stripe-webhooks`

3. **Chercher les Paramètres d'Authentification**
   - Chercher "Verify JWT" ou "Authentication" ou "Autorisations"
   - OU chercher "Public" ou "Public Access"
   - **DÉSACTIVER** l'authentification requise
   - OU activer "Public Access"

4. **Alternative : Settings Globaux**
   - Settings → Edge Functions
   - Chercher "Autorisations" ou "Permissions"
   - Rendre `stripe-webhooks` publique

### Solution 2 : Vérifier le Code

Votre code actuel dans `stripe-webhooks/index.ts` ne devrait PAS retourner 401.

**Vérification :**
```typescript
// ✅ Votre code ne vérifie PAS l'authentification
// Il vérifie uniquement la signature Stripe
if (!signature) {
  return new Response(
    JSON.stringify({ error: 'Signature Stripe absente' }),
    { status: 400 } // ← 400, pas 401
  );
}
```

**Si vous voyez encore 401, c'est que :**
- Supabase bloque au niveau infrastructure AVANT d'exécuter votre code
- Il faut rendre la fonction publique dans le Dashboard

---

## 🧪 COMMENT TESTER

### Test 1 : Test Direct dans le Navigateur

**Attendu :**
- Avant correction : `{"code":401,"message":"En-tête d'autorisation manquant"}`
- Après correction : Une erreur différente (400, 500, etc.) OU un message différent

**Important :** Un test direct dans le navigateur ne devrait PAS fonctionner normalement car :
- Pas de signature Stripe
- Pas de body de webhook
- C'est juste pour vérifier si l'auth est désactivée

### Test 2 : Test avec Stripe Dashboard

1. **Stripe Dashboard → Webhooks → [Votre endpoint]**
2. **Cliquer sur "Envoyer des événements de test"**
3. **Sélectionner :** `checkout.session.completed`
4. **Cliquer sur "Envoyer l'événement de test"**
5. **Vérifier le résultat :**
   - ✅ Si 200 OK → Fonctionne !
   - ❌ Si 401 → Auth pas encore désactivée

### Test 3 : Test avec un Vrai Paiement

1. Créer une entreprise
2. Choisir paiement Stripe
3. Payer avec carte test : `4242 4242 4242 4242`
4. Vérifier dans Stripe Dashboard → Webhooks → Logs :
   - ✅ Statut 200 OK
   - ❌ Statut 401 → Auth pas désactivée

---

## 📋 CHECKLIST DE RÉSOLUTION

- [ ] Code modifié (ne vérifie plus l'auth Supabase) ✅ DÉJÀ FAIT
- [ ] Fonction rendue publique dans Supabase Dashboard ⚠️ À FAIRE
- [ ] `STRIPE_WEBHOOK_SECRET` configuré dans Supabase ✅ VALEUR FOURNIE
- [ ] Edge Function déployée ⚠️ À FAIRE
- [ ] Test avec Stripe Dashboard → "Envoyer des événements de test" ⚠️ À FAIRE
- [ ] Test avec un vrai paiement ⚠️ À FAIRE

---

## 🎯 ACTION IMMÉDIATE

**Ouvrir Supabase Dashboard :**
1. Aller sur : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr
2. Edge Functions → `stripe-webhooks`
3. **Désactiver l'authentification** ou **rendre publique**

Après ça, les webhooks devraient passer ! 🎉

