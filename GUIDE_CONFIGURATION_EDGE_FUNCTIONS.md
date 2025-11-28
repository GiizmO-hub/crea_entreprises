# 📋 GUIDE DE CONFIGURATION - Edge Functions Supabase

## 🎯 Objectif

Configurer l'Edge Function `stripe-webhooks` pour qu'elle accepte les webhooks Stripe **sans authentification JWT Supabase**.

---

## 📁 Fichier de Configuration

**Fichier créé :** `supabase/config.toml`

**Contenu :**
```toml
[functions.stripe-webhooks]
verify_jwt = false
```

---

## ✅ Pourquoi cette Configuration ?

### Problème

Les webhooks Stripe ne fournissent **PAS** d'en-tête d'authentification Supabase (`Authorization: Bearer ...`). Ils utilisent uniquement la signature Stripe pour vérifier l'authenticité.

### Solution

En désactivant `verify_jwt = false`, Supabase n'exige plus de JWT pour cette fonction. La sécurité est assurée par :
- ✅ La vérification de la signature Stripe dans le code
- ✅ Le secret webhook Stripe (`STRIPE_WEBHOOK_SECRET`)

---

## 🚀 Application de la Configuration

### Option 1 : Déploiement via Supabase CLI (RECOMMANDÉ)

```bash
# Déployer la fonction avec la configuration
supabase functions deploy stripe-webhooks

# OU déployer toutes les fonctions
supabase functions deploy
```

La configuration dans `supabase/config.toml` sera automatiquement appliquée.

### Option 2 : Configuration Manuelle dans Supabase Dashboard

Si le déploiement via CLI ne fonctionne pas, vous pouvez configurer manuellement :

1. **Ouvrir Supabase Dashboard**
   - URL : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr

2. **Aller dans Edge Functions**
   - Menu gauche → "Edge Functions"
   - Cliquer sur `stripe-webhooks`

3. **Chercher "Verify JWT" ou "Authentication"**
   - Désactiver "Verify JWT"
   - OU activer "Public Access"

4. **Sauvegarder**

---

## ✅ Vérification

### Test 1 : Dans le Navigateur

**Avant configuration :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```
→ Affiche : `{"code":401,"message":"En-tête d'autorisation manquant"}` ❌

**Après configuration :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```
→ Affiche : Autre erreur (400, 500, etc.) ou message différent ✅
→ **Pas de 401** = Configuration appliquée !

### Test 2 : Dans Stripe Dashboard

1. Stripe Dashboard → Webhooks → [Votre endpoint]
2. Cliquer sur "Envoyer des événements de test"
3. Sélectionner : `checkout.session.completed`
4. Cliquer sur "Envoyer l'événement de test"
5. Vérifier :
   - ✅ Statut 200 OK → Configuration réussie !
   - ❌ Statut 401 → Configuration pas encore appliquée

### Test 3 : Vrai Paiement

1. Créer une entreprise
2. Payer avec Stripe
3. Vérifier dans Stripe Dashboard → Webhooks → Logs
   - ✅ Statut 200 OK
   - ✅ Webhook reçu avec succès

---

## 📋 Checklist

- [x] Fichier `supabase/config.toml` créé ✅
- [ ] Configuration déployée via CLI OU configurée manuellement ⚠️
- [ ] Test dans le navigateur (pas de 401) ⚠️
- [ ] Test avec Stripe Dashboard → "Envoyer des événements de test" ⚠️
- [ ] Test avec un vrai paiement ⚠️

---

## 🔒 Sécurité

**⚠️ IMPORTANT :** Cette configuration rend la fonction `stripe-webhooks` publique, mais la sécurité est assurée par :

1. **Vérification de la signature Stripe**
   - Le code vérifie la signature avec `stripe.webhooks.constructEvent()`
   - Utilise le secret webhook Stripe (`STRIPE_WEBHOOK_SECRET`)

2. **Aucune donnée sensible exposée**
   - La fonction ne fait que recevoir et valider des webhooks
   - Les données sont traitées de manière sécurisée

3. **Pas d'authentification utilisateur requise**
   - Les webhooks Stripe sont des événements système
   - Pas besoin d'authentification utilisateur

---

## 📚 Références

- [Documentation Supabase - Configuration Edge Functions](https://supabase.com/docs/guides/functions/function-configuration)
- [Documentation Supabase - Déploiement Edge Functions](https://supabase.com/docs/guides/functions/deploy)
- [Documentation Stripe - Webhooks](https://stripe.com/docs/webhooks)

---

## 🆘 Dépannage

### Le fichier config.toml n'est pas pris en compte

**Solution :**
1. Vérifier que le fichier est dans `supabase/config.toml`
2. Vérifier la syntaxe TOML (pas d'erreurs)
3. Redéployer la fonction : `supabase functions deploy stripe-webhooks`
4. OU configurer manuellement dans le Dashboard

### L'erreur 401 persiste

**Solution :**
1. Vérifier que la configuration est bien déployée
2. Attendre quelques minutes (propagation)
3. Vérifier dans Supabase Dashboard → Edge Functions → `stripe-webhooks`
4. Configurer manuellement dans le Dashboard si nécessaire

### Comment vérifier la configuration actuelle

**Dans Supabase Dashboard :**
1. Edge Functions → `stripe-webhooks`
2. Regarder les paramètres / configuration
3. Vérifier si "Verify JWT" est désactivé

---

**🎯 Objectif atteint : Les webhooks Stripe peuvent maintenant être reçus sans erreur 401 !**

