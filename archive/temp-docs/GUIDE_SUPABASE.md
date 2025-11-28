# 🗄️ Guide de Configuration Supabase - Crea+Entreprises

**Nouveau projet Supabase à créer**

---

## 📋 ÉTAPES DE CONFIGURATION

### 1. Créer un Nouveau Projet Supabase

1. **Aller sur Supabase**
   - URL: https://supabase.com
   - Se connecter ou créer un compte

2. **Créer un Nouveau Projet**
   - Cliquer sur **"New Project"**
   - Nom du projet: `crea_entreprises` (ou nom de votre choix)
   - Mot de passe: Créer un mot de passe fort (à sauvegarder !)
   - Région: Choisir la région la plus proche (ex: France - Paris)
   - Plan: **Free** (gratuit pour commencer)

3. **Attendre la Création**
   - La création prend 1-2 minutes
   - Une fois créé, vous aurez accès au dashboard

---

### 2. Récupérer les Clés d'API

1. **Aller dans Settings → API**
   - URL: https://supabase.com/dashboard/project/[votre-projet-id]/settings/api

2. **Récupérer les Informations**
   - **Project URL**: `https://[votre-projet-id].supabase.co`
   - **anon public key**: `eyJ...` (commence par eyJ)

3. **Sauvegarder ces Informations**
   - Vous en aurez besoin pour configurer `.env`

---

### 3. Appliquer les Migrations SQL

1. **Aller dans SQL Editor**
   - URL: https://supabase.com/dashboard/project/[votre-projet-id]/sql/new

2. **Exécuter la Migration Initiale**
   - Ouvrir le fichier: `supabase/migrations/20250122000000_initial_schema.sql`
   - Copier tout le contenu
   - Coller dans l'éditeur SQL
   - Cliquer sur **"Run"**
   - Attendre la fin (30 secondes - 1 minute)

3. **Exécuter la Migration des Données**
   - Ouvrir le fichier: `supabase/migrations/20250122000001_insert_initial_data.sql`
   - Copier tout le contenu
   - Coller dans l'éditeur SQL
   - Cliquer sur **"Run"**

4. **Vérifier**
   - Aller dans **Table Editor**
   - Vérifier que les tables sont créées (23 tables)
   - Vérifier que les plans d'abonnement sont présents (4 plans)

---

### 4. Configurer les Variables d'Environnement Locales

1. **Créer le fichier `.env`**
   ```bash
   cd /Users/user/Downloads/cursor
   cp ENV_EXAMPLE.txt .env
   ```

2. **Éditer le fichier `.env`**
   ```env
   VITE_SUPABASE_URL=https://[votre-projet-id].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ[...votre-clé-complète...]
   ```

3. **Sauvegarder le fichier**

---

### 5. Tester la Connexion

```bash
cd /Users/user/Downloads/cursor
npm run dev
```

**Tester:**
- ✅ L'application se charge
- ✅ Pas d'erreur dans la console (F12)
- ✅ L'inscription fonctionne
- ✅ La connexion fonctionne

---

## 📊 TABLES CRÉÉES (23 tables)

1. ✅ `entreprises` - Gestion des entreprises
2. ✅ `clients` - Gestion des clients (CRM)
3. ✅ `factures` - Gestion des factures
4. ✅ `facture_lignes` - Lignes de facturation
5. ✅ `devis` - Gestion des devis
6. ✅ `devis_lignes` - Lignes de devis
7. ✅ `avoirs` - Gestion des avoirs
8. ✅ `avoir_lignes` - Lignes d'avoirs
9. ✅ `transactions` - Transactions financières
10. ✅ `projets` - Gestion des projets
11. ✅ `salaries` - Gestion des salariés
12. ✅ `fiches_paie` - Fiches de paie
13. ✅ `conges` - Gestion des congés
14. ✅ `fournisseurs` - Gestion des fournisseurs
15. ✅ `factures_achat` - Factures fournisseurs
16. ✅ `produits` - Catalogue produits
17. ✅ `mouvements_stock` - Mouvements de stock
18. ✅ `documents` - Gestion documentaire
19. ✅ `notifications` - Notifications
20. ✅ `messages` - Messagerie interne
21. ✅ `plans_abonnement` - Plans d'abonnement (4 plans)
22. ✅ `abonnements` - Abonnements clients
23. ✅ `options_supplementaires` - Options supplémentaires (8 options)
24. ✅ `abonnement_options` - Lien abonnements/options

