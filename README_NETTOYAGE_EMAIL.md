# 🧹 Nettoyage des Emails - Guide

## Problème

Des emails persistent dans la base de données même après suppression de clients/collaborateurs, permettant encore de se connecter.

## Solutions

### 1. Diagnostic d'un Email

Pour trouver où un email est utilisé dans la base de données :

```bash
node scripts/diagnostic-email.js <email>
```

**Exemple:**
```bash
node scripts/diagnostic-email.js groupemclem@gmail.com
```

Cela affichera toutes les tables où l'email est présent :
- `auth.users`
- `clients`
- `collaborateurs`
- `espaces_membres_clients`
- `utilisateurs`
- `entreprises`

### 2. Nettoyage Complet d'un Email

Pour supprimer complètement un email de TOUTES les tables :

```bash
node scripts/cleanup-email.js <email>
```

**Exemple:**
```bash
node scripts/cleanup-email.js groupemclem@gmail.com
```

⚠️ **ATTENTION:** Cette opération est irréversible ! L'email sera supprimé de toutes les tables.

### 3. Fonctions RPC Disponibles

#### `diagnostic_email(p_email text)`

Retourne un JSON avec toutes les occurrences d'un email :

```sql
SELECT diagnostic_email('user@example.com');
```

#### `cleanup_email_complete(p_email text)`

Supprime complètement un email de toutes les tables (accessible uniquement par admin) :

```sql
SELECT cleanup_email_complete('user@example.com');
```

### 4. Protection Automatique

Des triggers ont été mis en place pour automatiquement supprimer les `auth.users` lorsque :

- Un client est supprimé → `trigger_delete_client_auth_user`
- Un collaborateur est supprimé → `trigger_delete_collaborateur_auth_user`

⚠️ **Les super admin PLATEFORME sont protégés** - leurs emails ne seront jamais supprimés automatiquement.

## Utilisation dans le Code

Vous pouvez aussi utiliser ces fonctions depuis le frontend si vous êtes super admin :

```typescript
// Diagnostic
const { data } = await supabase.rpc('diagnostic_email', {
  p_email: 'user@example.com'
});

// Nettoyage (nécessite d'être admin)
const { data } = await supabase.rpc('cleanup_email_complete', {
  p_email: 'user@example.com'
});
```

## Notes Importantes

- Les super admin PLATEFORME sont toujours protégés
- Le nettoyage est une opération irréversible
- Les triggers automatiques fonctionnent pour toutes les futures suppressions
- Pour les emails déjà orphelins, utilisez `cleanup_email_complete()`

