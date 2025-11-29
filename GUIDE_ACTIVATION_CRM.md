# 🚀 Guide d'Activation du Module CRM Avancé

## 📋 Étapes pour activer le CRM avec IA

### ÉTAPE 1 : Appliquer la migration SQL ⚡ (OBLIGATOIRE)

**Objectif** : Créer les tables, RLS policies, fonctions RPC et activer le module dans la base de données.

1. **Ouvrir le SQL Editor Supabase** :
   ```
   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
   ```

2. **Ouvrir le fichier** : `APPLY_CRM_MIGRATION_NOW.sql` (à la racine du projet)

3. **Copier tout le contenu** :
   - Cmd+A (sélectionner tout)
   - Cmd+C (copier)

4. **Coller dans l'éditeur SQL** :
   - Cmd+V dans l'éditeur Supabase

5. **Exécuter** :
   - Cliquer sur "Run" ou "Exécuter"
   - Attendre 10-20 secondes

6. **Vérifier le succès** :
   - Vous devriez voir : `✅ Migration CRM Avancé appliquée avec succès !`

**✅ Cette étape crée** :
- 5 tables (pipeline, opportunités, activités, campagnes, contacts)
- RLS policies pour la sécurité
- 2 fonctions RPC (statistiques, opportunités par étape)
- Activation dans `modules_activation`
- Ajout aux plans Professional et Enterprise
- Synchronisation pour les clients existants

---

### ÉTAPE 2 : Configurer l'IA (OpenAI) 🤖 (OPTIONNEL mais recommandé)

**Objectif** : Activer toutes les fonctionnalités IA (génération d'emails, analyse, suggestions, etc.)

#### 2.1 Obtenir une clé API OpenAI

1. Allez sur : https://platform.openai.com/api-keys
2. Créez un compte ou connectez-vous
3. Cliquez sur "Create new secret key"
4. Donnez un nom (ex: "CRM Crea+Entreprises")
5. **Copiez la clé** (elle commence par `sk-...`)
   - ⚠️ **IMPORTANT** : Vous ne pourrez plus la voir après ! Sauvegardez-la.

#### 2.2 Ajouter la clé dans Supabase

1. **Ouvrir Supabase Dashboard** :
   ```
   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr
   ```

2. **Aller dans Settings** → **Edge Functions** → **Secrets**

3. **Ajouter le secret** :
   - Cliquez sur "Add new secret"
   - **Name** : `OPENAI_API_KEY`
   - **Value** : Votre clé API (ex: `sk-...`)
   - Cliquez sur "Save"

**✅ Maintenant l'IA est configurée !**

---

### ÉTAPE 3 : Déployer l'Edge Function IA 🚀 (Si vous avez configuré l'IA)

**Objectif** : Déployer la fonction qui gère toutes les fonctionnalités IA.

#### Option A : Via Supabase CLI (Recommandé)

```bash
# Depuis la racine du projet
cd /Users/user/Downloads/cursor

# Se connecter à Supabase (si pas déjà fait)
supabase login

# Lier le projet (si pas déjà fait)
supabase link --project-ref ewlozuwvrteopotfizcr

# Déployer l'Edge Function
supabase functions deploy crm-ai-assistant
```

#### Option B : Via Supabase Dashboard

1. **Ouvrir Supabase Dashboard** → **Edge Functions**

2. **Créer une nouvelle fonction** :
   - Cliquez sur "Create a new function"
   - **Name** : `crm-ai-assistant`

3. **Copier le code** :
   - Ouvrir : `supabase/functions/crm-ai-assistant/index.ts`
   - Copier tout le contenu (Cmd+A, Cmd+C)

4. **Coller dans l'éditeur** :
   - Coller dans l'éditeur Supabase (Cmd+V)

5. **Déployer** :
   - Cliquez sur "Deploy"

**✅ L'Edge Function est maintenant déployée !**

---

### ÉTAPE 4 : Vérifier l'activation dans l'application ✅

1. **Recharger l'application** :
   - Rechargez la page (Cmd+R ou F5)

2. **Vérifier le menu** :
   - Le module "CRM Avancé" devrait apparaître dans le menu latéral
   - Icône : 📈 (TrendingUp)

3. **Tester le module** :
   - Cliquez sur "CRM Avancé"
   - Vous devriez voir les onglets : Pipeline, Opportunités, Activités, Campagnes, Statistiques

4. **Tester l'IA** (si configurée) :
   - Créez une opportunité
   - Cliquez sur le bouton "🧠 Analyser" ou "✨ Générer proposition"
   - L'IA devrait répondre en 2-5 secondes

---

## 🎯 Checklist de vérification

### ✅ Base de données
- [ ] Migration SQL appliquée avec succès
- [ ] Tables créées (vérifier dans Supabase → Table Editor)
- [ ] Module visible dans `modules_activation` (actif = true, est_cree = true)

### ✅ Plans d'abonnement
- [ ] Module ajouté au plan Professional
- [ ] Module ajouté au plan Enterprise
- [ ] Clients existants synchronisés (vérifier `modules_actifs` dans `espaces_membres_clients`)

### ✅ Application
- [ ] Module visible dans le menu latéral
- [ ] Page CRM charge sans erreur
- [ ] Pipeline Kanban fonctionne
- [ ] Formulaires s'ouvrent correctement

### ✅ IA (Optionnel)
- [ ] `OPENAI_API_KEY` configuré dans Supabase Secrets
- [ ] Edge Function `crm-ai-assistant` déployée
- [ ] Boutons IA fonctionnent (génération, analyse, suggestions)
- [ ] Modal IA s'affiche avec les résultats

---

## 🐛 Dépannage

### Le module n'apparaît pas dans le menu

**Solution** :
1. Vérifiez que la migration SQL a été appliquée
2. Vérifiez que vous avez un plan Professional ou Enterprise
3. Vérifiez dans `espaces_membres_clients.modules_actifs` que `crm-avance` est à `true`
4. Rechargez l'application (Cmd+R)

### Erreur 404 sur les tables

**Solution** :
- La migration SQL n'a pas été appliquée
- Réessayez l'ÉTAPE 1

### L'IA ne fonctionne pas

**Solutions** :
1. Vérifiez que `OPENAI_API_KEY` est bien configuré dans Supabase Secrets
2. Vérifiez que l'Edge Function `crm-ai-assistant` est déployée
3. Vérifiez les logs dans Supabase → Edge Functions → Logs
4. Vérifiez que vous avez des crédits OpenAI : https://platform.openai.com/usage

### Erreur "Unauthorized" avec l'IA

**Solution** :
- Reconnectez-vous à l'application
- L'IA nécessite une session utilisateur valide

---

## 📊 Coûts OpenAI (Estimation)

**Modèle utilisé** : GPT-4o-mini (très économique)

| Fonctionnalité | Coût par utilisation | Exemple mensuel (100 utilisations) |
|----------------|---------------------|-----------------------------------|
| Génération email | ~$0.0003 | $0.03 |
| Analyse opportunité | ~$0.0006 | $0.06 |
| Suggestions actions | ~$0.0005 | $0.05 |
| Analyse sentiment | ~$0.0002 | $0.02 |
| Proposition commerciale | ~$0.0009 | $0.09 |

**Total estimé pour 100 utilisations/mois** : ~$0.25

---

## 🎉 C'est prêt !

Une fois toutes les étapes complétées, le CRM Avancé est **100% fonctionnel** avec toutes ses fonctionnalités IA !

**Besoin d'aide ?** Consultez `CRM_AI_SETUP.md` pour plus de détails sur l'IA.

