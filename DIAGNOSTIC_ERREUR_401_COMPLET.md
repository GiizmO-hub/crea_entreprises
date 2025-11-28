# 🔍 DIAGNOSTIC COMPLET - ERREUR 401

## 📍 OÙ VOUS TROUVEZ CETTE ERREUR

### 1. Dans le Navigateur Web

**Quand vous ouvrez directement cette URL :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```

**Message affiché :**
```json
{"code":401,"message":"En-tête d'autorisation manquant"}
```

---

### 2. Dans Stripe Dashboard → Webhooks → Logs

**Chemin :**
1. Stripe Dashboard → Developers → Webhooks
2. Cliquer sur votre endpoint (`crea-entreprise`)
3. Onglet "Événements envoyés" ou "Logs"

**Vous voyez :**
- Tous les webhooks en échec (125/125)
- Statut : `401 Unauthorized`
- Message : `Missing authorization header` ou similaire

---

### 3. Dans les Logs Supabase (si accessible)

**Chemin :**
1. Supabase Dashboard → Edge Functions → `stripe-webhooks`
2. Onglet "Logs"

**Vous pouvez voir :**
- Erreurs 401
- Ou rien du tout (si Supabase bloque avant d'exécuter le code)

---

## 🔍 D'OÙ VIENT CETTE ERREUR ?

### Analyse du Code

**✅ BONNE NOUVELLE :** Votre code dans `stripe-webhooks/index.ts` **NE RETOURNE PAS** d'erreur 401 !

```typescript
// Votre code retourne 400, pas 401
if (!signature) {
  return new Response(
    JSON.stringify({ error: 'Signature Stripe absente' }),
    { status: 400 } // ← 400, pas 401
  );
}
```

**❌ PROBLÈME :** L'erreur 401 vient de **SUPABASE AU NIVEAU INFRASTRUCTURE**, avant même que votre code ne s'exécute.

### Pourquoi ?

Supabase Edge Functions nécessitent une authentification par défaut. Quand Stripe envoie un webhook :

1. ✅ Stripe envoie la requête avec la signature Stripe
2. ❌ Stripe N'envoie PAS d'en-tête `Authorization: Bearer ...`
3. ❌ Supabase bloque la requête AVANT d'exécuter votre code
4. ❌ Retourne 401 "Missing authorization header"

**Votre code ne s'exécute même pas !**

---

## ✅ SOLUTION

### Rendons la fonction PUBLIQUE dans Supabase Dashboard

**Étapes détaillées :**

1. **Ouvrir Supabase Dashboard**
   - URL : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr
   - OU aller sur https://supabase.com/dashboard

2. **Aller dans Edge Functions**
   - Menu gauche → "Edge Functions"
   - Chercher `stripe-webhooks` dans la liste

3. **Cliquer sur `stripe-webhooks`**

4. **Chercher les Paramètres**
   - Chercher un bouton/switch "Verify JWT" ou "Authentication Required"
   - OU chercher "Public Access" ou "Public Function"
   - OU dans "Settings" ou "Configuration"

5. **Désactiver l'Authentification**
   - Désactiver "Verify JWT"
   - OU activer "Public Access"
   - OU décocher "Require Authentication"

6. **Sauvegarder**

**Si vous ne trouvez pas cette option :**

**Alternative :**
- Settings → Edge Functions → Autorisations
- Chercher `stripe-webhooks`
- Rendre "Public" ou "Publique"

---

## 🧪 COMMENT VÉRIFIER QUE ÇA FONCTIONNE

### Test 1 : Dans le Navigateur

**Avant correction :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```
→ Affiche : `{"code":401,"message":"En-tête d'autorisation manquant"}`

**Après correction :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```
→ Devrait afficher : Une autre erreur (400, 500, etc.) OU un message différent
→ **Pas de 401** = Auth désactivée ✅

### Test 2 : Dans Stripe Dashboard

1. Stripe Dashboard → Webhooks → [Votre endpoint]
2. Cliquer sur "Envoyer des événements de test"
3. Sélectionner : `checkout.session.completed`
4. Cliquer sur "Envoyer l'événement de test"
5. Vérifier le résultat :
   - ✅ Statut 200 OK → Ça fonctionne !
   - ❌ Statut 401 → Auth pas encore désactivée

### Test 3 : Vrai Paiement

1. Créer une entreprise
2. Payer avec Stripe
3. Vérifier dans Stripe Dashboard → Webhooks → Logs
   - ✅ Statut 200 OK
   - ✅ Webhook reçu avec succès

---

## 📊 RÉSUMÉ

| Élément | Statut | Action |
|---------|--------|--------|
| Code corrigé | ✅ | Ne retourne plus 401 |
| Auth désactivée dans Dashboard | ⚠️ | **À FAIRE MAINTENANT** |
| Secret Stripe configuré | ✅ | Valeur fournie |
| Edge Function déployée | ⚠️ | À faire après désactivation auth |

---

**L'erreur 401 vient de Supabase Dashboard, pas de votre code. Il faut désactiver l'authentification dans le Dashboard !**

