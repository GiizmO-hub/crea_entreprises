# CORRECTION COMPLÈTE - COLLABORATEURS ET MODULES

## PROBLÈMES IDENTIFIÉS

1. ❌ **Table incorrecte pour les clients** : La page utilise `collaborateurs` (plateforme) au lieu de `collaborateurs_entreprise` (clients)
2. ❌ **Bouton masqué** : Les clients ne peuvent pas créer de collaborateurs car le bouton n'apparaît que pour les super admins
3. ❌ **Structure différente** : `collaborateurs_entreprise` a une structure différente (`actif` au lieu de `statut`, pas de `departement`, `poste`, etc.)
4. ❌ **Modules non synchronisés** : La migration de synchronisation des modules n'a peut-être pas été appliquée

## SOLUTIONS À APPLIQUER

### 1. Modifier `loadCollaborateurs` pour utiliser la bonne table

- **Super Admin** : `collaborateurs` (table plateforme)
- **Client** : `collaborateurs_entreprise` (table client)

### 2. Permettre aux clients de créer des collaborateurs

- Afficher le bouton "Créer Collaborateur" pour les clients aussi
- Utiliser `clientEntrepriseId` pour les clients (pas besoin de sélectionner l'entreprise)

### 3. Adapter l'interface pour les deux structures

- Interface `Collaborateur` doit supporter les deux structures
- Mapping des champs (`statut` ↔ `actif`, etc.)

### 4. Vérifier la synchronisation des modules

- Appliquer la migration `20250130000003_sync_all_client_modules_from_subscriptions.sql`
- S'assurer que les modules sont bien synchronisés depuis les abonnements

## FICHIERS À MODIFIER

- `src/pages/Collaborateurs.tsx` : Réécrire complètement pour gérer les deux cas
