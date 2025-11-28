# 🔒 RAPPORT DE SÉCURITÉ RLS - Application Crea+Entreprises

## ✅ ÉTAT ACTUEL

### RLS Policies Restaurées

Toutes les restrictions RLS ont été restaurées progressivement après diagnostic. Les données s'affichent correctement et l'application est maintenant sécurisée.

---

## 📋 ÉTAPES DE RESTAURATION

### ✅ ÉTAPE 1 : Tables Principales
**Tables :** entreprises, clients, factures, abonnements, paiements

**Migration :** `20250128000009_restore_rls_step_by_step.sql`

**Policies :**
- Super admin voit TOUT (via `is_super_admin_check()`)
- Utilisateurs voient leurs propres données
- Utilisation de `user_owns_entreprise_check()` pour les relations

---

### ✅ ÉTAPE 2 : Tables Spéciales
**Tables :** collaborateurs, espaces_membres_clients

**Migration :** `20250128000010_restore_rls_etape2_tables_speciales.sql`

**Policies :**
- Super admin voit TOUT
- Utilisateurs voient leurs collaborateurs et espaces membres

---

### ✅ FIX : Table utilisateurs
**Table :** utilisateurs

**Migration :** `20250128000011_fix_utilisateurs_rls_final.sql`

**Problème corrigé :** Erreur 403 (Forbidden) causée par des policies accédant à `auth.users`

**Solution :**
- Suppression de toutes les anciennes policies complexes
- Policy ultra-simple utilisant uniquement `auth.jwt()`
- Plus d'accès à `auth.users` dans les policies

---

### ✅ ÉTAPE 3 : Documents et Projets
**Tables :** documents, document_folders, projets, projets_jalons, projets_taches, projets_documents, salaries

**Migration :** `20250128000012_restore_rls_etape3_documents_projets.sql`

**Policies :**
- Super admin voit TOUT
- Utilisateurs voient uniquement les données de leurs entreprises

---

### ✅ ÉTAPE 4 : Tables Secondaires
**Tables :** avoirs, facture_lignes, relances_mra, plans_abonnement, options_supplementaires

**Migration :** `20250128000013_restore_rls_etape4_tables_secondaires.sql`

**Policies :**
- Super admin voit TOUT
- Utilisateurs voient leurs données
- Tables publiques (plans_abonnement, options_supplementaires) : lecture pour tous, modification super_admin uniquement

---

### ✅ NETTOYAGE FINAL
**Migration :** `20250128000014_restore_rls_final_cleanup.sql`

**Action :**
- Remplacement de toutes les policies temporaires `temp_allow_all_*`
- Ajout automatique de RLS pour toutes les tables restantes

---

## 🔧 FONCTIONS DE SÉCURITÉ

