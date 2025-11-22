# Guide : Application Automatique des Migrations SQL

## 🎯 Objectif

Ce guide explique comment appliquer automatiquement toutes les migrations SQL dans Supabase, sans avoir à les copier-coller manuellement dans le SQL Editor.

## 📋 Prérequis

### 1. Installer la dépendance PostgreSQL

```bash
npm install pg --save-dev
```

### 2. Configurer les variables d'environnement

Ajoutez dans votre fichier `.env` l'URL de connexion PostgreSQL de Supabase :

**Option 1 (Recommandé) :**
```env
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

**Option 2 :**
```env
SUPABASE_DB_HOST=db.xxxxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=[PASSWORD]
```

## 🔍 Où trouver ces informations ?

1. **Allez sur** [Supabase Dashboard](https://supabase.com/dashboard)
2. **Sélectionnez votre projet**
3. **Allez dans** Settings → Database
4. **Copiez la "Connection string"**
   - Utilisez le mode **"Session mode"** ou **"Transaction mode"**
   - Remplacez `[YOUR-PASSWORD]` par votre mot de passe de base de données

⚠️ **Important** : Ne partagez JAMAIS ces informations publiquement (ne les commitez pas sur GitHub) !

## 🚀 Utilisation

### Appliquer toutes les migrations

```bash
npm run db:apply-migrations
```

### Ce que fait le script :

1. ✅ Se connecte à PostgreSQL de Supabase
2. ✅ Lit tous les fichiers SQL dans `supabase/migrations/`
3. ✅ Vérifie quelles migrations ont déjà été appliquées
4. ✅ Applique uniquement les nouvelles migrations dans l'ordre
5. ✅ Enregistre chaque migration comme appliquée

### Exemple de sortie

```
🚀 Application automatique des migrations SQL

📡 Connexion à Supabase PostgreSQL...
✅ Connecté à la base de données

📊 Migrations déjà appliquées: 0
📁 Fichiers de migration trouvés: 4

🔄 4 migration(s) à appliquer:

   - 20250122000011_create_collaborateurs_table
   - 20250122000012_fix_utilisateurs_roles
   - 20250122000013_fix_utilisateurs_rls_recursion
   - 20250122000014_fix_collaborateurs_rls_permissions

🔄 Application de la migration: 20250122000011_create_collaborateurs_table
✅ Migration 20250122000011_create_collaborateurs_table appliquée avec succès

...

✅ 4 migration(s) appliquée(s) avec succès!

🎉 Toutes les migrations ont été appliquées!
```

## 🔒 Sécurité

Le script utilise une connexion PostgreSQL directe, donc :

- ✅ Les migrations sont exécutées dans une transaction (rollback automatique en cas d'erreur)
- ✅ Chaque migration est enregistrée pour éviter les doublons
- ✅ Les erreurs sont détectées et la migration échouée est annulée

## 📝 Suivi des migrations

Le script crée automatiquement une table `schema_migrations` dans votre base de données pour suivre quelles migrations ont été appliquées :

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

## 🐛 Dépannage

### Erreur : "Cannot find module 'pg'"

**Solution** :
```bash
npm install pg --save-dev
```

### Erreur : "connection refused" ou "timeout"

**Solutions** :
1. Vérifiez que l'URL de connexion est correcte
2. Vérifiez que le mot de passe est correct
3. Vérifiez que votre IP n'est pas bloquée dans Supabase Settings → Database → Connection Pooling

### Erreur : "password authentication failed"

**Solution** : Vérifiez que le mot de passe dans `.env` est correct (pas de guillemets ou espaces)

### Erreur : "relation already exists"

**Solution** : La migration a déjà été appliquée manuellement. Le script va la marquer comme appliquée lors de la prochaine exécution.

## ⚡ Avantages

- ✅ **Automatique** : Plus besoin de copier-coller manuellement
- ✅ **Idempotent** : Les migrations déjà appliquées sont ignorées
- ✅ **Sécurisé** : Transactions avec rollback en cas d'erreur
- ✅ **Traçable** : Historique de toutes les migrations appliquées
- ✅ **Rapide** : Application en une seule commande

## 🔄 Workflow Recommandé

1. **Créer une nouvelle migration** :
   ```bash
   # Créer le fichier dans supabase/migrations/
   touch supabase/migrations/20250122000015_ma_migration.sql
   ```

2. **Écrire la migration** dans le fichier SQL

3. **Appliquer automatiquement** :
   ```bash
   npm run db:apply-migrations
   ```

4. **Vérifier** que tout fonctionne dans l'application

5. **Committer** le fichier de migration sur GitHub

## 🎉 C'est tout !

Vous pouvez maintenant appliquer toutes vos migrations automatiquement ! 🚀

