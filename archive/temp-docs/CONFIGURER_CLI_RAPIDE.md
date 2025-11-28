# 🔐 CONFIGURATION RAPIDE DU CLI SUPABASE

## ⚡ AVEC VOTRE TOKEN

Votre token : `sbp_cde65a8637aa3680b475cc189236b6fec950808d`

---

## 🚀 DÉPLOIEMENT AUTOMATIQUE (RECOMMANDÉ)

### Option 1 : Script automatique

```bash
cd /Users/user/Downloads/cursor
chmod +x scripts/setup-and-deploy.sh
./scripts/setup-and-deploy.sh
```

Ce script va :
1. ✅ Installer Supabase CLI (si nécessaire)
2. ✅ Configurer votre token
3. ✅ Lier le projet
4. ✅ Déployer l'Edge Function

---

## 📋 DÉPLOIEMENT MANUEL

### Étape 1 : Installer Supabase CLI

```bash
sudo npm install -g supabase
```

ou

```bash
brew install supabase/tap/supabase
```

### Étape 2 : Configurer le token

```bash
export SUPABASE_ACCESS_TOKEN=sbp_cde65a8637aa3680b475cc189236b6fec950808d
supabase login --token sbp_cde65a8637aa3680b475cc189236b6fec950808d
```

### Étape 3 : Lier le projet

```bash
cd /Users/user/Downloads/cursor
supabase link --project-ref ewlozuwvrteopotfizcr
```

### Étape 4 : Déployer l'Edge Function

```bash
supabase functions deploy create-stripe-checkout
```

---

## ✅ VÉRIFICATION

Après déploiement :
1. Rafraîchissez votre navigateur (Cmd+R)
2. Testez le paiement par carte
3. L'erreur CORS devrait disparaître !

---

## 🔧 SI PROBLÈME

Vérifiez que le token est bien configuré :

```bash
echo $SUPABASE_ACCESS_TOKEN
```

Si vide, réexportez-le :

```bash
export SUPABASE_ACCESS_TOKEN=sbp_cde65a8637aa3680b475cc189236b6fec950808d
```


