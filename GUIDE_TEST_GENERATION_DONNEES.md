# 📋 GUIDE - Génération de Données de Test

**Date:** 22 janvier 2025
**Script:** `scripts/generate-test-data-supabase.js`

---

## 🎯 OBJECTIF

Ce script génère automatiquement des données de test réalistes dans votre base de données Supabase pour tester l'application en profondeur.

---

## 📊 DONNÉES GÉNÉRÉES

- **5 entreprises** avec SIRET, adresses, téléphones réalistes
- **20 clients** (4 par entreprise) avec emails, téléphones
- **50 factures** avec lignes d'articles et calculs TVA
- **30 documents** de différents types
- **15 collaborateurs** avec rôles variés
- **5 équipes** avec permissions

---

## 🚀 UTILISATION

### Option 1 : Avec ID en paramètre (RECOMMANDÉ) ⭐

```bash
npm run test:generate-data -- --user-id=votre-uuid-utilisateur
```

**Exemple:**
```bash
npm run test:generate-data -- --user-id=12345678-1234-1234-1234-123456789abc
```

### Option 2 : Avec ID dans .env

1. Ajoutez dans votre fichier `.env`:
```env
SUPER_ADMIN_ID=votre-uuid-utilisateur
```

2. Lancez le script:
```bash
npm run test:generate-data
```

---

## 🔍 COMMENT TROUVER VOTRE ID UTILISATEUR

### Méthode 1 : Via l'application (la plus simple)

1. Ouvrez l'application et connectez-vous
2. Ouvrez la console du navigateur (F12)
3. Exécutez cette commande:
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('Votre ID utilisateur:', user.id);
```
4. Copiez l'ID affiché

### Méthode 2 : Via Supabase Dashboard

1. Allez dans Supabase Dashboard > Authentication > Users
2. Trouvez votre utilisateur (email: meddecyril@icloud.com)
3. Copiez l'UUID (ID) de l'utilisateur

---

## 📝 EXEMPLE COMPLET

```bash
# 1. Récupérer votre ID utilisateur (voir ci-dessus)
#    Exemple: 12345678-1234-1234-1234-123456789abc

# 2. Lancer le script avec votre ID
npm run test:generate-data -- --user-id=12345678-1234-1234-1234-123456789abc

# 3. Le script va générer toutes les données et afficher:
#    ✅ 5 entreprises créées
#    ✅ 20 clients créés
#    ✅ 50 factures créées avec lignes
#    ✅ 30 documents créés
#    ✅ 15 collaborateurs créés
#    ✅ 5 équipes créées
```

---

## ⚙️ CONFIGURATION REQUISE

### Variables d'environnement `.env`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx

# Optionnel - si vous ne fournissez pas --user-id
SUPER_ADMIN_ID=votre-uuid-utilisateur
```

---

## 🧪 TESTER APRÈS GÉNÉRATION

Une fois les données générées:

1. **Ouvrez l'application**
2. **Vérifiez les modules:**
   - ✅ Entreprises → Devrait afficher 5 entreprises
   - ✅ Clients → Devrait afficher 20 clients
   - ✅ Facturation → Devrait afficher 50 factures
   - ✅ Documents → Devrait afficher 30 documents
   - ✅ Collaborateurs → Devrait afficher 15 collaborateurs
   - ✅ Gestion d'Équipe → Devrait afficher 5 équipes

3. **Testez les fonctionnalités:**
   - Recherche et filtres
   - Création/Modification/Suppression
   - Affichage des détails
   - Navigation entre pages
   - Calculs (TVA, totaux)
   - Permissions et accès

4. **Identifiez les problèmes:**
   - Erreurs dans la console
   - Données manquantes
   - Problèmes d'affichage
   - Problèmes de RLS (Row Level Security)
   - Problèmes de performance

---

## 🐛 DÉPANNAGE

### Erreur: "IMPOSSIBLE DE TROUVER L'ID UTILISATEUR"

**Solution:**
- Fournissez l'ID en paramètre: `--user-id=xxx`
- Ou ajoutez `SUPER_ADMIN_ID=xxx` dans `.env`

### Erreur: "VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis"

**Solution:**
- Vérifiez que ces variables sont dans votre `.env`
- Vérifiez que le fichier `.env` est bien chargé

### Erreur: "permission denied"

**Solution:**
- Vérifiez que `SUPABASE_SERVICE_ROLE_KEY` est correct
- Vérifiez que vous avez les droits admin sur Supabase

### Les données ne s'affichent pas dans l'application

**Solutions:**
- Vérifiez les politiques RLS (Row Level Security)
- Vérifiez que l'utilisateur a accès aux entreprises créées
- Vérifiez la console pour les erreurs

---

## 📊 STATISTIQUES

Le script affiche un résumé à la fin:

```
✅✅✅ GÉNÉRATION DE DONNÉES DE TEST TERMINÉE ✅✅✅

📊 RÉSUMÉ:
  - 5 entreprises
  - 20 clients
  - 50 factures avec lignes
  - 30 documents
  - 15 collaborateurs
  - 5 équipes
```

Si des erreurs se produisent, elles sont listées à la fin.

---

## 🔄 RELANCER LE SCRIPT

Le script peut être relancé plusieurs fois. Les données seront ajoutées à celles existantes.

**⚠️ Note:** Les entreprises et clients avec les mêmes emails/SIRET ne seront pas créés en double (contrainte unique).

---

## 📞 BESOIN D'AIDE ?

Si vous rencontrez des problèmes:

1. Vérifiez la console pour les erreurs détaillées
2. Vérifiez les logs Supabase Dashboard > Logs
3. Vérifiez que les migrations sont appliquées
4. Vérifiez que les tables existent

---

**Status:** ✅ Script prêt à l'emploi

