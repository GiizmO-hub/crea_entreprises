# Fix Page Blanche - Erreurs TypeScript critiques

Les erreurs TypeScript empêchent la compilation et donc l'affichage de l'application.

## Corrections appliquées :

1. ✅ Suppression des props `onNavigate` dans App.tsx (déjà fait)
2. ✅ Correction des imports `useAuth` dans plusieurs fichiers
3. ✅ Correction de ErrorBoundary (imports de types)

## Erreurs restantes à corriger :

1. **Props manquantes** : Factures, Documents, GestionProjets nécessitent `onNavigate` mais ne sont pas passés
   - Solution : Supprimer les interfaces Props avec `onNavigate` ou les rendre optionnelles

2. **useSupabaseQuery** : Erreurs de typage avec `unknown`
   - Solution : Ajouter des assertions de type

3. **db-fix.ts** : Erreurs de typage avec `error` de type `unknown`
   - Solution : Ajouter des vérifications de type

4. **Abonnements.tsx** : Erreurs de typage complexes
   - Solution : Corriger les types des interfaces

## Action immédiate :

Pour que l'application s'affiche, il faut au minimum :
- Supprimer toutes les interfaces Props avec `onNavigate` requis
- Ou rendre `onNavigate` optionnel dans ces interfaces

