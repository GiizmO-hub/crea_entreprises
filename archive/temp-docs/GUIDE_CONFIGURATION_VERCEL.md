# 🚀 Guide Configuration Vercel - Variables d'Environnement

## 📋 Variables à Configurer sur Vercel

Une fois votre projet déployé sur Vercel, vous devez configurer les variables d'environnement pour que l'application se connecte à Supabase.

### 🔗 URL de Vercel
Allez sur votre projet Vercel : https://vercel.com/dashboard

---

## 📝 Étapes de Configuration

### 1. Accéder aux Paramètres

1. **Ouvrez votre projet** sur Vercel
2. Cliquez sur **"Settings"** (Paramètres)
3. Cliquez sur **"Environment Variables"** dans le menu de gauche

### 2. Ajouter les Variables

Ajoutez les deux variables suivantes :

#### Variable 1 : `VITE_SUPABASE_URL`
- **Name** : `VITE_SUPABASE_URL`
- **Value** : `https://ewlozuwvrteopotfizcr.supabase.co`
- **Environment** : Cochez toutes les cases :
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### Variable 2 : `VITE_SUPABASE_ANON_KEY`
- **Name** : `VITE_SUPABASE_ANON_KEY`
- **Value** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bG96dXd2cnRlb3BvdGZpemNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NzMxOTIsImV4cCI6MjA3OTM0OTE5Mn0.7me2IQYMg9NUIpwlHqQJjfGYQl2OHCrUmvcuw8Rl6Ec`
- **Environment** : Cochez toutes les cases :
  - ✅ Production
  - ✅ Preview
  - ✅ Development

### 3. Sauvegarder et Redéployer

1. Cliquez sur **"Save"** pour chaque variable
2. Une fois toutes les variables ajoutées, allez dans l'onglet **"Deployments"**
3. Cliquez sur les **3 points** (...) du dernier déploiement
4. Cliquez sur **"Redeploy"**

**OU**

1. Faites un commit et push sur GitHub
2. Vercel redéploiera automatiquement avec les nouvelles variables

---

## ✅ Vérification

Une fois redéployé, vérifiez que :

1. **L'application fonctionne** : Ouvrez votre URL Vercel
2. **La connexion Supabase fonctionne** : Essayez de vous inscrire/connecter
3. **Pas d'erreurs dans la console** : Ouvrez les DevTools (F12)

---

## 🔐 Sécurité

⚠️ **Important** :
- Ne commitez **JAMAIS** le fichier `.env` sur GitHub
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez toujours les variables d'environnement sur Vercel pour la production
- Ne partagez **JAMAIS** votre clé `service_role` (seulement `anon` key)

---

## 📊 Récapitulatif des Variables

| Variable | Valeur | Utilisation |
|----------|--------|-------------|
| `VITE_SUPABASE_URL` | `https://ewlozuwvrteopotfizcr.supabase.co` | URL de votre projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Clé publique (anon) pour l'authentification |

---

## 🆘 Dépannage

### L'application ne se connecte pas à Supabase

1. **Vérifiez les variables** dans Vercel Settings → Environment Variables
2. **Vérifiez que les variables sont bien préfixées par `VITE_`**
3. **Redéployez** l'application après avoir ajouté/modifié les variables
4. **Vérifiez les logs** dans Vercel → Deployments → Voir les logs

### Erreur "Missing Supabase environment variables"

- Les variables ne sont pas configurées ou mal nommées
- Vérifiez que les noms sont exactement : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
- Redéployez après avoir corrigé

### Erreur CORS

- Vérifiez dans Supabase → Settings → API → que les domaines Vercel sont autorisés
- Ajoutez votre domaine Vercel dans les "Allowed Origins"

---

**Besoin d'aide ?** Consultez la documentation Vercel : https://vercel.com/docs/environment-variables