---

## 🔒 SÉCURITÉ RLS

**Row Level Security (RLS) activé sur toutes les tables**

- ✅ Isolation complète des données par entreprise
- ✅ Les utilisateurs ne voient que leurs propres données
- ✅ Politiques restrictives configurées
- ✅ Index sur toutes les clés étrangères

---

## 📝 DONNÉES DE RÉFÉRENCE INSÉRÉES

### Plans d'Abonnement (4)
- **Starter** : 29.90€/mois (299€/an)
- **Business** : 79.90€/mois (799€/an)
- **Professional** : 149.90€/mois (1499€/an)
- **Enterprise** : 299.90€/mois (2999€/an)

### Options Supplémentaires (8)
- Utilisateurs supplémentaires : 9.90€/mois
- Comptabilité avancée : 19.90€/mois
- Intégration bancaire : 14.90€/mois
- Support prioritaire : 29.90€/mois
- API avancée : 39.90€/mois
- Signature électronique : 19.90€/mois
- Modules RH : 24.90€/mois
- Reporting avancé : 14.90€/mois

---

## ✅ VÉRIFICATION POST-MIGRATION

### 1. Vérifier les Tables

**Dans Supabase Dashboard → Table Editor:**
- [ ] Toutes les tables sont présentes (24 tables)
- [ ] Les tables ont des colonnes
- [ ] RLS est activé (icône cadenas visible)

### 2. Vérifier les Données de Référence

**Table `plans_abonnement`:**
- [ ] 4 plans présents (Starter, Business, Professional, Enterprise)

**Table `options_supplementaires`:**
- [ ] 8 options présentes

### 3. Tester les Permissions

**Créer un utilisateur de test:**
1. Dans l'application, créer un compte
2. Vérifier qu'il peut créer une entreprise
3. Vérifier qu'il ne voit que ses propres données

---

## 🆘 EN CAS DE PROBLÈME

### Problème 1: Erreur lors de l'exécution SQL

**Solution:**
- Vérifier que vous copiez tout le contenu du fichier SQL
- Exécuter les migrations une par une si nécessaire
- Vérifier les logs d'erreur dans Supabase

### Problème 2: Tables non créées

**Solution:**
- Vérifier que la migration s'est bien exécutée
- Vérifier les logs dans Supabase Dashboard → SQL Editor → History
- Ré-exécuter la migration si nécessaire

### Problème 3: Erreur de connexion dans l'application

**Solution:**
- Vérifier que le fichier `.env` est bien créé
- Vérifier que les valeurs sont correctes (sans espaces)
- Redémarrer le serveur de développement (`npm run dev`)

---

## 📚 DOCUMENTATION SUPABASE

- **Dashboard:** https://supabase.com/dashboard
- **Documentation:** https://supabase.com/docs
- **SQL Editor:** Dashboard → SQL Editor
- **Table Editor:** Dashboard → Table Editor
- **API Docs:** Dashboard → Settings → API

---

## 🎯 PROCHAINES ÉTAPES

Après avoir configuré Supabase :

1. ✅ **Tester l'application localement**
   ```bash
   npm run dev
   ```

2. ✅ **Créer un compte de test**
   - S'inscrire via l'application
   - Vérifier que ça fonctionne

3. ✅ **Envoyer le code sur GitHub**
   ```bash
   git push -u origin main
   ```

4. 🚀 **Configurer Vercel et déployer**

---

**💡 Astuce:** Gardez vos clés Supabase dans un endroit sûr ! Vous en aurez besoin pour Vercel aussi.





