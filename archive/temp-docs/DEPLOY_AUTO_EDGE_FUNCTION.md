# 🚀 DÉPLOIEMENT AUTOMATIQUE - Edge Function create-stripe-checkout

**Méthodologie :** CRÉER → TESTER → CORRIGER → RE-TESTER → BUILD

---

## ⚡ DÉPLOIEMENT EN 3 ÉTAPES

### ÉTAPE 1 : Installer Supabase CLI

**Option A : Via npm (nécessite sudo)**
```bash
sudo npm install -g supabase
```

**Option B : Via Homebrew (macOS)**
```bash
brew install supabase/tap/supabase
```

**Vérifier l'installation :**
```bash
supabase --version
```

---

### ÉTAPE 2 : Se connecter et lier le projet

```bash
cd /Users/user/Downloads/cursor

# 1. Se connecter à Supabase
supabase login

# 2. Lier le projet (project ref extrait automatiquement depuis .env)
supabase link --project-ref ewlozuwvrteopotfizcr
```

**Si vous ne connaissez pas votre project ref :**
- Allez dans Supabase Dashboard → Settings → General
- Le project ref est dans l'URL : `https://[PROJECT_REF].supabase.co`

---

### ÉTAPE 3 : Déployer l'Edge Function

```bash
cd /Users/user/Downloads/cursor
supabase functions deploy create-stripe-checkout
```

**✅ Si succès, vous verrez :**
```
Deploying function create-stripe-checkout...
Function create-stripe-checkout deployed successfully
```

---

## 🔐 CONFIGURATION DES SECRETS (OBLIGATOIRE)

**Après le déploiement, configurez les secrets :**

1. **Allez dans Supabase Dashboard**
   - Settings → Edge Functions → Secrets

2. **Ajoutez ces secrets :**
   - **Nom :** `STRIPE_SECRET_KEY`
   - **Valeur :** `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
   
   - **Nom :** `STRIPE_WEBHOOK_SECRET`
   - **Valeur :** `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`

3. **⚠️ IMPORTANT : Redéployez après avoir ajouté les secrets !**
   ```bash
   supabase functions deploy create-stripe-checkout
   ```

---

## ✅ VÉRIFICATION

### Test 1 : Vérifier dans Dashboard
- Allez dans **Edge Functions**
- Vous devriez voir `create-stripe-checkout` dans la liste

### Test 2 : Tester dans le navigateur
1. Rafraîchissez votre navigateur (Cmd+R)
2. Créez une entreprise
3. Cliquez sur "Payer par carte bancaire"
4. L'erreur CORS devrait disparaître
5. Vous devriez être redirigé vers Stripe Checkout

---

## 🐛 SI L'ERREUR PERSISTE

### Vérifier les logs
- Supabase Dashboard → Edge Functions → `create-stripe-checkout` → **Logs**
- Regardez les erreurs récentes

### Vérifier les secrets
- Settings → Edge Functions → Secrets
- Vérifiez que `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont bien présents

### Vérifier le déploiement
```bash
supabase functions list
```
Vous devriez voir `create-stripe-checkout` dans la liste

---

## 📝 COMMANDES RAPIDES

```bash
# Vérifier la version
supabase --version

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref ewlozuwvrteopotfizcr

# Déployer
supabase functions deploy create-stripe-checkout

# Voir les logs
supabase functions logs create-stripe-checkout

# Lister les fonctions déployées
supabase functions list
```

---

## 🎯 RÉSUMÉ RAPIDE

```bash
# 1. Installer (si pas déjà fait)
sudo npm install -g supabase

# 2. Se connecter
supabase login

# 3. Lier le projet
supabase link --project-ref ewlozuwvrteopotfizcr

# 4. Déployer
supabase functions deploy create-stripe-checkout

# 5. Configurer les secrets dans Dashboard
# 6. Redéployer
supabase functions deploy create-stripe-checkout

# 7. Tester dans le navigateur !
```

---

## ⚠️ NOTES IMPORTANTES

1. **Les secrets sont différents des variables d'environnement**
   - Ils sont dans **Supabase Dashboard → Settings → Edge Functions → Secrets**
   - PAS dans le fichier `.env`

2. **Redéployer après modification des secrets**
   - Les secrets nécessitent un redéploiement
   - Utilisez : `supabase functions deploy create-stripe-checkout`

3. **L'Edge Function doit être déployée pour fonctionner**
   - Elle n'existe pas localement pour le navigateur
   - Elle doit être sur les serveurs Supabase


