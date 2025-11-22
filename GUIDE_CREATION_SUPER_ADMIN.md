# 👑 Guide de Création d'un Super Admin

## 📋 Objectif

Créer un compte utilisateur avec les droits **Super Admin** (accès à toutes les données de toutes les entreprises).

**Identifiants à créer :**
- **Email** : `meddecyril@icloud.com`
- **Mot de passe** : `21052024_Aa!`

---

## 🚀 Étapes de Création

### Étape 1 : Créer le compte utilisateur normal

1. **Lancez l'application localement** :
   ```bash
   cd /Users/user/Downloads/cursor
   npm run dev
   ```

2. **Ouvrez votre navigateur** :
   - Allez sur http://localhost:5173

3. **Créez un compte** :
   - Cliquez sur "S'inscrire" ou "Créer un compte"
   - Email : `meddecyril@icloud.com`
   - Mot de passe : `21052024_Aa!`
   - Confirmez le mot de passe

4. **Vérifiez votre email** (si confirmation requise par Supabase)

5. **Connectez-vous** avec ce compte

---

### Étape 2 : Promouvoir en Super Admin via SQL

Une fois le compte créé et l'utilisateur connecté :

1. **Ouvrez Supabase Dashboard** :
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Ouvrez le SQL Editor** :
   - Cliquez sur **"SQL Editor"** dans le menu de gauche
   - Cliquez sur **"New query"**

3. **Exécutez le script SQL** :

   **Option A : Utiliser la fonction** (recommandé)
   ```sql
   -- Exécutez d'abord le script de création de fonction si pas déjà fait
   -- Le fichier: supabase/migrations/20250122000002_create_super_admin.sql
   
   -- Puis exécutez:
   SELECT create_super_admin('meddecyril@icloud.com');
   ```

   **Option B : Mise à jour directe** (si la fonction n'existe pas)
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
       jsonb_build_object('role', 'super_admin')
   WHERE email = 'meddecyril@icloud.com';
   ```

4. **Vérifiez que le rôle a été attribué** :
   ```sql
   SELECT 
     email,
     raw_user_meta_data->>'role' as role,
     created_at
   FROM auth.users
   WHERE email = 'meddecyril@icloud.com';
   ```

   Vous devriez voir : `role: super_admin`

---

### Étape 3 : Vérifier dans l'Application

1. **Déconnectez-vous** puis **reconnectez-vous** avec le compte `meddecyril@icloud.com`

2. **Vérifiez le menu** :
   - Vous devriez voir un menu **"Administration"** dans la sidebar
   - Cette page n'est visible que pour les Super Admins

3. **Accès aux données** :
   - En tant que Super Admin, vous pouvez maintenant voir **toutes les données** de **toutes les entreprises**
   - Vous avez accès à toutes les fonctionnalités de l'application

---

## 🔐 Droits du Super Admin

Le rôle `super_admin` donne accès à :

- ✅ **Toutes les entreprises** (pas seulement les siennes)
- ✅ **Tous les clients** (de toutes les entreprises)
- ✅ **Toutes les factures** (de toutes les entreprises)
- ✅ **Tous les modules** (Comptabilité, Finance, RH, etc.)
- ✅ **Page Administration** (gestion des utilisateurs et rôles)
- ✅ **Toutes les données** sans restriction

---

## 🔧 Dépannage

### L'utilisateur n'existe pas encore

Si vous obtenez l'erreur `Utilisateur avec l'email ... n'existe pas` :

1. Vérifiez que vous avez bien créé le compte dans l'application
2. Vérifiez l'email exact dans Supabase :
   ```sql
   SELECT email FROM auth.users;
   ```
3. Réessayez avec l'email exact

### Le rôle n'apparaît pas après la mise à jour

1. **Déconnectez-vous** complètement de l'application
2. **Fermez le navigateur** ou videz le cache
3. **Reconnectez-vous**
4. Le rôle devrait maintenant être actif

### Le menu Administration n'apparaît pas

1. Vérifiez que le rôle est bien `super_admin` :
   ```sql
   SELECT raw_user_meta_data->>'role' FROM auth.users WHERE email = 'meddecyril@icloud.com';
   ```
2. Vérifiez la console du navigateur pour d'éventuelles erreurs
3. Rechargez la page (F5)

---

## 📝 Script SQL Complet

Le script complet est disponible dans :
```
supabase/migrations/20250122000002_create_super_admin.sql
```

Ce script contient :
- La fonction `create_super_admin(user_email text)`
- L'appel automatique pour créer le Super Admin
- La vérification du rôle attribué

---

## 🎯 Prochaines Étapes

Une fois le Super Admin créé :

1. ✅ Créez des entreprises de test
2. ✅ Ajoutez des clients
3. ✅ Créez des factures
4. ✅ Testez toutes les fonctionnalités
5. ✅ Vérifiez que vous avez accès à toutes les données

---

**Besoin d'aide ?** Consultez le fichier `GUIDE_SUPABASE.md` pour plus d'informations sur la configuration Supabase.


