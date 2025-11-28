# 🔐 CRÉATION DE L'UTILISATEUR : meddecyril@icloud.com

## 📋 SOLUTION RAPIDE

### Option 1 : Créer l'utilisateur dans Supabase Dashboard (RECOMMANDÉ)

1. **Allez sur Supabase Dashboard**
   - https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Allez dans Authentication → Users**
   - Cliquez sur le menu de gauche
   - Puis sur "Authentication"
   - Puis sur "Users"

3. **Créer l'utilisateur**
   - Cliquez sur le bouton **"Add user"** (en haut à droite)
   - Sélectionnez **"Create new user"**
   
4. **Remplir les informations**
   - **Email** : `meddecyril@icloud.com`
   - **Password** : Créez un mot de passe (minimum 6 caractères)
   - ✅ **IMPORTANT** : Cochez la case **"Auto Confirm User"**
   - Cliquez sur **"Create user"**

5. **Tester la connexion**
   - Retournez dans votre application
   - Connectez-vous avec :
     - Email : `meddecyril@icloud.com`
     - Mot de passe : Celui que vous venez de créer

---

### Option 2 : Créer l'utilisateur via la page d'inscription

1. **Dans votre application**
   - Allez sur la page de connexion
   - Cliquez sur **"Pas encore de compte ? S'inscrire"**

2. **Remplissez le formulaire**
   - Email : `meddecyril@icloud.com`
   - Mot de passe : Choisissez un mot de passe (minimum 6 caractères)
   - Cliquez sur **"Créer un compte"**

3. **Confirmer l'email** (si demandé)
   - Vérifiez votre boîte mail (y compris les spams)
   - Cliquez sur le lien de confirmation

---

## 🔍 VÉRIFIER SI L'UTILISATEUR EXISTE DÉJÀ

1. **Dans Supabase Dashboard**
   - Allez dans **Authentication → Users**
   - Utilisez la barre de recherche en haut
   - Tapez : `meddecyril@icloud.com`
   - Si l'utilisateur existe, il apparaîtra dans la liste

2. **Si l'utilisateur existe déjà**
   - Vérifiez la colonne **"Confirmed"** :
     - ✅ Si "Yes" → L'utilisateur peut se connecter
     - ❌ Si "No" → L'email n'est pas confirmé
       - Solution : Cliquez sur les 3 points → "Confirm email"

---

## ❌ SI VOUS NE POUVEZ PAS VOUS CONNECTER

### Problème : "Invalid login credentials"

**Solutions** :
1. Vérifiez que l'email est exactement : `meddecyril@icloud.com`
2. Vérifiez que le mot de passe est correct
3. Si vous avez oublié le mot de passe :
   - Supabase Dashboard → Authentication → Users
   - Trouvez votre utilisateur
   - Cliquez sur les 3 points → "Send password reset email"

### Problème : "Email not confirmed"

**Solutions** :
1. Allez dans Supabase Dashboard → Authentication → Users
2. Trouvez votre utilisateur
3. Cliquez sur les 3 points → "Confirm email"

---

## ✅ CHECKLIST

- [ ] L'utilisateur existe dans Supabase Dashboard
- [ ] L'email est confirmé (colonne "Confirmed" = Yes)
- [ ] Le mot de passe est correct
- [ ] Vous pouvez vous connecter dans l'application

---

## 📞 SI ÇA NE FONCTIONNE TOUJOURS PAS

Partagez-moi :
1. ✅ Si l'utilisateur existe dans Supabase (oui/non)
2. ✅ Le message d'erreur exact dans la console (F12)
3. ✅ Si l'email est confirmé dans Supabase

