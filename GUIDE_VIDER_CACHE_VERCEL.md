# 🗑️ Guide : Vider le Cache sur Vercel

## Méthode 1 : Via le Dashboard Vercel (Recommandé)

### Étapes :

1. **Accéder au projet Vercel**
   - Va sur [vercel.com](https://vercel.com)
   - Connecte-toi à ton compte
   - Sélectionne le projet `crea-entreprises` ou `giizmo-os-projects/crea-entreprises`

2. **Aller dans les Déploiements**
   - Clique sur l'onglet **"Deployments"** (Déploiements) dans le menu latéral

3. **Redéployer avec cache vidé**
   - Trouve le dernier déploiement (celui qui a échoué)
   - Clique sur les **trois points** (⋯) à droite du déploiement
   - Sélectionne **"Redeploy"** (Redéployer)
   - **IMPORTANT** : Coche la case **"Use existing Build Cache"** pour la DÉCOCHER
   - Clique sur **"Redeploy"**

4. **Alternative : Redéployer depuis GitHub**
   - Va dans **Settings** → **Git**
   - Clique sur **"Redeploy"** sur le dernier commit
   - Décoche **"Use existing Build Cache"**

---

## Méthode 2 : Via la CLI Vercel

### Prérequis :
```bash
# Installer Vercel CLI si pas déjà fait
npm i -g vercel
```

### Commandes :

```bash
# 1. Se connecter à Vercel
vercel login

# 2. Aller dans le dossier du projet
cd /Users/user/Downloads/cursor

# 3. Redéployer en vidant le cache
vercel --force

# Ou pour un déploiement de production
vercel --prod --force
```

---

## Méthode 3 : Forcer un nouveau build via Git

### Créer un commit vide pour forcer un nouveau build :

```bash
cd /Users/user/Downloads/cursor

# Créer un commit vide
git commit --allow-empty -m "chore: Force rebuild - clear cache"

# Pousser vers GitHub
git push origin main
```

Vercel détectera automatiquement le nouveau commit et déclenchera un nouveau build.

---

## Méthode 4 : Vider le cache via les Variables d'Environnement

### Si le problème persiste :

1. **Dashboard Vercel** → **Settings** → **Environment Variables**
2. **Modifier une variable** (ajouter un espace puis le retirer)
3. **Sauvegarder** → Cela déclenchera un nouveau build

---

## ⚠️ Vérifications à faire avant de vider le cache

1. ✅ **Vérifier que le build local fonctionne**
   ```bash
   npm run build
   ```

2. ✅ **Vérifier que les fichiers sont bien commités**
   ```bash
   git status
   ```

3. ✅ **Vérifier que les fichiers sont bien poussés sur GitHub**
   ```bash
   git log --oneline -5
   ```

---

## 🔍 Diagnostic des erreurs de duplication

Si les erreurs persistent après avoir vidé le cache :

1. **Vérifier les logs de build Vercel**
   - Dashboard → Deployments → Clique sur le déploiement
   - Onglet **"Build Logs"** ou **"bûches"**

2. **Vérifier les numéros de ligne mentionnés dans les erreurs**
   - Les erreurs indiquent les lignes exactes avec les duplications
   - Comparer avec les fichiers locaux

3. **Vérifier s'il y a des différences entre local et GitHub**
   ```bash
   git diff HEAD origin/main
   ```

---

## 📝 Notes importantes

- **Le cache Vercel** est utilisé pour accélérer les builds
- **Vider le cache** peut ralentir le build mais résout souvent les problèmes
- **Les erreurs de duplication** peuvent être causées par :
  - Cache corrompu
  - Différences entre versions locales et distantes
  - Problèmes de merge/conflicts non résolus

---

## ✅ Solution rapide recommandée

**Pour ton cas spécifique** (erreurs de duplication) :

1. Va sur le Dashboard Vercel
2. Trouve le dernier déploiement qui a échoué
3. Clique sur **"Redeploy"** avec **"Use existing Build Cache"** DÉCOCHÉ
4. Attends la fin du build

Si ça ne fonctionne toujours pas, utilise la **Méthode 3** (commit vide) pour forcer un nouveau build complet.

