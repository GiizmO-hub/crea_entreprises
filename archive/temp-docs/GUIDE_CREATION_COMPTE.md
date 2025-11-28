# 🔐 Guide de création de compte et configuration

## 📋 Comptes à créer

### 1. Supabase (Base de données)

**URL :** https://supabase.com/dashboard

**Étapes :**
1. Allez sur https://supabase.com/dashboard
2. Cliquez sur **"Start your project"** ou **"Sign up"**
3. Utilisez **GitHub** pour vous connecter (recommandé) ou créez un compte avec l'email
4. Une fois connecté, cliquez sur **"New Project"**
5. Remplissez le formulaire :
   - **Name** : `crea-entreprises` ou `crea-entreprises-prod`
   - **Database Password** : `21052024_Aa!` (ou un mot de passe fort)
   - **Region** : Choisissez la région la plus proche (Europe West pour la France)
   - **Pricing Plan** : Free (pour commencer)

6. Attendez que le projet soit créé (2-3 minutes)

7. **Récupérez les clés API :**
   - Allez dans **Settings** → **API**
   - Copiez :
     - **Project URL** : `https://xxxxx.supabase.co`
     - **anon/public key** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Créer le fichier .env local

Une fois que vous avez les clés Supabase, créez le fichier `.env` :

```bash
cd /Users/user/Downloads/cursor
```

Créez le fichier `.env` :

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Appliquer les migrations SQL

Une fois le projet Supabase créé :

1. Allez dans **SQL Editor** dans le dashboard Supabase
2. Ouvrez le fichier `supabase/migrations/20250122000000_initial_schema.sql`
3. Copiez tout le contenu et exécutez-le dans le SQL Editor
4. Ouvrez ensuite `supabase/migrations/20250122000001_insert_initial_data.sql`
5. Copiez et exécutez ce contenu aussi

### 4. Créer un compte utilisateur dans l'application

Une fois la base de données configurée :

1. Lancez l'application localement :
   ```bash
   npm run dev
   ```

2. Allez sur http://localhost:5173

3. Créez un compte avec :
   - **Email** : `meddecyril@icloud.com`
   - **Mot de passe** : `21052024_Aa!`

4. L'utilisateur sera automatiquement créé dans Supabase Auth

### 5. Configurer Vercel (Variables d'environnement)

Une fois le compte créé et testé localement :

1. Allez sur votre projet Vercel
2. **Settings** → **Environment Variables**
3. Ajoutez :
   - `VITE_SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

4. **Redeploy** le projet pour appliquer les variables

---

## 🎯 Checklist de configuration

- [ ] Compte Supabase créé
- [ ] Projet Supabase créé
- [ ] Clés API récupérées
- [ ] Fichier `.env` créé localement
- [ ] Migrations SQL appliquées
- [ ] Application testée localement
- [ ] Compte utilisateur créé dans l'app
- [ ] Variables d'environnement configurées sur Vercel
- [ ] Application déployée et fonctionnelle

---

## 🔒 Sécurité

⚠️ **Important :**
- Ne commitez **JAMAIS** le fichier `.env` sur GitHub
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez des mots de passe forts pour la base de données
- Gardez vos clés API secrètes

---

## 📞 Support

Si vous avez des problèmes lors de la création du compte ou de la configuration, faites-le moi savoir !





