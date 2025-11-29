# 🤖 Configuration de l'IA pour le CRM Avancé

## 📋 Prérequis

Le module CRM utilise **OpenAI API** pour toutes les fonctionnalités IA.

## 🔑 Configuration

### 1. Obtenir une clé API OpenAI

1. Allez sur https://platform.openai.com/api-keys
2. Créez un compte ou connectez-vous
3. Créez une nouvelle clé API
4. Copiez la clé (elle commence par `sk-...`)

### 2. Configurer dans Supabase

1. Ouvrez votre projet Supabase Dashboard
2. Allez dans **Settings** → **Edge Functions** → **Secrets**
3. Ajoutez le secret suivant :
   - **Nom** : `OPENAI_API_KEY`
   - **Valeur** : Votre clé API OpenAI (ex: `sk-...`)

### 3. Déployer l'Edge Function

```bash
# Depuis la racine du projet
supabase functions deploy crm-ai-assistant
```

Ou via le Dashboard Supabase :
1. Allez dans **Edge Functions**
2. Créez une nouvelle fonction `crm-ai-assistant`
3. Copiez le contenu de `supabase/functions/crm-ai-assistant/index.ts`
4. Déployez

## ✨ Fonctionnalités IA disponibles

### 1. Génération d'emails commerciaux
- **Où** : Formulaire de campagne email
- **Bouton** : "Générer avec IA" à côté des champs objet et contenu
- **Utilisation** : Cliquez sur le bouton pour générer un email personnalisé basé sur le client sélectionné

### 2. Analyse prédictive des opportunités
- **Où** : Sur chaque opportunité dans le pipeline
- **Bouton** : Icône 🧠 "Analyser" sur chaque carte d'opportunité
- **Résultat** : 
  - Probabilité prédite de succès
  - Risques identifiés
  - Recommandations
  - Prochaines actions suggérées

### 3. Suggestions d'actions
- **Où** : Formulaire d'opportunité
- **Bouton** : "Suggestions IA" dans le formulaire
- **Résultat** : Liste d'actions prioritaires avec possibilité de créer directement des activités

### 4. Analyse de sentiment
- **Où** : Formulaire d'opportunité (champ description)
- **Bouton** : "Analyser sentiment" à côté du champ description
- **Résultat** : Sentiment (positif/négatif/neutre), score, émotions détectées, alertes

### 5. Génération de proposition commerciale
- **Où** : Sur chaque opportunité dans la liste
- **Bouton** : Icône ✨ "Générer proposition" sur chaque opportunité
- **Résultat** : Proposition commerciale complète avec introduction, solution, avantages, tarification, prochaines étapes

## 💰 Coûts OpenAI

Le module utilise **GPT-4o-mini** qui est très économique :
- **Input** : ~$0.15 par 1M tokens
- **Output** : ~$0.60 par 1M tokens

**Estimation par utilisation** :
- Génération email : ~500 tokens → ~$0.0003
- Analyse opportunité : ~1000 tokens → ~$0.0006
- Suggestions actions : ~800 tokens → ~$0.0005
- Analyse sentiment : ~300 tokens → ~$0.0002
- Proposition commerciale : ~1500 tokens → ~$0.0009

**Coût moyen par fonctionnalité** : < $0.001

## 🔒 Sécurité

- L'Edge Function vérifie l'authentification de l'utilisateur
- Seuls les utilisateurs authentifiés peuvent utiliser l'IA
- Les données sont traitées de manière sécurisée
- La clé API est stockée dans les secrets Supabase (jamais exposée au client)

## 🐛 Dépannage

### L'IA ne fonctionne pas

1. **Vérifiez la clé API** :
   - Allez dans Supabase Dashboard → Edge Functions → Secrets
   - Vérifiez que `OPENAI_API_KEY` est bien configuré

2. **Vérifiez le déploiement** :
   - Allez dans Edge Functions
   - Vérifiez que `crm-ai-assistant` est déployé et actif

3. **Vérifiez les logs** :
   - Allez dans Edge Functions → Logs
   - Recherchez les erreurs liées à `crm-ai-assistant`

4. **Vérifiez les crédits OpenAI** :
   - Allez sur https://platform.openai.com/usage
   - Vérifiez que vous avez des crédits disponibles

### Erreur "OPENAI_API_KEY not configured"

La clé API n'est pas configurée dans les secrets Supabase. Suivez l'étape 2 de la configuration.

### Erreur "Unauthorized"

L'utilisateur n'est pas authentifié. Reconnectez-vous.

### L'IA est lente

C'est normal, l'IA peut prendre 2-5 secondes pour répondre. Un indicateur de chargement s'affiche pendant le traitement.

## 📚 Documentation

Pour plus d'informations sur OpenAI API :
- https://platform.openai.com/docs
- https://platform.openai.com/docs/api-reference

