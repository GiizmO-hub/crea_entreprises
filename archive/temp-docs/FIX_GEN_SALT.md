# 🔧 Fix: function gen_salt(unknown) does not exist

## ❌ Problème
L'erreur `function gen_salt(unknown) does not exist` apparaît lors de la création d'un espace membre.

## ✅ Solution Appliquée

### 1. Activation de l'extension pgcrypto
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2. Ajout de 'extensions' au search_path
```sql
SET search_path = public, auth, extensions
```

Cela permet à PostgreSQL de trouver la fonction `gen_salt()` dans le schéma `extensions`.

## 📝 Note
La fonction `gen_salt('bf')` est utilisée pour hasher les mots de passe de manière sécurisée. Elle nécessite l'extension `pgcrypto` qui doit être activée dans la base de données.

## 🔄 Prochaine Étape
**APPLIQUER LA MIGRATION** pour activer l'extension et corriger le search_path.




