# 🔐 GUIDE DE DIAGNOSTIC - PROBLÈME DE CONNEXION

## 📋 ÉTAPES DE DIAGNOSTIC

### 1️⃣ Vérifier dans la Console du Navigateur

1. Ouvrez votre navigateur
2. Appuyez sur **F12** (ou Cmd+Option+I sur Mac)
3. Allez dans l'onglet **Console**
4. Essayez de vous connecter
5. Regardez les messages qui s'affichent

**Messages à chercher** :
- `🔐 Tentative de connexion pour: votre@email.com`
- `✅ Connexion réussie` ou `❌ Erreur connexion: ...`

---

### 2️⃣ Tester avec le Script de Diagnostic

#### Option A : Test de connexion direct
```bash
cd /Users/user/Downloads/cursor
node scripts/test-auth.mjs votre@email.com votre_mot_de_passe
```

#### Option B : Vérifier si l'utilisateur existe
```bash
node scripts/check-user-exists.mjs votre@email.com
```

**Note** : Pour l'option B, vous devez avoir `SUPABASE_SERVICE_ROLE_KEY` dans votre `.env`

---

### 3️⃣ Vérifier dans Supabase Dashboard

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Authentication** → **Users**
4. Cherchez votre email dans la liste
5. Vérifiez :
   - ✅ L'utilisateur existe
   - ✅ L'email est confirmé (colonne "Confirmed")
   - ✅ Pas de blocage ou restriction

---

## ❌ ERREURS COURANTES ET SOLUTIONS

### Erreur : "Invalid login credentials"

**Causes possibles** :
- Email incorrect
- Mot de passe incorrect
- L'utilisateur n'existe pas dans Supabase

**Solutions** :
1. Vérifiez que l'email est exactement celui enregistré
2. Vérifiez que le mot de passe est correct
3. Créez un nouveau compte si l'utilisateur n'existe pas

---

### Erreur : "Email not confirmed"

**Cause** : L'email n'a pas été confirmé lors de l'inscription

**Solutions** :
1. Vérifiez votre boîte mail pour le lien de confirmation
2. Ou confirmez l'email dans Supabase Dashboard → Authentication → Users → Action → "Confirm email"

---

### Erreur : "Too many requests"

**Cause** : Trop de tentatives de connexion

**Solutions** :
1. Attendez 5-10 minutes
2. Réessayez ensuite

---

## 🔧 SOLUTIONS RAPIDES

### Solution 1 : Créer un nouveau compte

Si l'utilisateur n'existe pas, créez-le via :
1. La page d'inscription de l'application
2. Ou directement dans Supabase Dashboard

---

### Solution 2 : Réinitialiser le mot de passe

1. Allez dans Supabase Dashboard → Authentication → Users
2. Trouvez votre utilisateur
3. Cliquez sur les 3 points → "Send password reset email"
4. Vérifiez votre boîte mail

---

### Solution 3 : Créer l'utilisateur manuellement

1. Allez dans Supabase Dashboard → Authentication → Users
2. Cliquez sur "Add user" → "Create new user"
3. Entrez l'email et un mot de passe
4. ✅ **IMPORTANT** : Cochez "Auto Confirm User"
5. Cliquez sur "Create user"
6. Essayez de vous connecter avec ces identifiants

---

## 📞 PARTAGEZ-MOI

Pour que je puisse vous aider plus précisément, partagez-moi :

1. ✅ L'email que vous utilisez (sans le mot de passe)
2. ✅ Le message d'erreur exact dans la console
3. ✅ Si l'utilisateur existe dans Supabase (oui/non)

---

## ✅ CHECKLIST

- [ ] Variables d'environnement configurées (`.env`)
- [ ] Utilisateur existe dans Supabase Dashboard
- [ ] Email confirmé dans Supabase
- [ ] Mot de passe correct
- [ ] Pas d'erreur dans la console du navigateur
- [ ] Script de test fonctionne

