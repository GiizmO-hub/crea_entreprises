# 🚀 Déploiement de l'Edge Function CRM IA

## ⚡ Déploiement Rapide

### Option 1 : Via Supabase CLI (Recommandé)

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

### Option 2 : Via Supabase Dashboard

1. **Ouvrir Supabase Dashboard** :
   ```
   https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/functions
   ```

2. **Créer une nouvelle fonction** :
   - Cliquez sur "Create a new function"
   - **Name** : `crm-ai-assistant`

3. **Copier le code** :
   - Ouvrir : `supabase/functions/crm-ai-assistant/index.ts`
   - Copier tout le contenu (Cmd+A, Cmd+C)

4. **Coller dans l'éditeur Supabase** :
   - Coller dans l'éditeur (Cmd+V)

5. **Déployer** :
   - Cliquez sur "Deploy"

## ✅ Vérification

Après déploiement, vérifiez :

1. **Dans Supabase Dashboard** :
   - Allez dans Edge Functions
   - Vérifiez que `crm-ai-assistant` est listée et active

2. **Dans l'application** :
   - Rechargez la page
   - Cliquez sur un bouton IA
   - Ouvrez la console (F12)
   - Vous devriez voir les logs : `🤖 Appel IA:` et `📥 Réponse IA:`

## 🐛 Si ça ne fonctionne toujours pas

1. **Vérifier les logs Supabase** :
   - Dashboard → Edge Functions → Logs
   - Recherchez les erreurs liées à `crm-ai-assistant`

2. **Vérifier OPENAI_API_KEY** :
   - Dashboard → Settings → Edge Functions → Secrets
   - Vérifiez que `OPENAI_API_KEY` est bien configuré

3. **Tester l'Edge Function manuellement** :
   - Dashboard → Edge Functions → `crm-ai-assistant` → Test
   - Utilisez ce body :
   ```json
   {
     "action": "analyze_sentiment",
     "data": {
       "texte": "Test d'analyse de sentiment"
     }
   }
   ```

## 📝 Note

L'Edge Function doit être déployée pour que les boutons IA fonctionnent. Sans elle, vous obtiendrez une erreur 404 qui peut causer des problèmes de navigation.

