# 📧 Configuration de l'Envoi d'Emails en Local

## 🎯 Objectif

Permettre l'envoi d'emails réels en environnement local pour tester la fonctionnalité complète.

## 📋 Options Disponibles

### ✅ Option 1 : Resend (Recommandé - Simple et Gratuit)

**Resend** est un service d'email moderne, simple à configurer et avec un plan gratuit généreux (3000 emails/mois).

#### Étapes de Configuration :

1. **Créer un compte Resend**
   - Aller sur https://resend.com
   - Créer un compte gratuit
   - Vérifier votre email

2. **Créer une API Key**
   - Dans le dashboard Resend, aller dans "API Keys"
   - Cliquer sur "Create API Key"
   - Donner un nom (ex: "Local Development")
   - Copier la clé API (commence par `re_...`)

3. **Configurer l'Email Expéditeur**
   - Dans Resend, aller dans "Domains"
   - Ajouter votre domaine (ou utiliser `onboarding@resend.dev` pour les tests)
   - Pour les tests locaux, vous pouvez utiliser `onboarding@resend.dev` (déjà configuré)

4. **Ajouter les variables d'environnement**

   Créer ou modifier le fichier `.env` à la racine du projet :

   ```bash
   # Email Configuration - Resend
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=onboarding@resend.dev
   
   # Ou avec votre propre domaine :
   # RESEND_FROM_EMAIL=noreply@votredomaine.com
   ```

5. **Configurer les secrets Supabase (pour Edge Functions)**

   Si vous utilisez Supabase localement, ajoutez les secrets dans Supabase CLI :

   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
   supabase secrets set RESEND_FROM_EMAIL=onboarding@resend.dev
   ```

   Ou via le dashboard Supabase :
   - Aller dans "Project Settings" > "Edge Functions" > "Secrets"
   - Ajouter `RESEND_API_KEY` et `RESEND_FROM_EMAIL`

6. **Tester l'envoi**

   - Lancer l'application : `npm run dev`
   - Créer un espace membre pour un client
   - Cliquer sur "Envoyer par Email"
   - L'email devrait être envoyé réellement !

---

### 🔧 Option 2 : Mode Simulation (Par Défaut en Local)

Si vous ne configurez pas Resend, l'application fonctionnera en mode simulation :

- ✅ Les emails sont générés avec le HTML professionnel
- ✅ Les logs affichent le contenu de l'email
- ✅ L'interface indique que l'email est "envoyé"
- ⚠️ Aucun email réel n'est envoyé (utile pour les tests)

---

### 📧 Option 3 : SMTP Local (Pour Tests Avancés)

Pour tester avec un serveur SMTP local (MailHog, MailCatcher, etc.) :

1. **Installer MailHog** (optionnel, pour capture des emails locaux)
   ```bash
   brew install mailhog  # macOS
   # ou télécharger depuis https://github.com/mailhog/MailHog
   ```

2. **Démarrer MailHog**
   ```bash
   mailhog
   ```
   Interface web disponible sur : http://localhost:8025

3. **Modifier la fonction pour utiliser SMTP**

   (Contactez-moi si vous souhaitez cette option configurée)

---

## 🧪 Tester l'Envoi d'Email

### En Mode Simulation (sans configuration) :

1. Lancer l'application : `npm run dev`
2. Créer un espace membre pour un client
3. Cliquer sur "Envoyer par Email"
4. Vérifier les logs dans la console pour voir le contenu de l'email

### Avec Resend Configuré :

1. Vérifier que `RESEND_API_KEY` est configuré
2. Lancer l'application : `npm run dev`
3. Créer un espace membre pour un client
4. Cliquer sur "Envoyer par Email"
5. Vérifier votre boîte email (et les spams si nécessaire)

---

## 🔍 Dépannage

### Email non reçu avec Resend :

1. ✅ Vérifier que `RESEND_API_KEY` est correctement configuré
2. ✅ Vérifier les logs de la console pour voir les erreurs
3. ✅ Vérifier le dossier spam de votre email
4. ✅ Vérifier que `RESEND_FROM_EMAIL` est configuré (utilisez `onboarding@resend.dev` pour les tests)
5. ✅ Aller dans le dashboard Resend > "Emails" pour voir les emails envoyés et leur statut

### Erreur "Service d'email non configuré" :

- En production : Configurer obligatoirement `RESEND_API_KEY`
- En local : L'application fonctionne en mode simulation par défaut

---

## 📝 Notes Importantes

- ⚠️ **En production**, `RESEND_API_KEY` doit être configuré pour envoyer des emails réels
- ✅ **En local**, le mode simulation fonctionne sans configuration
- 📧 Le template HTML de l'email est toujours généré, même en mode simulation
- 🔒 Les clés API doivent être stockées en variables d'environnement (jamais dans le code)

---

## 🚀 Prochaines Étapes

1. Configurer Resend avec votre clé API
2. Tester l'envoi d'email en local
3. Configurer votre propre domaine d'expéditeur (optionnel)
4. Déployer avec les secrets configurés en production




