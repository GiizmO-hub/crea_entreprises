# ⚡ DÉSACTIVER JWT - GUIDE RAPIDE

## 🎯 Objectif

Désactiver la vérification JWT pour `stripe-webhooks` dans Supabase Dashboard.

---

## 📋 ÉTAPES SIMPLES

### 1️⃣ Ouvrir Supabase Dashboard

```
https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr
```

### 2️⃣ Aller dans Edge Functions

Menu gauche → **"Edge Functions"**

### 3️⃣ Cliquer sur `stripe-webhooks`

Dans la liste des fonctions, cliquer sur **`stripe-webhooks`**

### 4️⃣ Désactiver "Verify JWT"

**Chercher et désactiver :**
- Switch "Verify JWT" → **OFF**
- OU Switch "Public Access" → **ON**

### 5️⃣ Sauvegarder

Cliquer sur **"Save"** ou **"Update"**

---

## ✅ VÉRIFICATION RAPIDE

**Tester cette URL :**
```
https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
```

**Résultat :**
- ❌ **Avant :** `{"code":401,"message":"En-tête d'autorisation manquant"}`
- ✅ **Après :** Autre erreur ou message différent (pas de 401)

---

## 🆘 SI VOUS NE TROUVEZ PAS L'OPTION

1. Chercher dans **"Settings"** ou **"Configuration"**
2. Chercher dans **"Permissions"** ou **"Autorisations"**
3. Cliquer sur **"..."** (trois points) à côté du nom

---

**📄 Guide détaillé :** `GUIDE_DESACTIVER_JWT_ETAPES.md`

