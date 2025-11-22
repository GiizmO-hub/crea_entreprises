# Guide : Vérification du Déploiement Vercel

## 🔍 Vérifications à Faire

### 1. Vérifier que tout est bien poussé sur GitHub

```bash
# Vérifier le dernier commit
git log --oneline -1

# Vérifier que tout est poussé
git status

# Si des fichiers ne sont pas poussés, faire :
git add -A
git commit -m "Message"
git push origin main
```

### 2. Vérifier la Configuration Vercel

#### Dans le Dashboard Vercel :

1. **Aller sur** [vercel.com](https://vercel.com)
2. **Sélectionner votre projet** `crea_entreprises`
3. **Aller dans Settings → Git**
   - ✅ Vérifier que le repository est bien connecté
   - ✅ Vérifier que la branche est `main`

4. **Aller dans Settings → Environment Variables**
   - ✅ `VITE_SUPABASE_URL` doit être définie
   - ✅ `VITE_SUPABASE_ANON_KEY` doit être définie
   - ✅ Vérifier qu'elles sont activées pour **Production**, **Preview**, et **Development**

### 3. Vérifier le Déploiement en Cours

1. **Aller dans l'onglet "Deployments"**
2. **Vérifier le dernier déploiement** :
   - ✅ Statut : "Ready" (vert) ou "Building" (orange)
   - ❌ Si "Error" (rouge), cliquer dessus pour voir les logs

3. **Si le déploiement a échoué** :
   - Cliquer sur "View Function Logs"
   - Identifier l'erreur
   - Voir section "Dépannage" ci-dessous

### 4. Forcer un Nouveau Déploiement

Si les modifications ne remontent pas automatiquement :

1. **Option 1 : Via Dashboard Vercel**
   - Aller dans "Deployments"
   - Cliquer sur "..." sur le dernier déploiement
   - Cliquer sur "Redeploy"

2. **Option 2 : Via Git (recommandé)**
   ```bash
   # Faire un commit vide pour déclencher un nouveau déploiement
   git commit --allow-empty -m "Trigger Vercel redeploy"
   git push origin main
   ```

3. **Option 3 : Via Vercel CLI**
   ```bash
   # Installer Vercel CLI si pas déjà fait
   npm i -g vercel
   
   # Se connecter
   vercel login
   
   # Déployer
   vercel --prod
   ```

## 🐛 Dépannage

### Problème : Build échoue sur Vercel

**Erreur courante : Variables d'environnement manquantes**

**Solution :**
1. Aller dans Settings → Environment Variables
2. Vérifier que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont bien définies
3. Les réajouter si nécessaire :
   - Nom : `VITE_SUPABASE_URL`
   - Valeur : `https://votre-projet.supabase.co`
   - Environnements : Production, Preview, Development ✅
   - Cliquer sur "Save"
4. Redéployer

**Erreur courante : Module not found**

**Solution :**
1. Vérifier que toutes les dépendances sont dans `package.json`
2. Vérifier que le build fonctionne localement : `npm run build`
3. Si erreur locale, corriger avant de pousser sur GitHub

**Erreur courante : TypeScript errors**

**Solution :**
1. Vérifier localement : `npm run typecheck`
2. Corriger les erreurs TypeScript
3. Pousser les corrections sur GitHub

### Problème : Déploiement réussi mais site ne fonctionne pas

**Vérifier :**
1. **Les variables d'environnement sont bien présentes** dans le build :
   - Ouvrir la console du navigateur sur Vercel
   - Vérifier qu'il n'y a pas d'erreur "Missing Supabase environment variables"

2. **Le routing fonctionne** :
   - Aller sur `https://votre-projet.vercel.app`
   - Vérifier que la page se charge
   - Essayer de naviguer entre les pages

3. **La connexion Supabase fonctionne** :
   - Essayer de se connecter
   - Vérifier dans la console du navigateur qu'il n'y a pas d'erreur API

### Problème : Les modifications ne remontent pas

**Solution :**
1. **Vérifier que le commit est bien sur GitHub** :
   - Aller sur [github.com/GiizmO-hub/crea_entreprises](https://github.com/GiizmO-hub/crea_entreprises)
   - Vérifier que votre dernier commit est visible

2. **Vérifier les webhooks Vercel** :
   - Aller dans Settings → Git → Webhooks
   - Vérifier que les webhooks GitHub sont bien configurés

3. **Forcer un redéploiement** (voir section ci-dessus)

## ✅ Checklist de Vérification Complète

- [ ] Tous les fichiers sont poussés sur GitHub
- [ ] Le build fonctionne localement (`npm run build`)
- [ ] Les variables d'environnement sont définies sur Vercel
- [ ] Le dernier déploiement est en statut "Ready" ou "Building"
- [ ] Le site est accessible sur l'URL Vercel
- [ ] La connexion Supabase fonctionne
- [ ] Les pages se chargent correctement
- [ ] Le routing SPA fonctionne (navigation entre pages)

## 📊 Vérification Rapide

Pour une vérification rapide, ouvrir la console du navigateur sur votre site Vercel et vérifier :

```javascript
// Dans la console du navigateur
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Présent' : '❌ Manquant');
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Présent' : '❌ Manquant');
```

Si les deux sont présents, le problème n'est pas lié aux variables d'environnement.

## 🆘 Si Rien ne Fonctionne

1. **Vérifier les logs Vercel** :
   - Aller dans "Deployments"
   - Cliquer sur le dernier déploiement
   - Regarder les "Build Logs" et "Function Logs"

2. **Créer un ticket de support Vercel** :
   - Avec les logs d'erreur
   - Avec l'URL du déploiement qui échoue

3. **Vérifier le statut Vercel** :
   - Aller sur [status.vercel.com](https://status.vercel.com)
   - Vérifier s'il y a des problèmes connus

