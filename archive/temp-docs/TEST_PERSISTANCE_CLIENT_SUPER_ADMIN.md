# Test de Persistance du Rôle Client Super Admin

## Problème
Le statut `client_super_admin` ne persistait pas après déconnexion/reconnexion du client.

## Solution Appliquée
Correction définitive de la fonction `create_espace_membre_from_client` pour **PRÉSERVER ABSOLUMENT** le rôle `client_super_admin` existant.

### Règle Critique
```sql
-- Si le rôle existant est client_super_admin, NE JAMAIS le modifier
role = CASE 
  WHEN utilisateurs.role = 'client_super_admin' THEN 'client_super_admin' -- ✅ PRÉSERVER
  ELSE COALESCE(v_final_role, utilisateurs.role) -- Sinon utiliser le rôle calculé
END
```

## Test à Effectuer

### 1. Activer le statut super_admin
- Aller dans "Gestion des clients" → "Administration Super Admin"
- Trouver le client concerné
- Cliquer sur "Définir Super Admin"
- ✅ Le bouton devrait devenir "Retirer Super Admin"

### 2. Vérifier dans la base de données
```sql
SELECT u.id, u.email, u.role 
FROM utilisateurs u
JOIN espaces_membres_clients emc ON emc.user_id = u.id
JOIN clients c ON c.id = emc.client_id
WHERE c.email = 'EMAIL_DU_CLIENT';
```
✅ Le rôle devrait être `client_super_admin`

### 3. Se connecter en tant que client
- Se déconnecter de votre session admin
- Se connecter avec les identifiants du client
- ✅ Le badge "Super Admin" devrait apparaître dans la sidebar (en bas, sous l'email)

### 4. Se déconnecter et se reconnecter
- Se déconnecter du compte client
- Se reconnecter avec les mêmes identifiants
- ✅ Le badge "Super Admin" devrait TOUJOURS être présent

### 5. Vérifier à nouveau dans la base
```sql
SELECT u.id, u.email, u.role, u.updated_at
FROM utilisateurs u
JOIN espaces_membres_clients emc ON emc.user_id = u.id
JOIN clients c ON c.id = emc.client_id
WHERE c.email = 'EMAIL_DU_CLIENT';
```
✅ Le rôle devrait TOUJOURS être `client_super_admin`

## Script de Diagnostic
```bash
node scripts/debug-client-super-admin.js EMAIL_DU_CLIENT
```

## Si le Problème Persiste
1. Vérifier les logs de la base de données pour voir si `create_espace_membre_from_client` est appelée
2. Vérifier si d'autres fonctions modifient le rôle dans `utilisateurs`
3. Utiliser le script de test : `node scripts/test-client-super-admin-persistence.js EMAIL_DU_CLIENT`




