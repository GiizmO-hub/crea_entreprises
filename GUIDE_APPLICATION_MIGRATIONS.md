# 🚀 Guide d'Application des Migrations

## ⚡ Méthode Rapide (Recommandée - 2 minutes)

### Étape 1: Ouvrir Supabase SQL Editor
1. Allez sur: https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
2. Connectez-vous si nécessaire

### Étape 2: Copier le SQL
1. Dans Cursor, ouvrez le fichier: `APPLY_FIX_CLIENTS_RLS_NOW.sql`
2. Sélectionnez tout le contenu (Cmd+A ou Ctrl+A)
3. Copiez (Cmd+C ou Ctrl+C)

### Étape 3: Appliquer
1. Collez dans l'éditeur SQL Supabase (Cmd+V ou Ctrl+V)
2. Cliquez sur **"Run"** (ou appuyez sur Cmd+Enter / Ctrl+Enter)
3. ✅ La migration est appliquée !

---

## 🔧 Méthode Automatique (Si DATABASE_URL configuré)

### Configuration requise
1. Obtenez la connection string PostgreSQL:
   - Supabase Dashboard → Settings → Database
   - Scroll jusqu'à "Connection string"
   - Sélectionnez **"URI"** (pas "Connection pooling")
   - Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

2. Ajoutez dans `.env.local`:
   ```bash
   DATABASE_URL=postgresql://postgres:votre_mot_de_passe@db.xxxxx.supabase.co:5432/postgres
   ```

3. Exécutez:
   ```bash
   node scripts/apply-all-migrations-auto.mjs
   ```

---

## 📋 Migrations à Appliquer

### Migration actuelle:
- **APPLY_FIX_CLIENTS_RLS_NOW.sql** - Fix RLS pour permettre aux clients de voir uniquement leur propre client

### Migrations futures:
Les migrations dans `supabase/migrations/` seront appliquées automatiquement lors des déploiements via Supabase CLI.

---

## ✅ Vérification

Après application, vérifiez que:
1. Les fonctions sont créées:
   - `user_owns_entreprise()`
   - `user_is_client()`
   - `get_user_client_id()`

2. Les politiques RLS sont mises à jour:
   - `Users can view clients`
   - `Users can insert clients`
   - `Users can update clients`
   - `Users can delete clients`

3. Testez avec un compte client:
   - Il ne devrait voir que son propre client
   - Il ne devrait pas pouvoir créer de clients

---

## 🆘 En cas d'erreur

Si vous obtenez une erreur lors de l'application:
1. Vérifiez que vous êtes connecté à Supabase
2. Vérifiez que vous avez les permissions nécessaires
3. Regardez les messages d'erreur dans la console Supabase
4. Les erreurs "already exists" sont normales (migration déjà appliquée)

