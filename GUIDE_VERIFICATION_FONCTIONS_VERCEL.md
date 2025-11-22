# 🔍 Guide : Vérification des Fonctions RPC sur Vercel

## ❓ Problème

Les fonctions RPC (`update_collaborateur`, `suspendre_collaborateur`, `activer_collaborateur`) ne sont pas disponibles sur le déploiement Vercel.

## 🔍 Diagnostic

### 1. Vérifier que les fonctions existent sur Supabase

Connectez-vous à votre dashboard Supabase :

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Exécutez cette requête :

```sql
-- Vérifier que les fonctions existent
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_collaborateur',
    'suspendre_collaborateur',
    'activer_collaborateur'
  )
ORDER BY routine_name;
```

**Résultat attendu :** Vous devriez voir 3 fonctions listées.

Si les fonctions n'existent PAS, il faut les créer.

### 2. Vérifier que les migrations sont bien appliquées

Exécutez cette requête dans Supabase SQL Editor :

```sql
-- Vérifier les migrations appliquées
SELECT * FROM schema_migrations
WHERE migration_name LIKE '%functions_update_suspend_collaborateurs%'
ORDER BY applied_at DESC
LIMIT 1;
```

**Si la table n'existe pas ou ne contient pas l'entrée :**

C'est normal, le script `auto-apply-migrations.js` applique les migrations directement mais n'enregistre pas toujours dans `schema_migrations`.

### 3. Appliquer les fonctions manuellement (si nécessaire)

Si les fonctions n'existent pas, copiez et exécutez le contenu de la migration dans Supabase SQL Editor :

**Fichier :** `supabase/migrations/20250122000015_functions_update_suspend_collaborateurs.sql`

**Ou exécutez directement :**

```sql
-- Copiez tout le contenu du fichier de migration
-- Puis exécutez-le dans Supabase SQL Editor
```

## ✅ Solution 1 : Réappliquer les migrations automatiquement

Depuis votre machine locale :

```bash
cd /Users/user/Downloads/cursor
npm run db:apply-migrations
```

Cela réappliquera toutes les migrations, y compris celle qui crée les fonctions.

## ✅ Solution 2 : Appliquer les fonctions manuellement sur Supabase

1. **Connectez-vous à Supabase Dashboard**
2. **Allez dans SQL Editor**
3. **Ouvrez le fichier** `supabase/migrations/20250122000015_functions_update_suspend_collaborateurs.sql`
4. **Copiez tout le contenu**
5. **Collez-le dans SQL Editor**
6. **Exécutez la requête**

## ✅ Solution 3 : Vérifier les variables d'environnement Vercel

Assurez-vous que Vercel utilise la **même URL Supabase** que votre environnement local :

1. **Sur Vercel :**
   - Allez sur https://vercel.com/dashboard
   - Sélectionnez votre projet
   - Allez dans **Settings** → **Environment Variables**
   - Vérifiez `VITE_SUPABASE_URL` :
     ```
     VITE_SUPABASE_URL=https://ewlozuwvrteopotfizcr.supabase.co
     ```

2. **Sur votre machine locale :**
   ```bash
   cat .env | grep VITE_SUPABASE_URL
   ```

Les deux doivent être **identiques**.

## ✅ Solution 4 : Forcer un redéploiement Vercel

Parfois, Vercel doit être redéployé pour prendre en compte les nouvelles fonctions :

1. **Via GitHub (recommandé) :**
   ```bash
   # Créez un commit vide pour forcer le redéploiement
   git commit --allow-empty -m "Force Vercel redeploy"
   git push origin main
   ```

2. **Via Vercel Dashboard :**
   - Allez sur votre projet Vercel
   - Cliquez sur **Deployments**
   - Trouvez le dernier déploiement
   - Cliquez sur **⋯** (trois points)
   - Sélectionnez **Redeploy**

## 🧪 Test des fonctions depuis Vercel

Une fois le déploiement fait, testez dans la console du navigateur (sur Vercel) :

```javascript
// Ouvrez la console du navigateur (F12)
// Sur la page Collaborateurs, essayez :

const { data, error } = await supabase.rpc('update_collaborateur', {
  p_collaborateur_id: '...',
  p_nom: 'Test'
});

console.log('Résultat:', data, error);
```

**Si l'erreur est "function does not exist" :**
- Les fonctions ne sont pas créées sur Supabase
- Suivez **Solution 1** ou **Solution 2**

**Si l'erreur est "permission denied" :**
- C'est normal si vous n'êtes pas connecté en tant que super_admin
- Connectez-vous avec un compte super_admin

## 📋 Checklist complète

- [ ] Les fonctions existent dans Supabase SQL Editor
- [ ] `VITE_SUPABASE_URL` est identique sur Vercel et local
- [ ] Les migrations ont été appliquées (via script ou manuellement)
- [ ] Vercel a été redéployé après les migrations
- [ ] Le code est à jour sur GitHub
- [ ] Test des fonctions dans la console du navigateur

## 🎯 Cause probable

Le problème le plus fréquent est que :

1. **Les migrations ont été appliquées localement** ✅
2. **Mais pas sur la base Supabase utilisée par Vercel** ❌

Ou :

1. **Les migrations sont appliquées sur Supabase** ✅
2. **Mais Vercel utilise un cache ou n'a pas été redéployé** ❌

**Solution immédiate :** Suivez **Solution 1** (réappliquer les migrations) puis **Solution 4** (redéployer Vercel).

## 📞 Debug avancé

Si le problème persiste, vérifiez dans Supabase Dashboard :

1. **Database** → **Functions**
   - Les fonctions `update_collaborateur`, `suspendre_collaborateur`, `activer_collaborateur` doivent apparaître

2. **Database** → **Extensions**
   - `pgcrypto` doit être activé

3. **Logs** → **Database Logs**
   - Vérifiez s'il y a des erreurs lors de l'appel des fonctions

