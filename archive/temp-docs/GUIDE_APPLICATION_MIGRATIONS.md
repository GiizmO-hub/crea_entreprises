# Guide : Application des Migrations SQL - Version Consolidée

## ✅ Nouveau Système Simplifié

Toutes les migrations ont été **consolidées** dans le schéma initial. Vous n'avez plus besoin d'appliquer plusieurs migrations séparément !

## 📋 Ordre d'Application Simplifié

### 1. Schéma Initial (TOUT EN UN)
```sql
supabase/migrations/20250122000000_initial_schema.sql
```

**Cette migration contient maintenant :**
- ✅ Toutes les tables (24 tables)
- ✅ Table `utilisateurs` avec toutes les politiques RLS
- ✅ Table `abonnements` avec colonne `mode_paiement`
- ✅ Extension `pgcrypto` activée
- ✅ Fonction `create_super_admin()` pour promouvoir un utilisateur
- ✅ Fonction `create_espace_membre_from_client()` pour créer un espace membre
- ✅ Fonction `get_client_credentials()` pour récupérer les identifiants
- ✅ Tous les index et politiques RLS
- ✅ Tous les triggers

### 2. Données Initiales
```sql
supabase/migrations/20250122000001_insert_initial_data.sql
```

**Contient :**
- Plans d'abonnement (Starter, Business, Professional, Enterprise)
- Options supplémentaires (modules)

### 3. C'est tout ! 🎉

Vous n'avez besoin que de ces 2 fichiers pour avoir un système complet et fonctionnel.

## 🚀 Étapes d'Application

### Étape 1 : Ouvrir Supabase SQL Editor

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **SQL Editor** → **New Query**

### Étape 2 : Appliquer le Schéma Initial

1. Ouvrir le fichier : `supabase/migrations/20250122000000_initial_schema.sql`
2. **Copier TOUT le contenu** du fichier
3. **Coller** dans le SQL Editor de Supabase
4. Cliquer sur **Run** (ou Ctrl+Enter / Cmd+Enter)
5. Attendre que la migration se termine (peut prendre 30-60 secondes)

### Étape 3 : Insérer les Données Initiales

1. Ouvrir le fichier : `supabase/migrations/20250122000001_insert_initial_data.sql`
2. **Copier TOUT le contenu** du fichier
3. **Coller** dans le SQL Editor de Supabase
4. Cliquer sur **Run**

### Étape 4 : Vérification

Vérifier que tout est correct :

```sql
-- Vérifier l'extension pgcrypto
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- Vérifier les plans d'abonnement
SELECT nom, prix_mensuel FROM plans_abonnement WHERE actif = true;

-- Vérifier les options
SELECT nom, prix_mensuel FROM options_supplementaires WHERE actif = true;

-- Vérifier la table utilisateurs
SELECT COUNT(*) FROM utilisateurs;

-- Vérifier la fonction create_espace_membre_from_client
SELECT proname FROM pg_proc WHERE proname = 'create_espace_membre_from_client';
```

## 📝 Notes Importantes

### Migrations Plus Anciennes (Non Nécessaires)

Les migrations suivantes sont **déjà incluses** dans le schéma initial et **ne doivent PAS être appliquées séparément** :

- ❌ `20250122000002_create_super_admin.sql` → **Déjà dans le schéma initial**
- ❌ `20250122000003_create_utilisateurs_table.sql` → **Déjà dans le schéma initial**
- ❌ `20250122000004_create_client_abonnement_auto.sql` → Fonction non utilisée
- ❌ `20250122000005_create_espace_membre_from_client.sql` → **Déjà dans le schéma initial**
- ❌ `20250122000006_fix_pgcrypto_extension.sql` → **Déjà dans le schéma initial**
- ❌ `20250122000007_create_abonnements_table.sql` → **Déjà dans le schéma initial**

### Avantages du Système Consolidé

✅ **Un seul fichier** à appliquer pour le schéma  
✅ **Pas d'erreurs** de dépendances entre migrations  
✅ **Schéma complet** dès le départ  
✅ **Plus rapide** à appliquer  
✅ **Plus facile** à maintenir  

## 🔧 Création d'un Super Admin

Après avoir appliqué le schéma :

1. Créer un compte utilisateur normal dans l'application
2. Aller dans Supabase SQL Editor
3. Exécuter :

```sql
SELECT create_super_admin('votre-email@exemple.com');
```

Remplacer `'votre-email@exemple.com'` par l'email du compte que vous voulez promouvoir.

## ✅ Checklist d'Application

- [ ] Schéma initial appliqué (`20250122000000_initial_schema.sql`)
- [ ] Données initiales insérées (`20250122000001_insert_initial_data.sql`)
- [ ] Extension `pgcrypto` vérifiée
- [ ] Plans d'abonnement vérifiés (4 plans)
- [ ] Options supplémentaires vérifiées (8 options)
- [ ] Fonction `create_espace_membre_from_client` vérifiée
- [ ] Super admin créé (optionnel)

## 🐛 En Cas de Problème

### Erreur : "relation already exists"

Cela signifie qu'une table existe déjà. Vous pouvez :
- Supprimer manuellement les tables existantes
- Ou créer un nouveau projet Supabase

### Erreur : "extension pgcrypto does not exist"

Exécuter manuellement :
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Erreur : "permission denied for schema extensions"

Cela peut arriver avec certains comptes Supabase. La fonction utilise déjà `extensions.crypt` et `extensions.gen_salt` qui devraient fonctionner avec l'extension activée.

## 📞 Support

Si vous rencontrez des problèmes, vérifiez :
1. Que le schéma initial a été appliqué complètement
2. Que les données initiales ont été insérées
3. Les logs d'erreur dans Supabase SQL Editor




