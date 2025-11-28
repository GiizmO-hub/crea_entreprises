# 👤 CRÉER LE COMPTE MAINTENANT

## 🚀 MÉTHODE RAPIDE : Via Supabase Dashboard

### Étape 1 : Accéder au Dashboard
1. Allez sur **https://supabase.com/dashboard**
2. Connectez-vous à votre compte
3. Sélectionnez votre projet

### Étape 2 : Créer l'utilisateur
1. Dans le menu de gauche, cliquez sur **"Authentication"**
2. Puis cliquez sur **"Users"**
3. Cliquez sur le bouton **"Add user"** (en haut à droite, bouton vert/bleu)
4. Sélectionnez **"Create new user"**

### Étape 3 : Remplir les informations
Dans le formulaire qui s'affiche :

- **Email** : `meddecyril@icloud.com`
- **Password** : `21052024_Aa!`
- ✅ **IMPORTANT** : Cochez la case **"Auto Confirm User"** (en bas du formulaire)
- Cliquez sur **"Create user"**

### Étape 4 : C'est fait ! ✅
L'utilisateur est créé et peut se connecter immédiatement.

---

## 🔧 MÉTHODE ALTERNATIVE : Avec le script automatique

Si vous préférez utiliser un script, vous devez d'abord ajouter la `SERVICE_ROLE_KEY`.

### Étape 1 : Récupérer la SERVICE_ROLE_KEY
1. Allez sur **https://supabase.com/dashboard**
2. Sélectionnez votre projet
3. Allez dans **Settings** → **API**
4. Dans la section **"Project API keys"**
5. Copiez la clé **"service_role"** (⚠️ PAS la "anon" key, c'est celle qui commence par `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Étape 2 : Ajouter dans .env
Ouvrez votre fichier `.env` et ajoutez :
```
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
```

### Étape 3 : Exécuter le script
```bash
cd /Users/user/Downloads/cursor
node scripts/create-user-direct.mjs
```

---

## ✅ VÉRIFICATION

Une fois l'utilisateur créé, testez la connexion :

1. Ouvrez votre application
2. Sur la page de connexion, entrez :
   - **Email** : `meddecyril@icloud.com`
   - **Mot de passe** : `21052024_Aa!`
3. Cliquez sur **"Se connecter"**

Si tout fonctionne, vous serez redirigé vers le tableau de bord ! 🎉

