# Guide : Table Collaborateurs avec Création Automatique

## 📋 Vue d'ensemble

Une nouvelle table `collaborateurs` a été créée avec une fonction RPC `create_collaborateur` qui automatise complètement la création d'un collaborateur.

## 🎯 Fonctionnalités

### Table `collaborateurs`
- Gestion dédiée des collaborateurs avec différents rôles
- Rôles disponibles : `collaborateur`, `admin`, `manager`, `comptable`, `commercial`, `super_admin`
- Champs supplémentaires : département, poste, date d'embauche, salaire

### Fonction `create_collaborateur()`
**Création automatique en une seule opération :**
1. ✅ Crée l'utilisateur dans `auth.users` (avec mot de passe crypté)
2. ✅ Crée l'entrée dans `utilisateurs` (synchronisation)
3. ✅ Crée l'entrée dans `collaborateurs` (détails spécifiques)

### Fonction `delete_collaborateur_complete()`
**Suppression complète en une seule opération :**
1. ✅ Supprime de `collaborateurs`
2. ✅ Supprime de `utilisateurs`
3. ✅ Supprime de `auth.users`

## 🚀 Application de la Migration

### Étape 1 : Appliquer la migration SQL

1. Ouvrez votre projet Supabase
2. Allez dans **SQL Editor**
3. Ouvrez le fichier : `supabase/migrations/20250122000011_create_collaborateurs_table.sql`
4. Copiez tout le contenu
5. Collez dans l'éditeur SQL de Supabase
6. Cliquez sur **Run** (ou appuyez sur `Cmd/Ctrl + Enter`)

### Étape 2 : Vérifier la création

Exécutez cette requête pour vérifier que la table existe :

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'collaborateurs';
```

Vérifiez que la fonction existe :

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'create_collaborateur';
```

## 📝 Utilisation dans l'Application

### Créer un collaborateur

Dans la page **Collaborateurs**, le formulaire utilise automatiquement la fonction `create_collaborateur` :

1. Remplissez le formulaire :
   - Email (obligatoire)
   - Mot de passe (obligatoire)
   - Nom, Prénom, Téléphone
   - Rôle (collaborateur, admin, manager, comptable, commercial, super_admin)
   - Entreprise (optionnel)
   - Département, Poste (optionnels)
   - Date d'embauche, Salaire (optionnels)

2. Cliquez sur **Créer le Collaborateur**

3. ✅ Tout est créé automatiquement !

### Supprimer un collaborateur

1. Cliquez sur **Supprimer** sur la carte du collaborateur
2. Confirmez la suppression
3. ✅ Tout est supprimé automatiquement (auth.users, utilisateurs, collaborateurs)

## 🔒 Sécurité

- Seuls les **super_admin** peuvent créer/supprimer des collaborateurs
- Les politiques RLS sont activées
- Les mots de passe sont cryptés avec `pgcrypto`
- Les erreurs sont gérées avec rollback automatique

## 🧪 Test de la Fonction

Vous pouvez tester directement dans Supabase SQL Editor :

```sql
-- Test de création (remplacez les valeurs)
SELECT create_collaborateur(
  p_email := 'test@example.com',
  p_password := 'MotDePasse123!',
  p_nom := 'Dupont',
  p_prenom := 'Jean',
  p_telephone := '+33 6 12 34 56 78',
  p_role := 'collaborateur',
  p_entreprise_id := NULL, -- ou un UUID d'entreprise
  p_departement := 'IT',
  p_poste := 'Développeur',
  p_date_embauche := '2024-01-01',
  p_salaire := 50000.00
);
```

Le résultat devrait être :
```json
{
  "success": true,
  "message": "Collaborateur créé avec succès",
  "user_id": "...",
  "collaborateur_id": "...",
  "email": "test@example.com",
  "role": "collaborateur"
}
```

## ⚠️ Notes Importantes

1. **Instance ID** : La fonction récupère automatiquement l'instance_id de Supabase
2. **Rollback** : En cas d'erreur, tout est automatiquement annulé
3. **Unicité** : L'email doit être unique dans `auth.users`
4. **Cascade** : La suppression dans `auth.users` supprime automatiquement les entrées liées

## 🐛 Dépannage

### Erreur : "function does not exist"
- Vérifiez que la migration a bien été appliquée
- Vérifiez que vous êtes connecté en tant que super_admin

### Erreur : "email already exists"
- L'email est déjà utilisé
- Utilisez un autre email ou supprimez d'abord l'utilisateur existant

### Erreur : "Seuls les super_admin peuvent créer"
- Vérifiez que votre compte a le rôle `super_admin` dans la table `utilisateurs`

