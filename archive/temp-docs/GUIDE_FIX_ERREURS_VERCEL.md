# 🔧 Guide : Correction des Erreurs 403 sur Vercel

**Date :** 22 janvier 2025  
**Problème :** Erreur 403 Forbidden sur `/rest/v1/utilisateurs?select=role`

---

## 🐛 Problèmes Identifiés

D'après la console du navigateur sur Vercel :

1. **❌ 403 Forbidden** sur la table `utilisateurs`
   - URL : `/rest/v1/utilisateurs?select=role&id=eq.060d7ec6-9307-4f6d-b85f-c89712774212`
   - **Cause :** Les politiques RLS bloquent même la lecture de ses propres infos

2. **❌ AuthApiError: Invalid Refresh Token**
   - **Cause :** Session expirée ou token invalide

3. **❌ Failed to load resource: 400**
   - **Cause :** Requête malformée ou paramètres incorrects

---

## ✅ Solution 1 : Appliquer la Migration (Recommandé)

### Étape 1 : Ajouter le Mot de Passe PostgreSQL dans `.env`

Ajoutez cette ligne dans votre fichier `.env` :

```bash
SUPABASE_DB_PASSWORD=bYLYcDPnVtPCaj8b
```

### Étape 2 : Appliquer la Migration

```bash
cd /Users/user/Downloads/cursor
node scripts/auto-apply-migrations.js
```

**OU** appliquez la migration manuellement dans Supabase Dashboard :

1. Allez sur **Supabase Dashboard** → **SQL Editor**
2. Copiez le contenu de `supabase/migrations/20250122000046_fix_utilisateurs_rls_permissions_vercel.sql`
3. Collez dans l'éditeur SQL
4. Cliquez sur **Run**

---

## ✅ Solution 2 : Utiliser la Fonction RPC (Alternative)

La fonction `get_current_user_role()` contourne les problèmes RLS. Elle :

1. ✅ Récupère le rôle depuis `utilisateurs` si disponible
2. ✅ Récupère depuis `auth.users` en fallback
3. ✅ Retourne un JSON avec `{ id, role, is_super_admin, is_admin }`
4. ✅ Fonctionne même si les politiques RLS bloquent

---

## 🔧 Changements Apportés au Code

### `src/components/Layout.tsx`

Le code a été mis à jour pour utiliser **3 méthodes en cascade** :

1. **Méthode 1 :** Fonction RPC `get_current_user_role()` (prioritaire)
2. **Méthode 2 :** Lecture directe depuis la table `utilisateurs`
3. **Méthode 3 :** Fallback sur `user_metadata` (si les 2 premières échouent)

Cela garantit que le rôle sera toujours récupéré, même en cas d'erreur RLS.

---

## 📋 Vérification après Application

### 1. Vérifier que la Fonction RPC existe

Dans **Supabase Dashboard** → **Database** → **Functions**, vous devriez voir :
- ✅ `get_current_user_role()` existe

### 2. Tester la Fonction RPC

Dans **Supabase Dashboard** → **SQL Editor** :

```sql
SELECT get_current_user_role();
```

**Résultat attendu :**
```json
{
  "id": "060d7ec6-9307-4f6d-b85f-c89712774212",
  "role": "super_admin",
  "is_super_admin": true,
  "is_admin": true
}
```

### 3. Vérifier les Politiques RLS

Dans **Supabase Dashboard** → **Authentication** → **Policies**, sur la table `utilisateurs` :

- ✅ **"Utilisateurs peuvent voir leurs propres infos"** doit exister
- ✅ **"Utilisateurs authentifiés peuvent lire leur rôle"** doit exister
- ✅ **"Super admin peut voir tous les utilisateurs"** doit exister

---

## 🚀 Redéploiement sur Vercel

Après avoir appliqué la migration :

1. **Pushez les changements sur GitHub :**
   ```bash
   cd /Users/user/Downloads/cursor
   git add -A
   git commit -m "Fix: Correction erreurs 403 utilisateurs + fonction RPC get_current_user_role"
   git push origin main
   ```

2. **Vercel redéploiera automatiquement**

3. **Vérifiez dans la console du navigateur :**
   - ✅ Plus d'erreur 403 sur `utilisateurs`
   - ✅ Le rôle est récupéré correctement
   - ✅ Les modules admin sont visibles

---

## 🔍 Diagnostic si ça ne fonctionne toujours pas

### 1. Vérifier l'Authentification

Dans la console du navigateur (F12), vérifiez :

```javascript
// Tester la session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Tester la fonction RPC
const { data, error } = await supabase.rpc('get_current_user_role');
console.log('RPC Result:', data, error);
```

### 2. Vérifier que l'Utilisateur existe dans `utilisateurs`

Dans **Supabase Dashboard** → **Table Editor** → `utilisateurs` :

- Vérifiez que l'utilisateur `060d7ec6-9307-4f6d-b85f-c89712774212` existe
- Vérifiez que le `role` est bien `super_admin`

Si l'utilisateur n'existe pas, la migration devrait le créer automatiquement depuis `auth.users`.

### 3. Vérifier les Variables d'Environnement sur Vercel

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Vérifiez que ces variables existent :
   - ✅ `VITE_SUPABASE_URL`
   - ✅ `VITE_SUPABASE_ANON_KEY`
3. **Redéployez** après vérification

---

## 📝 Migration Créée

**Fichier :** `supabase/migrations/20250122000046_fix_utilisateurs_rls_permissions_vercel.sql`

**Ce que fait la migration :**

1. ✅ Crée la fonction RPC `get_current_user_role()`
2. ✅ Réapplique les politiques RLS simples
3. ✅ Ajoute une politique de secours plus permissive
4. ✅ Synchronise les utilisateurs manquants depuis `auth.users`

---

## ✅ Checklist de Vérification

- [ ] Migration appliquée (via script ou manuellement)
- [ ] Fonction `get_current_user_role()` existe dans Supabase
- [ ] Politiques RLS sur `utilisateurs` sont correctes
- [ ] Utilisateur super_admin existe dans `utilisateurs`
- [ ] Variables d'environnement configurées sur Vercel
- [ ] Redéploiement effectué sur Vercel
- [ ] Plus d'erreur 403 dans la console
- [ ] Modules admin sont visibles

---

## 🆘 Si le Problème Persiste

1. **Vérifiez les logs Vercel** : Vercel Dashboard → Deployments → Logs
2. **Vérifiez les logs Supabase** : Supabase Dashboard → Logs → Postgres Logs
3. **Vérifiez la console navigateur** : F12 → Console
4. **Contactez-moi** avec :
   - Les erreurs exactes de la console
   - Les logs Vercel
   - Un screenshot de la table `utilisateurs` dans Supabase

---

**Une fois la migration appliquée, les erreurs 403 devraient disparaître !** 🎉




