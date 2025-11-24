# 📋 ERREURS RESTANTES À CORRIGER

## 📊 STATISTIQUES
- **Erreurs totales :** 97
- **Warnings :** 21
- **Total :** 118 problèmes

---

## 🔴 ERREURS PAR CATÉGORIE

### 1. Types `any` à remplacer (91 erreurs)
**Fichiers concernés :**
- `src/pages/Abonnements.tsx` : ~18 erreurs
- `src/pages/Clients.tsx` : ~3 erreurs
- `src/pages/Collaborateurs.tsx` : ~10 erreurs
- `src/pages/Documents.tsx` : ~8 erreurs
- `src/pages/Entreprises.tsx` : ~3 erreurs
- `src/pages/Factures.tsx` : ~11 erreurs
- `src/pages/GestionEquipe.tsx` : ~11 erreurs
- `src/pages/GestionPlans.tsx` : ~5 erreurs
- `src/pages/GestionProjets.tsx` : ~4 erreurs
- `src/pages/Modules.tsx` : ~4 erreurs
- `src/pages/Parametres.tsx` : ~7 erreurs
- `src/pages/clients/ClientSuperAdmin.tsx` : ~1 erreur
- `src/lib/db-fix.ts` : ~6 erreurs
- `src/lib/moduleReuse.ts` : ~1 erreur

**Solution :** Remplacer tous les `any` par :
- `unknown` pour les erreurs catch
- Types spécifiques pour les données
- `ErrorType` pour les erreurs API

### 2. Variables non utilisées (1 erreur)
- `src/pages/Abonnements.tsx` : `_onNavigate`

### 3. Fast refresh warning (1 erreur)
- `src/contexts/AuthContext.tsx` : Exporter useAuth dans un fichier séparé

### 4. Warnings useEffect (21 warnings)
- Dépendances manquantes dans plusieurs fichiers

---

## ✅ PLAN DE CORRECTION

### Étape 1 : Corriger les types `any` dans les services/lib (FAIT)
- ✅ moduleService.ts
- ✅ abonnementService.ts
- ✅ clientSpaceService.ts
- ✅ db-fix.ts (en cours)
- ✅ moduleReuse.ts (en cours)

### Étape 2 : Corriger les types `any` dans les pages
- Créer un type générique pour les erreurs
- Remplacer tous les `catch (error: any)` par `catch (error: unknown)`
- Typer les données Supabase

### Étape 3 : Corriger les warnings
- Ajouter les dépendances manquantes dans useEffect
- Ou utiliser eslint-disable avec justification

---

## 🚀 COMMANDES UTILES

```bash
# Vérifier les erreurs
npm run lint

# Vérifier TypeScript
npm run typecheck

# Build
npm run build
```

---

**Status :** 🟡 En cours de correction

