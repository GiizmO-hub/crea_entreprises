# 🔧 GUIDE COMPLET - Désactiver JWT pour stripe-webhooks

## 🎯 Objectif

Désactiver la vérification JWT pour l'Edge Function `stripe-webhooks` dans Supabase Dashboard afin que les webhooks Stripe fonctionnent sans erreur 401.

---

## ✅ ÉTAPES DÉTAILLÉES

### Étape 1 : Ouvrir le Dashboard Supabase

1. **Ouvrir votre navigateur**
2. **Aller sur :** https://supabase.com/dashboard
3. **Se connecter** si nécessaire
4. **Sélectionner votre projet :** `ewlozuwvrteopotfizcr`

### Étape 2 : Accéder aux Edge Functions

1. Dans le menu de gauche, chercher **"Edge Functions"**
2. **Cliquer** sur "Edge Functions"
3. Vous verrez la liste de toutes vos Edge Functions

### Étape 3 : Ouvrir stripe-webhooks

1. Dans la liste, **chercher** `stripe-webhooks`
2. **Cliquer** sur `stripe-webhooks`
3. Vous arrivez sur la page de détails de la fonction

### Étape 4 : Désactiver la Vérification JWT

**Option A : Si vous voyez un switch "Verify JWT"**
- **Chercher** un switch/bouton appelé :
  - "Verify JWT"
  - "Authentication Required"
  - "Require Authentication"
- **DÉSACTIVER** ce switch (le mettre sur OFF/Désactivé)

**Option B : Si vous voyez "Public Access"**
- **Chercher** un switch/bouton appelé :
  - "Public Access"
  - "Public Function"
  - "Allow Public Access"
- **ACTIVER** ce switch (le mettre sur ON/Activé)

**Option C : Si vous voyez "Settings" ou "Configuration"**
- **Cliquer** sur "Settings" ou "Configuration"
- **Chercher** les options d'authentification
- **Désactiver** "Verify JWT" ou activer "Public Access"

**Option D : Si vous voyez "Permissions" ou "Autorisations"**
- **Cliquer** sur "Permissions" ou "Autorisations"
- **Chercher** les options d'authentification
- **Désactiver** "Verify JWT"

### Étape 5 : Sauvegarder

1. **Chercher** un bouton :
   - "Save" / "Sauvegarder"
   - "Update" / "Mettre à jour"
   - "Apply" / "Appliquer"
2. **Cliquer** sur ce bouton
3. Attendre la confirmation

---

## 🧪 VÉRIFICATION

### Test 1 : Dans le Navigateur

1. **Ouvrir** cette URL :
   ```
   https://ewlozuwvrteopotfizcr.supabase.co/functions/v1/stripe-webhooks
   ```

2. **Vérifier le résultat :**
   - ❌ **Avant :** `{"code":401,"message":"En-tête d'autorisation manquant"}`
   - ✅ **Après :** Autre erreur (400, 500) ou message différent
   - ✅ **Pas de 401** = Configuration réussie !

### Test 2 : Stripe Dashboard

1. **Ouvrir** Stripe Dashboard → Webhooks → [Votre endpoint]
2. **Cliquer** sur "Envoyer des événements de test"
3. **Sélectionner** : `checkout.session.completed`
4. **Cliquer** sur "Envoyer l'événement de test"
5. **Vérifier** :
   - ✅ **Statut 200 OK** → Configuration réussie !
   - ❌ **Statut 401** → Configuration pas encore appliquée

---

## 📋 OÙ TROUVER L'OPTION DANS LE DASHBOARD

### Emplacements Possibles

1. **Page principale de la fonction**
   - En haut à droite : Switch "Verify JWT"
   - Au centre : Section "Configuration" ou "Settings"

2. **Onglet "Settings" ou "Configuration"**
   - Menu horizontal : Onglet "Settings"
   - Section "Authentication" ou "Security"

3. **Menu latéral ou "..." (trois points)**
   - Cliquer sur "..." à côté du nom de la fonction
   - Menu déroulant : "Settings" ou "Configure"

4. **Page "General" ou "Overview"**
   - Onglet "General"
   - Section "Security" ou "Authentication"

---

## 🆘 SI VOUS NE TROUVEZ PAS L'OPTION

### Solution 1 : Chercher dans la Documentation

- Rechercher "disable JWT" dans l'aide Supabase
- Ou "public Edge Functions"

### Solution 2 : Vérifier la Version de Supabase

- Certaines versions ont des interfaces différentes
- L'option peut être dans un endroit différent

### Solution 3 : Utiliser l'API (Avancé)

Si l'interface n'a pas l'option, vous pouvez utiliser l'API Management de Supabase (nécessite un Access Token).

---

## 📸 CAPTURES D'ÉCRAN ATTENDUES

### Avant la Configuration
- Switch "Verify JWT" : ✅ Activé (ON)

### Après la Configuration
- Switch "Verify JWT" : ❌ Désactivé (OFF)
- OU Switch "Public Access" : ✅ Activé (ON)

---

## ✅ CHECKLIST

- [ ] Dashboard Supabase ouvert
- [ ] Projet `ewlozuwvrteopotfizcr` sélectionné
- [ ] Edge Functions → `stripe-webhooks` ouvert
- [ ] Option "Verify JWT" trouvée
- [ ] "Verify JWT" désactivé OU "Public Access" activé
- [ ] Changements sauvegardés
- [ ] Test dans le navigateur (pas de 401)
- [ ] Test avec Stripe Dashboard (statut 200 OK)

---

## 🎯 RÉSULTAT ATTENDU

Une fois configuré :

✅ Les webhooks Stripe sont reçus sans erreur 401
✅ Le workflow de création d'entreprise fonctionne complètement
✅ Les factures et abonnements sont créés automatiquement
✅ Le workflow ne reste plus bloqué à 40%

---

**💡 Si vous avez besoin d'aide, n'hésitez pas à me dire où vous en êtes dans le Dashboard !**