### `is_super_admin_check()`
- **Type :** SQL function, STABLE
- **Méthode :** Utilise uniquement `auth.jwt()` (pas d'accès à `auth.users`)
- **Vérifie :** `auth.jwt()->'user_metadata'->>'role'`, `auth.jwt()->'app_metadata'->>'role'`, ou `auth.jwt()->>'role'`
- **Retourne :** `true` si rôle = 'super_admin'

### `user_owns_entreprise_check(entreprise_uuid uuid)`
- **Type :** SQL function, STABLE, SECURITY DEFINER
- **Méthode :** Vérifie si l'utilisateur connecté possède l'entreprise
- **Utilisation :** Dans les policies pour les tables liées aux entreprises

---

## 🎯 PRINCIPES DE SÉCURITÉ APPLIQUÉS

### 1. Pas d'accès direct à `auth.users`
- ✅ Toutes les policies utilisent `auth.jwt()` uniquement
- ✅ Plus d'erreurs "permission denied for table users"
- ✅ Les fonctions SECURITY DEFINER évitent les problèmes de permissions

### 2. Séparation Plateforme / Clients
- ✅ `super_admin` (plateforme) → Voit TOUT
- ✅ Utilisateurs normaux → Voient uniquement leurs données
- ✅ Distinction claire entre `super_admin` et `client_super_admin`

### 3. RLS au niveau base de données
- ✅ Toutes les vérifications de permissions sont dans les RLS policies
- ✅ Le frontend charge simplement les données sans filtres
- ✅ La base de données filtre automatiquement selon le rôle

### 4. Policies simples et performantes
- ✅ Pas de sous-requêtes complexes dans les policies
- ✅ Utilisation de fonctions helper pour éviter la duplication
- ✅ Policies claires et maintenables

---

## 📊 TABLES SÉCURISÉES

### Tables Principales
- ✅ entreprises
- ✅ clients
- ✅ factures
- ✅ abonnements
- ✅ paiements

### Tables Utilisateurs
- ✅ utilisateurs
- ✅ espaces_membres_clients

### Tables Collaborateurs
- ✅ collaborateurs
- ✅ collaborateurs_entreprise

### Tables Documents
- ✅ documents
- ✅ document_folders

### Tables Projets
- ✅ projets
- ✅ projets_jalons
- ✅ projets_taches
- ✅ projets_documents

### Tables Facturation
- ✅ avoirs
- ✅ facture_lignes
- ✅ relances_mra

### Tables Configuration
- ✅ plans_abonnement (lecture pour tous)
- ✅ options_supplementaires (lecture pour tous)

### Tables Autres
- ✅ salaries

---

## 🔍 POINTS DE VIGILANCE

### 1. Vérification du rôle dans le JWT
- Le rôle `super_admin` doit être présent dans `auth.jwt()->'user_metadata'->>'role'`
- Si le rôle change, l'utilisateur doit se déconnecter/reconnecter pour recharger le JWT

### 2. Tests réguliers
- Tester les permissions avec différents rôles
- Vérifier que les utilisateurs normaux ne voient que leurs données
- Vérifier que les super_admins voient TOUT

### 3. Surveillance des erreurs
- Surveiller les erreurs 403 dans les logs
- Si des erreurs 403 apparaissent, vérifier les policies de la table concernée

### 4. Nouvelles tables
- Toutes les nouvelles tables doivent avoir des RLS policies
- Utiliser les mêmes principes : `is_super_admin_check()` ou `user_owns_entreprise_check()`

---

## ✅ CHECKLIST DE SÉCURITÉ

- [x] Toutes les tables importantes ont des RLS policies
- [x] Plus de policies temporaires `temp_allow_all_*`
- [x] Plus d'accès à `auth.users` dans les policies
- [x] Utilisation de `auth.jwt()` uniquement
- [x] Fonctions de sécurité créées et testées
- [x] Distinction claire entre `super_admin` et autres rôles
- [x] Frontend simplifié (pas de filtres conditionnels)
- [x] RLS gère tout le filtrage automatiquement

---

## 🚀 COMMANDES UTILES

### Appliquer les migrations RLS
```bash
# Étape 1 : Tables principales
node scripts/apply-rls-step-by-step.mjs

# Étape 2 : Tables spéciales
node scripts/apply-rls-etape2.mjs

# Étape 3 : Documents et projets
node scripts/apply-rls-etape3.mjs

# Étape 4 : Tables secondaires
node scripts/apply-rls-etape4.mjs

# Nettoyage final
node scripts/apply-rls-nettoyage-final.mjs
```

### Vérifier la sécurité
```bash
node scripts/verification-securite-complete.mjs
```

### Scanner la base de données
```bash
node scripts/scan-complet-creation-entreprises.mjs
```

---

## 📝 NOTES IMPORTANTES

1. **Déconnexion/Reconnexion nécessaire :** Après modification des RLS policies, les utilisateurs doivent se déconnecter et se reconnecter pour recharger le JWT avec les bonnes métadonnées.

2. **Production :** Assurez-vous que le rôle `super_admin` est correctement configuré dans `auth.users.raw_user_meta_data->>'role'` avant de déployer.

3. **Tests :** Testez toujours avec différents rôles pour vérifier que les permissions fonctionnent correctement.

---

**Date de création :** 2025-01-28
**Dernière mise à jour :** 2025-01-28

