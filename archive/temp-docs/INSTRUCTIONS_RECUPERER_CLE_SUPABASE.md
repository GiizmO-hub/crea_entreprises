# 🔑 Instructions Rapides : Où Trouver `VITE_SUPABASE_ANON_KEY`

**✅ Bonne nouvelle :** Votre clé est déjà dans votre fichier `.env` local !

---

## 📍 Où Trouver la Clé dans Supabase Dashboard

### 🎯 Chemin Exact :

1. **Ouvrez** : https://supabase.com/dashboard
2. **Connectez-vous** avec votre compte
3. **Sélectionnez votre projet** (probablement `ewlozuwvrteopotfizcr`)
4. **Menu de gauche** → Cliquez sur **⚙️ Settings**
5. **Dans le sous-menu** → Cliquez sur **"API"**
6. **Section "Project API keys"** → Trouvez la clé **`anon` `public`**
7. **Cliquez sur l'icône 👁️** ou le bouton **"Reveal"** pour voir la clé complète
8. **Copiez** la valeur (elle commence par `eyJ...`)

---

## 📋 Visualisation

Dans la page **Settings → API**, vous verrez :

```
┌─────────────────────────────────────────────────┐
│ Project URL                                     │
│ https://ewlozuwvrteopotfizcr.supabase.co        │ ← VITE_SUPABASE_URL
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Project API keys                                │
│                                                 │
│ [anon]      [public]    [👁️ Reveal]            │
│ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...         │ ← VITE_SUPABASE_ANON_KEY
│                                                 │
│ [service_role]  [secret]  [⚠️ Keep secret]     │ ← Service Role (NE PAS utiliser)
└─────────────────────────────────────────────────┘
```

---

## ✅ Votre Clé Actuelle (dans .env local)

**Votre clé est déjà configurée localement :**

```
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzMxOTIsImV4cCI6MjA3OTM0OTE5Mn0.7me2IQYMg9NUIpwlHqQJjfGYQl2OHCrUmvcuw8Rl6Ec
```

---

## 🔧 Ce qu'il faut faire Maintenant

### 1. Pour Vercel (si ce n'est pas déjà fait)

1. **Vercel Dashboard** → https://vercel.com/dashboard
2. **Sélectionnez votre projet**
3. **Settings** → **Environment Variables**
4. **Ajoutez ces deux variables :**

```
VITE_SUPABASE_URL = https://ewlozuwvrteopotfizcr.supabase.co
```

```
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzMxOTIsImV4cCI6MjA3OTM0OTE5Mn0.7me2IQYMg9NUIpwlHqQJjfGYQl2OHCrUmvcuw8Rl6Ec
```

5. **Cochez** : Production, Preview, Development
6. **Sauvegardez**
7. **IMPORTANT** : **Redéployez** (Deployments → 3 points → Redeploy)

---

## 🎯 URL Directe pour Accéder aux Clés

**Option 1 : Depuis le Dashboard**
```
https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/api
```

**Option 2 : Navigation manuelle**
```
https://supabase.com/dashboard
  → Sélectionner votre projet
    → Settings (⚙️)
      → API
```

---

## ✅ Vérification

Une fois les variables ajoutées sur Vercel :

1. ✅ **Redéployez** l'application
2. ✅ **Ouvrez** votre site Vercel
3. ✅ **DevTools** (F12) → Console
4. ✅ **Vérifiez** qu'il n'y a **pas** d'erreur : "Missing Supabase environment variables"

---

## 📝 Note Importante

- ✅ **Clé `anon` (public)** : Sûre pour le frontend, visible dans le code JS
- ❌ **Clé `service_role` (secret)** : JAMAIS dans le frontend, seulement backend
- 🔒 **RLS (Row Level Security)** : Protège vos données même avec la clé publique

---

**Si vous avez besoin d'aide pour configurer sur Vercel, dites-moi !** 🔧




