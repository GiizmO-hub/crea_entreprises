# 👤 CRÉATION D'UTILISATEUR DIRECTE

## 📋 Identifiants à créer

- **Email** : `meddecyril@icloud.com`
- **Mot de passe** : `21052024_Aa!`

## 🔧 Méthode 1 : Script automatique (si SERVICE_ROLE_KEY disponible)

```bash
node scripts/create-user-direct.mjs
```

**Prérequis** : Avoir `SUPABASE_SERVICE_ROLE_KEY` dans votre `.env`

---

## 🔧 Méthode 2 : Via Supabase Dashboard (RECOMMANDÉ)

1. **Allez sur Supabase Dashboard**
   - https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Allez dans Authentication → Users**
   - Menu de gauche → Authentication → Users

3. **Créez l'utilisateur**
   - Cliquez sur **"Add user"** (en haut à droite)
   - Sélectionnez **"Create new user"**

4. **Remplissez les informations**
   - **Email** : `meddecyril@icloud.com`
   - **Password** : `21052024_Aa!`
   - ✅ **IMPORTANT** : Cochez **"Auto Confirm User"**
   - Cliquez sur **"Create user"**

5. **C'est fait !** ✅
   - L'utilisateur est créé et peut se connecter immédiatement

---

## 🔧 Méthode 3 : Via l'API Supabase (si SERVICE_ROLE_KEY disponible)

Ajoutez dans votre `.env` :
```
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
```

Puis :
```bash
node scripts/create-user-direct.mjs
```

---

## 📍 Où trouver la SERVICE_ROLE_KEY ?

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **Settings** → **API**
4. Dans la section **Project API keys**
5. Copiez la clé **"service_role"** (⚠️ PAS la "anon" key)
6. Ajoutez-la dans votre `.env` :
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## ✅ Vérification

Une fois l'utilisateur créé, vous pouvez :
1. Vous connecter dans l'application avec :
   - Email : `meddecyril@icloud.com`
   - Mot de passe : `21052024_Aa!`

2. Ou vérifier dans Supabase Dashboard → Authentication → Users

