# 🔐 Configuration de l'API Gemini (GRATUIT)

## ⚠️ SÉCURITÉ URGENTE

**Votre clé API a été exposée publiquement !**

### Actions immédiates :

1. **RÉVOQUER la clé exposée :**
   - Allez sur : https://aistudio.google.com/app/apikey
   - Trouvez la clé : `AIzaSyD3o1J5oS0p9ZNFZYStiCUe1NwmMS5J1s0`
   - Cliquez sur "Delete" ou "Revoke"
   - ⚠️ **FAITES-LE MAINTENANT !**

2. **Créer une NOUVELLE clé :**
   - Toujours sur https://aistudio.google.com/app/apikey
   - Cliquez sur "Create API Key"
   - Donnez un nom (ex: "Facturation Dev")
   - Copiez la nouvelle clé (commence par `AIzaSy...`)

3. **Ajouter dans Supabase :**
   - Allez sur : https://supabase.com/dashboard
   - Sélectionnez votre projet
   - Allez dans **Settings** → **Edge Functions** → **Secrets**
   - Cliquez sur **Add new secret**
   - **Nom :** `GEMINI_API_KEY`
   - **Valeur :** Collez votre NOUVELLE clé API
   - Cliquez sur **Save**

4. **Redéployer l'Edge Function :**
   ```bash
   cd /Users/user/Downloads/cursor
   supabase functions deploy parse-invoice-ai
   ```

   Ou via le Dashboard Supabase :
   - Allez dans **Edge Functions** → `parse-invoice-ai`
   - Cliquez sur **Deploy**

## ✅ Vérification

Après configuration, testez la commande vocale :
1. Rechargez l'application (Cmd+R)
2. Testez la facture vocale
3. Vérifiez dans la console que `ai_provider: "gemini"` apparaît

## 📝 Notes importantes

- **Ne partagez JAMAIS votre clé API publiquement**
- La clé Gemini est gratuite jusqu'à 15 requêtes/minute et 1500/jour
- Si vous dépassez les limites, le système basculera automatiquement sur le parsing local
- Le parsing local fonctionne très bien même sans clé API

