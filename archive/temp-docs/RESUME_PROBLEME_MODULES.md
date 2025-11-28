# Résumé du Problème des Modules et Solutions

## 🔍 Problème Identifié

Les modules inclus dans un plan d'abonnement ne s'affichent pas dans l'espace client.

## 📋 Architecture Actuelle

### 1. Tables et Relations
- **`plans_modules`** : Modules inclus dans chaque plan (`plan_id`, `module_code`, `inclus`)
- **`abonnements`** : Abonnements clients (`plan_id`, `entreprise_id`, `statut`)
- **`espaces_membres_clients`** : Espaces clients (`abonnement_id`, `modules_actifs` JSONB)

### 2. Flux de Synchronisation
1. Création abonnement → Doit lier `abonnement_id` à `espaces_membres_clients`
2. Synchronisation modules → Doit copier modules du plan vers `modules_actifs`
3. Affichage → Layout.tsx lit `modules_actifs` et mappe vers les IDs de menu

## ❌ Problèmes Identifiés

### Problème 1: Abonnement non lié aux espaces clients
- **Cause**: Le trigger `link_abonnement_to_client_space()` s'exécute seulement `BEFORE INSERT` sur `espaces_membres_clients`
- **Conséquence**: Si l'espace est créé AVANT l'abonnement, l'`abonnement_id` n'est jamais lié
- **Impact**: Les modules ne peuvent pas être synchronisés

### Problème 2: Synchronisation non déclenchée
- **Cause**: Le trigger `trigger_sync_modules_on_abonnement_change()` synchronise seulement les espaces qui ont déjà un `abonnement_id`
- **Conséquence**: Si l'`abonnement_id` n'est pas lié, la synchronisation ne se fait jamais
- **Impact**: `modules_actifs` reste vide ou avec les valeurs par défaut

### Problème 3: Mapping des codes de modules
- **Cause**: Les codes de modules dans `plans_modules` doivent correspondre au mapping dans `Layout.tsx`
- **Conséquence**: Si les codes ne correspondent pas, les modules ne s'affichent pas même s'ils sont synchronisés
- **Impact**: Modules synchronisés mais invisibles

## ✅ Solutions Implémentées

### Solution 1: Trigger pour lier abonnements après création (Migration 20250122000064)

Création d'un trigger `trigger_link_abonnement_to_client_spaces()` qui:
1. S'exécute `AFTER INSERT OR UPDATE` sur `abonnements`
2. Trouve tous les espaces clients de l'entreprise
3. Lie l'`abonnement_id` aux espaces
4. Synchronise automatiquement les modules

**Code:**
```sql
CREATE TRIGGER trigger_link_abonnement_to_client_spaces
  AFTER INSERT OR UPDATE ON abonnements
  FOR EACH ROW
  EXECUTE FUNCTION link_abonnement_to_client_spaces();
```

### Solution 2: Fonction pour lier tous les abonnements existants

Création d'une fonction `link_all_abonnements_to_client_spaces()` qui:
1. Parcourt tous les abonnements actifs
2. Les lie aux espaces clients existants
3. Synchronise les modules

### Solution 3: Vérification du mapping

Le mapping dans `Layout.tsx` doit correspondre aux codes dans `plans_modules`:
- `gestion-equipe` → `gestion-equipe`
- `gestion-projets` → `gestion-projets`
- `gestion-de-documents` → `documents`
- etc.

## 🔧 Actions à Vérifier

1. ✅ Migration 20250122000064 créée et prête à être appliquée
2. ⏳ Appliquer la migration (ignorer l'erreur sur migration précédente)
3. ⏳ Vérifier que les abonnements sont liés aux espaces clients
4. ⏳ Vérifier que les modules sont synchronisés
5. ⏳ Vérifier que les modules s'affichent dans le Layout

## 📝 Notes Importantes

- Le trigger se déclenche automatiquement à chaque création/modification d'abonnement
- Les modules sont synchronisés automatiquement
- La fonction `link_all_abonnements_to_client_spaces()` doit être exécutée une fois pour les abonnements existants
- Le mapping des codes de modules doit être vérifié et maintenu à jour




