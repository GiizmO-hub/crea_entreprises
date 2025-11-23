# 🚨 ACTION URGENTE : Redéployer sur Vercel

**Date :** 22 janvier 2025  
**Problème :** Vercel n'a pas encore déployé le nouveau code avec la fonction RPC

---

## ⚡ ACTION IMMÉDIATE (2 minutes)

### 1. Allez sur Vercel Dashboard

**Lien direct :** https://vercel.com/dashboard

### 2. Sélectionnez votre projet

Projet : **`crea-entreprises`**

### 3. Forcer le Redéploiement

1. **Onglet "Deployments"** (en haut)
2. **Trouvez le dernier déploiement**
3. **Cliquez sur les 3 points (...)** à droite du déploiement
4. **Cliquez sur "Redeploy"**
5. **Laissez les options par défaut**
6. **Cliquez sur "Redeploy"**

### 4. Attendez 2-3 minutes

Le build va se lancer. Attendez que le statut passe à **"Ready"** (vert).

### 5. Videz le Cache du Navigateur

1. **Appuyez sur** `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
2. **OU** DevTools (F12) → **Cliquez droit sur le bouton de rafraîchissement** → **"Vider le cache et actualiser de force"**

### 6. Testez

Ouvrez votre site et vérifiez la console (F12).  
L'erreur 403 devrait disparaître !

---

## ✅ Ce qui a déjà été fait

- [x] ✅ Code mis à jour (`Layout.tsx` utilise maintenant `get_current_user_role()`)
- [x] ✅ Migration appliquée sur Supabase (fonction RPC créée)
- [x] ✅ Changements poussés sur GitHub
- [ ] ⏳ **Vercel doit redéployer** ← **VOUS ÊTES ICI**

---

## 🔍 Vérification après Redéploiement

Dans la console du navigateur (F12), vous devriez voir :

```
✅ Rôle vérifié via RPC: super_admin -> isSuperAdmin: true
```

**Au lieu de :**
```
❌ Failed to load resource: the server responded with a status of 403
```

---

## 📞 Si ça ne fonctionne toujours pas

1. **Vérifiez les logs de build Vercel** (onglet "Logs" du déploiement)
2. **Vérifiez les variables d'environnement** (Settings → Environment Variables)
3. **Dites-moi ce que vous voyez** et je vous aiderai à résoudre le problème

---

**C'est simple : 3 clics pour redéployer !** 🚀

