# 🔑 Guide : Où Trouver les Clés Supabase

**Date :** 22 janvier 2025

---

## 🎯 Où Trouver `VITE_SUPABASE_ANON_KEY`

### ✅ Méthode 1 : Supabase Dashboard (Recommandé)

#### Étape 1 : Accéder au Dashboard Supabase

1. Allez sur **https://supabase.com/dashboard**
2. Connectez-vous avec votre compte
3. Sélectionnez votre projet : **`ewlozuwvrteopotfizcr`** (ou le nom de votre projet)

#### Étape 2 : Aller dans Settings → API

1. Dans le menu de gauche, cliquez sur **"Settings"** (⚙️ Paramètres)
2. Dans le sous-menu, cliquez sur **"API"**

#### Étape 3 : Récupérer la Clé Anon (publique)

Dans la section **"Project API keys"**, vous verrez plusieurs clés :

1. **`anon` `public`** ← **C'est celle-ci que vous cherchez !**
   - ✅ C'est la clé **publique** et **sûre** pour le frontend
   - ✅ Utilisez cette clé pour `VITE_SUPABASE_ANON_KEY`
   - 📋 Copiez la valeur (elle commence par `eyJ...`)

2. **`service_role` `secret`** ← **NE JAMAIS UTILISER DANS LE FRONTEND !**
   - ⚠️ Clé secrète, uniquement pour le backend
   - ⚠️ Ne jamais exposer dans le navigateur

#### Étape 4 : Récupérer aussi l'URL

Dans la même page **Settings → API**, en haut vous verrez :

- **"Project URL"** : `https://ewlozuwvrteopotfizcr.supabase.co`
  - ✅ Utilisez cette valeur pour `VITE_SUPABASE_URL`

---

## 📋 Récapitulatif des Valeurs

### Dans Supabase Dashboard → Settings → API :

| Variable | Nom dans Supabase | Section | Description |
|----------|-------------------|---------|-------------|
| `VITE_SUPABASE_URL` | **Project URL** | En haut de la page | URL de votre projet (ex: `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | **`anon` `public`** | Project API keys | Clé publique (sûre pour le frontend) |

---

## 🔍 Où les Configurer

### 1. Localement (fichier `.env`)

Créez/modifiez le fichier `.env` à la racine du projet :

```bash
VITE_SUPABASE_URL=https://ewlozuwvrteopotfizcr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzMxOTIsImV4cCI6MjA3OTM0OTE5Mn0.7me2IQYMg9NUIpwlHqQJjfGYQl2OHCrUmvcuw8Rl6Ec
```

**⚠️ Important :** Le fichier `.env` est dans `.gitignore` et ne sera **pas** envoyé sur GitHub.

---

### 2. Sur Vercel (pour la production)

1. **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Ajoutez les deux variables :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Cochez **Production**, **Preview**, et **Development**
4. **Sauvegardez**
5. **Redéployez** l'application

---

## 📍 Chemin Exact dans Supabase

```
Supabase Dashboard
  → Votre Projet (ewlozuwvrteopotfizcr)
    → Settings (⚙️ dans le menu gauche)
      → API
        → Project URL (en haut)
        → Project API keys
          → anon public ← VITE_SUPABASE_ANON_KEY
          → service_role secret ← Pour backend uniquement
```

---

## 🔐 Sécurité

### ✅ Clé Anon (publique)
- **Sûre** pour le frontend
- **Visible** dans le code JavaScript
- **Protégée** par Row Level Security (RLS)
- ✅ **Utilisez cette clé** pour `VITE_SUPABASE_ANON_KEY`

### ❌ Clé Service Role (secrète)
- **JAMAIS** dans le frontend
- **Seulement** pour les scripts backend
- **Pouvoirs administrateur** complets
- ⚠️ **Ne jamais exposer** publiquement

---

## 🛠️ Vérification Rapide

### Vérifier que les clés sont correctes

```bash
# Dans le fichier .env, vérifiez que :
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (doit commencer par eyJ)
```

### Tester la connexion

```bash
# Lancer l'application en local
npm run dev

# Ouvrir la console (F12) et vérifier qu'il n'y a pas d'erreur :
# "Missing Supabase environment variables"
```

---

## 🆘 Si vous ne trouvez pas les clés

### Option 1 : Recréer les clés

1. Supabase Dashboard → Settings → API
2. Section **"Project API keys"**
3. Bouton **"Regenerate"** ou **"Reset"** (si disponible)
4. ⚠️ **Attention :** Cela invalidera l'ancienne clé

### Option 2 : Vérifier le projet

1. Vérifiez que vous êtes sur le **bon projet**
2. Le nom du projet devrait être visible en haut du dashboard
3. URL devrait être : `https://xxxxx.supabase.co`

---

## 📸 Capture d'Écran de Référence

Dans Supabase Dashboard → Settings → API, vous devriez voir :

```
┌─────────────────────────────────────────┐
│ Project URL                             │
│ https://xxxxx.supabase.co               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Project API keys                        │
│                                         │
│ anon         public    eyJhbGc...       │ ← VITE_SUPABASE_ANON_KEY
│                                         │
│ service_role secret    eyJhbGc...       │ ← Service Role (backend)
└─────────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] Allé sur https://supabase.com/dashboard
- [ ] Sélectionné le bon projet
- [ ] Allé dans Settings → API
- [ ] Récupéré la "Project URL" → `VITE_SUPABASE_URL`
- [ ] Récupéré la clé "anon public" → `VITE_SUPABASE_ANON_KEY`
- [ ] Ajouté dans `.env` local
- [ ] Ajouté dans Vercel Environment Variables
- [ ] Redéployé après ajout sur Vercel

---

**Besoin d'aide ?** Si vous ne trouvez toujours pas, dites-moi à quelle étape vous bloquez ! 🔧

