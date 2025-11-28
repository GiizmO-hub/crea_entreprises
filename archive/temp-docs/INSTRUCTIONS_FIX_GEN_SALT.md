# 🔴 FIX URGENT - Erreur gen_salt

## ❌ Erreur Actuelle
```
function gen_salt(unknown) does not exist
```

## ✅ Solution

### Option 1 - Script Automatique (RECOMMANDÉ)

```bash
node scripts/apply-fix-gen-salt.js
```

**Prérequis:** Ajoutez dans votre `.env`:
```
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

### Option 2 - Manuel (Supabase Dashboard)

1. Ouvrez **Supabase Dashboard**
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu de:
   ```
   supabase/migrations/20250122000091_fix_all_gen_salt_functions.sql
   ```
4. Cliquez sur **Run**

## 📋 Ce que fait la migration

1. ✅ Active l'extension `pgcrypto` (OBLIGATOIRE)
2. ✅ Corrige la fonction `create_espace_membre_from_client_unified`
3. ✅ Ajoute `extensions` au `search_path`

## 🎯 Après application

Testez la création d'espace membre dans **Paramètres** → Cliquez sur **"Créer"** pour un client.

L'erreur devrait être résolue! ✅




