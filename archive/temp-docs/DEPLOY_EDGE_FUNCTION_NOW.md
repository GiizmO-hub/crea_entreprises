# 🚀 DÉPLOIEMENT URGENT : Edge Function create-stripe-checkout

**Erreur actuelle :** CORS - "Failed to send a request to the Edge Function"

**Cause :** L'Edge Function n'est pas déployée sur Supabase

---

## ⚡ DÉPLOIEMENT RAPIDE (5 minutes)

### Option 1 : Via Supabase Dashboard (RECOMMANDÉ)

1. **Ouvrez Supabase Dashboard**
   - Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Sélectionnez votre projet

2. **Créez l'Edge Function**
   - Allez dans **Edge Functions** (menu de gauche)
   - Cliquez sur **Create new function**
   - Nom : `create-stripe-checkout`

3. **Copiez le code**
   - Ouvrez le fichier : `/Users/user/Downloads/cursor/supabase/functions/create-stripe-checkout/index.ts`
   - Copiez TOUT le contenu (Cmd+A, Cmd+C)
   - Collez dans l'éditeur Supabase Dashboard

4. **Déployez**
   - Cliquez sur **Deploy** (en bas à droite)

5. **Configurez les secrets**
   - Allez dans **Settings** → **Edge Functions** → **Secrets**
   - Ajoutez :
     - **Nom :** `STRIPE_SECRET_KEY`
     - **Valeur :** `sk_test_51SXOlcEMmOXNQayfw50s9s0qct4kEulo0NRH2exFEvjhEW7p4NYbKCSAGqjKWDJq4VTu0SA3lMp5UiTneXECQAmM00idhC3wRk`
   - Cliquez sur **Add secret**
   - Répétez pour `STRIPE_WEBHOOK_SECRET` = `whsec_oS5pozHfNYgKrlKMPnvw1bm7tW2caPef`

6. **⚠️ IMPORTANT : Redéployez après avoir ajouté les secrets !**
   - Retournez dans **Edge Functions** → `create-stripe-checkout`
   - Cliquez sur **Deploy** à nouveau

---

### Option 2 : Via Supabase CLI

```bash
cd /Users/user/Downloads/cursor

# 1. Vérifier que Supabase CLI est installé
which supabase || npm install -g supabase

# 2. Se connecter à Supabase (si pas déjà fait)
supabase login

# 3. Lier le projet (si pas déjà fait)
# Trouvez votre PROJECT_REF dans Supabase Dashboard → Settings → General
supabase link --project-ref VOTRE_PROJECT_REF

# 4. Déployer l'Edge Function
supabase functions deploy create-stripe-checkout

# 5. Configurer les secrets (via Dashboard ou CLI)
# Via Dashboard est plus simple pour les secrets
```

---

## ✅ VÉRIFICATION APRÈS DÉPLOIEMENT

1. **Vérifiez dans Dashboard**
   - Edge Functions → Vous devriez voir `create-stripe-checkout`

2. **Testez**
   - Rafraîchissez votre navigateur (Cmd+R)
   - Essayez de payer par carte
   - L'erreur CORS devrait disparaître

3. **Si l'erreur persiste**
   - Vérifiez les logs : Edge Functions → `create-stripe-checkout` → **Logs**
   - Vérifiez que les secrets sont bien configurés
   - Vérifiez que l'Edge Function est bien déployée (bouton "Deploy" visible)

---

## 🔍 LOGS À VÉRIFIER

Après déploiement, dans **Edge Functions → create-stripe-checkout → Logs**, vous devriez voir :
- Les requêtes arrivant
- Les erreurs éventuelles
- Les logs de création de session Stripe

---

## ⚠️ NOTES IMPORTANTES

1. **Les secrets sont différents des variables d'environnement frontend**
   - Ils sont dans **Supabase Dashboard → Settings → Edge Functions → Secrets**
   - PAS dans le fichier `.env`

2. **Redéployer après modification des secrets**
   - Les secrets nécessitent un redéploiement de l'Edge Function
   - Cliquez sur **Deploy** après chaque modification de secret

3. **L'Edge Function doit être déployée pour fonctionner**
   - Elle n'existe pas localement pour le navigateur
   - Elle doit être sur les serveurs Supabase


