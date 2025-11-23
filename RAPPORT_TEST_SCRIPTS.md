# 📋 RAPPORT - SCRIPTS DE TEST

**Date:** 22 janvier 2025
**Status:** ✅ Scripts créés - Prêt pour utilisation

---

## ✅ SCRIPTS CRÉÉS

### 1. `scripts/generate-test-data-supabase.js`

**Description:** Script de génération de données de test via Supabase Client

**Utilisation:**
```bash
npm run test:generate-data
```

**Fonctionnalités:**
- ✅ Génération de 5 entreprises
- ✅ Génération de 20 clients (4 par entreprise)
- ✅ Génération de 50 factures avec lignes
- ✅ Génération de 30 documents
- ✅ Génération de collaborateurs
- ✅ Génération d'équipes
- ✅ Gestion des erreurs
- ✅ Statistiques de génération

**Données générées:**
- Entreprises avec SIRET, adresses, téléphones réalistes
- Clients avec emails, téléphones réalistes
- Factures avec lignes d'articles et calculs TVA
- Documents avec types variés

**Note:** Le script recherche automatiquement le super admin. Si non trouvé, vous pouvez fournir `SUPER_ADMIN_ID=xxx` dans `.env`.

---

### 2. `scripts/generate-test-data.js`

**Description:** Script de génération via connexion PostgreSQL directe (alternative)

**Utilisation:**
```bash
npm run test:generate-data-direct
```

**Note:** Nécessite les variables de connexion PostgreSQL dans `.env`.

---

## 📊 DONNÉES GÉNÉRÉES

### Entreprises (5)
- Nom, forme juridique, SIRET
- Adresse complète (rue, code postal, ville)
- Téléphone, email
- Date de création aléatoire

### Clients (20 - 4 par entreprise)
- Nom, prénom
- Email réaliste
- Téléphone
- Ville
- Statut: actif

### Factures (50 - 2-3 par client)
- Numéro automatique (FACT-001, FACT-002, etc.)
- Date d'émission et échéance
- Montants HT, TVA, TTC calculés
- Statuts variés (brouillon, envoyée, en attente, payée)
- 2-4 lignes d'articles par facture

### Documents (30 - 1-2 par client)
- Types variés (contrat, facture, devis, note, rapport, fiche_paie, autre)
- Nom de fichier
- Description
- Date aléatoire
- Statut: actif

---

## 🔧 CONFIGURATION REQUISE

### Variables d'environnement `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx

# Optionnel - pour trouver le super admin
SUPER_ADMIN_ID=uuid-du-super-admin
```

---

## ✅ PROCHAINES ÉTAPES

### Pour tester en profondeur:

1. **Générer les données:**
   ```bash
   npm run test:generate-data
   ```

2. **Tester dans l'application:**
   - Ouvrir l'application
   - Vérifier que les entreprises s'affichent
   - Vérifier que les clients s'affichent
   - Vérifier que les factures s'affichent
   - Vérifier que les documents s'affichent

3. **Identifier les problèmes:**
   - Erreurs dans la console
   - Données manquantes
   - Problèmes d'affichage
   - Problèmes de RLS

4. **Corriger les erreurs:**
   - Modifier les fichiers concernés
   - Retester
   - Valider

---

## 📝 NOTES

- Le script utilise le Service Role Key pour avoir tous les droits
- Les données sont générées de manière réaliste
- Les erreurs sont capturées et affichées
- Les statistiques sont affichées à la fin

**Status:** ✅ Script prêt - Nécessite identification du super admin pour fonctionner

