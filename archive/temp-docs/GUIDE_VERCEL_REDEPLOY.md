# 🔄 Guide : Forcer le Redéploiement sur Vercel

**Problème :** Vercel ne charge pas les nouveaux fichiers / Les erreurs 403 persistent

---

## 🎯 Solutions (dans l'ordre)

### ✅ Solution 1 : Vérifier les Déploiements Vercel

1. **Allez sur Vercel Dashboard :** https://vercel.com/dashboard
2. **Sélectionnez votre projet** : `crea-entreprises`
3. **Onglet "Deployments"**
4. **Vérifiez le dernier déploiement :**
   - ✅ Statut : "Ready" (vert)
   - ✅ Commit : Doit être `f2323e8` ou plus récent
   - ✅ Date : Doit être après l'application de la migration

**Si le déploiement n'est pas à jour :**

---

### ✅ Solution 2 : Forcer un Nouveau Déploiement

#### Méthode A : Via le Dashboard Vercel (Recommandé)

1. **Vercel Dashboard** → **Deployments**
2. **Trouvez le dernier déploiement** (même s'il est "Ready")
3. **Cliquez sur les 3 points (...)** à droite
4. **Cliquez sur "Redeploy"**
5. **Laissez les options par défaut** (Production)
6. **Cliquez sur "Redeploy"**

**Attendez 2-3 minutes** pour que le build se termine.

#### Méthode B : Via Git (Push Vide)

```bash
cd /Users/user/Downloads/cursor
git commit --allow-empty -m "Trigger Vercel rebuild"
git push origin main
```

Cela créera un nouveau commit vide qui déclenchera un redéploiement automatique.

#### Méthode C : Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Redéployer
vercel --prod
```

---

### ✅ Solution 3 : Vider le Cache Navigateur

**Le problème peut aussi venir du cache du navigateur :**

1. **Ouvrez Chrome DevTools** (F12)
2. **Cliquez droit sur le bouton de rafraîchissement** (à côté de la barre d'adresse)
3. **Sélectionnez "Vider le cache et actualiser de force"** (Hard Reload)

**OU**

1. **Appuyez sur** `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
2. Cela force un rechargement sans cache

**OU**

1. **DevTools** → **Application** (ou **Stockage**)
2. **Cache Storage** → **Cliquez droit** → **Clear**
3. **Service Workers** → **Unregister** (si présent)
4. **Rechargez la page**

---

### ✅ Solution 4 : Vérifier les Variables d'Environnement

**Les variables d'environnement doivent être configurées sur Vercel :**

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. **Vérifiez que ces variables existent :**
   - ✅ `VITE_SUPABASE_URL`
   - ✅ `VITE_SUPABASE_ANON_KEY`
3. **Si elles manquent, ajoutez-les :**
   - Copiez les valeurs depuis votre `.env` local
   - Cochez **Production**, **Preview**, et **Development**
   - **Sauvegardez**
4. **Redéployez** après avoir ajouté/modifié les variables

---

### ✅ Solution 5 : Vérifier les Logs de Build Vercel

**Si le déploiement échoue silencieusement :**

1. **Vercel Dashboard** → **Deployments**
2. **Cliquez sur le dernier déploiement**
3. **Onglet "Build Logs"** ou **"Logs"**
4. **Vérifiez les erreurs :**
   - ❌ Erreurs de build TypeScript ?
   - ❌ Erreurs de dépendances ?
   - ❌ Erreurs de variables d'environnement ?

**Si vous voyez des erreurs, corrigez-les et redéployez.**

---

## 🔍 Diagnostic : Vérifier que le Code est Bien Déployé

### Test 1 : Vérifier le Hash des Fichiers JS

1. **Ouvrez votre site Vercel** : `https://crea-entreprises.vercel.app`
2. **DevTools** → **Network** (Réseau)
3. **Filtrez par "JS"**
4. **Rechargez la page** (`Ctrl+Shift+R`)
5. **Trouvez** `index-*.js` (le fichier principal)
6. **Regardez le nom du fichier** : Il devrait avoir un nouveau hash si le code a été mis à jour

**Exemple :**
- ✅ **Nouveau :** `index-DILG-29-.js` (hash différent)
- ❌ **Ancien :** `index-ABC-123-.js` (même hash qu'avant)

### Test 2 : Vérifier le Code Source

1. **DevTools** → **Sources** (Sources)
2. **Trouvez** `index-*.js`
3. **Cherchez** dans le code : `get_current_user_role`
4. **Si vous trouvez la fonction**, le code est à jour ✅
5. **Si vous ne trouvez pas**, le code n'est pas à jour ❌

### Test 3 : Vérifier la Console

Dans la console du navigateur, vous devriez voir :

**Si le code est à jour :**
```
✅ Rôle vérifié via RPC: super_admin -> isSuperAdmin: true
```

**Si le code n'est pas à jour :**
```
❌ Erreur 403 sur utilisateurs
⚠️ Impossible de lire utilisateurs, fallback sur user_metadata
```

---

## 🚀 Checklist Complète

- [ ] Vérifié le dernier déploiement Vercel (commit récent)
- [ ] Forcé un redéploiement via Dashboard
- [ ] Vidé le cache du navigateur (Hard Reload)
- [ ] Vérifié les variables d'environnement sur Vercel
- [ ] Vérifié les logs de build Vercel (pas d'erreurs)
- [ ] Vérifié que le hash des fichiers JS a changé
- [ ] Vérifié que `get_current_user_role` est dans le code source
- [ ] Testé dans la console (message "Rôle vérifié via RPC")

---

## 🆘 Si Rien ne Fonctionne

### Option 1 : Supprimer et Recréer le Projet Vercel

1. **Vercel Dashboard** → **Settings** → **General**
2. **Scroll jusqu'en bas** → **Delete Project**
3. **Recréez le projet** en important depuis GitHub
4. **Reconfigurez les variables d'environnement**
5. **Déployez**

### Option 2 : Vérifier la Configuration GitHub

**Vérifiez que Vercel est bien connecté à GitHub :**

1. **Vercel Dashboard** → **Settings** → **Git**
2. **Vérifiez que le repo GitHub est bien connecté**
3. **Vérifiez que la branche `main` est bien surveillée**

---

## 📝 Note Importante

**Le code a été mis à jour localement et poussé sur GitHub.**  
**La migration a été appliquée sur Supabase.**

**Il ne reste plus qu'à forcer Vercel à redéployer avec le nouveau code.**

**Après redéploiement, l'erreur 403 devrait disparaître car le code utilisera la fonction RPC `get_current_user_role()` qui contourne les problèmes RLS.**

---

**Une fois le redéploiement effectué, testez à nouveau et dites-moi si ça fonctionne !** 🚀




