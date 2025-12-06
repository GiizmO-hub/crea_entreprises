# 📱 GUIDE DE PUBLICATION - App Store & Google Play

## 🎯 Vue d'ensemble

Votre application **Crea+Entreprises** est actuellement une **application web React/TypeScript**. Pour la publier sur l'App Store (iOS) et Google Play (Android), vous avez plusieurs options.

---

## 🛠️ OPTIONS DISPONIBLES

### Option 1 : **Capacitor** ⭐ **RECOMMANDÉ**
Transformer votre app React existante en application mobile native.

### Option 2 : **Progressive Web App (PWA)**
Rendre l'app installable, mais pas vraiment "dans" les stores.

### Option 3 : **React Native**
Réécrire l'application en React Native (beaucoup de travail).

### Option 4 : **Flutter**
Réécrire l'application en Flutter (beaucoup de travail).

---

## 🚀 OPTION 1 : CAPACITOR (Recommandé)

### ✅ Avantages
- ✅ Réutilise 95% de votre code React existant
- ✅ Accès aux fonctionnalités natives (caméra, notifications, etc.)
- ✅ Publie sur iOS ET Android avec le même code
- ✅ Performance native
- ✅ Intégration facile avec Supabase

### 📦 Installation

```bash
# 1. Installer Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# 2. Initialiser Capacitor
npx cap init "Crea+Entreprises" "com.crea.entreprises"

# 3. Ajouter les plateformes
npx cap add ios
npx cap add android

# 4. Configurer les chemins dans capacitor.config.ts
```

### 📝 Configuration

Créer `capacitor.config.ts` à la racine :

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crea.entreprises',
  appName: 'Crea+Entreprises',
  webDir: 'dist',
  server: {
    // En développement, pointez vers votre serveur local
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6366f1',
    },
  },
};

export default config;
```

### 🔧 Modifications nécessaires

1. **Mettre à jour `vite.config.ts`** :

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Important pour Capacitor
  build: {
    outDir: 'dist',
    // ... votre config existante
  },
});
```

2. **Mettre à jour `index.html`** :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Crea+Entreprises</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 📱 Build et déploiement

```bash
# 1. Build de l'application web
npm run build

# 2. Synchroniser avec les plateformes natives
npx cap sync

# 3. Ouvrir dans les IDE natifs
npx cap open ios      # Ouvre Xcode
npx cap open android  # Ouvre Android Studio
```

---

## 📲 PUBLICATION SUR L'APP STORE (iOS)

### Prérequis
- **Compte développeur Apple** : 99 $/an
- **Mac** avec Xcode installé
- **Certificats de développement** configurés

### Étapes

1. **Préparer l'application dans Xcode** :
   ```bash
   npx cap open ios
   ```

2. **Configurer l'identité** :
   - Sélectionner votre équipe de développement
   - Configurer le Bundle Identifier : `com.crea.entreprises`

3. **Créer les icônes et splash screens** :
   - Icône : 1024x1024 px (PNG)
   - Splash screens : Plusieurs tailles requises

4. **Tester sur un appareil** :
   - Connecter un iPhone/iPad
   - Sélectionner l'appareil dans Xcode
   - Cliquer sur "Run"

5. **Archiver l'application** :
   - Product → Archive
   - Distribuer l'app

6. **Soumission à l'App Store** :
   - Utiliser App Store Connect
   - Remplir les métadonnées (description, screenshots, etc.)
   - Soumettre pour review

### Coûts
- **Compte développeur Apple** : **99 $/an** (obligatoire)

### Délais
- **Review Apple** : 1-7 jours en moyenne

---

## 🤖 PUBLICATION SUR GOOGLE PLAY (Android)

### Prérequis
- **Compte développeur Google** : 25 $ (paiement unique)
- **Android Studio** installé
- **Clé de signature** générée

### Étapes

1. **Préparer l'application dans Android Studio** :
   ```bash
   npx cap open android
   ```

2. **Configurer le package name** :
   - Dans `android/app/build.gradle` : `applicationId "com.crea.entreprises"`

3. **Générer la clé de signature** :
   ```bash
   keytool -genkey -v -keystore crea-entreprises-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias crea-entreprises
   ```

4. **Configurer le signing** :
   - Créer `android/key.properties` :
   ```properties
   storePassword=your-store-password
   keyPassword=your-key-password
   keyAlias=crea-entreprises
   storeFile=../crea-entreprises-key.jks
   ```

5. **Build l'APK/AAB** :
   ```bash
   cd android
   ./gradlew bundleRelease  # Pour AAB (recommandé)
   # ou
   ./gradlew assembleRelease  # Pour APK
   ```

6. **Soumission à Google Play** :
   - Créer un compte développeur sur Google Play Console
   - Créer une nouvelle application
   - Uploader l'AAB
   - Remplir les métadonnées
   - Soumettre pour review

### Coûts
- **Compte développeur Google** : **25 $** (paiement unique)

### Délais
- **Review Google** : 1-3 jours en moyenne

---

## 🎨 ASSETS REQUIS

### iOS (App Store)

1. **Icône** :
   - 1024x1024 px (PNG, sans transparence)
   - Format : PNG

2. **Screenshots** :
   - iPhone 6.7" : 1290x2796 px
   - iPhone 6.5" : 1284x2778 px
   - iPhone 5.5" : 1242x2208 px
   - iPad Pro 12.9" : 2048x2732 px
   - Minimum 3 screenshots par taille

3. **Splash screens** :
   - Plusieurs tailles (générés automatiquement par Capacitor)

### Android (Google Play)

1. **Icône** :
   - 512x512 px (PNG)
   - Format : PNG

2. **Screenshots** :
   - Téléphone : 1080x1920 px minimum
   - Tablette : 1200x1920 px minimum
   - Minimum 2 screenshots

3. **Feature Graphic** :
   - 1024x500 px (PNG)

---

## 🔐 CONFIGURATION SUPABASE POUR MOBILE

### Variables d'environnement

Dans votre app Capacitor, vous devrez gérer les variables d'environnement différemment :

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = Capacitor.isNativePlatform()
  ? 'https://votre-projet.supabase.co'  // Hardcodé pour mobile
  : import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = Capacitor.isNativePlatform()
  ? 'votre_cle_anon'  // Hardcodé pour mobile
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**⚠️ Sécurité** : Pour la production, utilisez plutôt des variables d'environnement natives ou un fichier de configuration sécurisé.

---

## 📦 PLUGINS CAPACITOR UTILES

```bash
# Notifications push
npm install @capacitor/push-notifications

# Caméra
npm install @capacitor/camera

# Stockage local
npm install @capacitor/preferences

# Partage
npm install @capacitor/share

# Réseau
npm install @capacitor/network

# Appareil
npm install @capacitor/device
```

---

## 🚨 PROBLÈMES COURANTS

### 1. **Erreur CORS avec Supabase**
**Solution** : Configurer les domaines autorisés dans Supabase Dashboard → Authentication → URL Configuration

### 2. **Build échoue sur Android**
**Solution** : Vérifier que Java JDK 17+ est installé et configuré

### 3. **App ne se connecte pas à Supabase**
**Solution** : Vérifier que les variables d'environnement sont correctement configurées pour mobile

### 4. **Icônes/Splash screens manquants**
**Solution** : Utiliser `npx cap-assets` pour générer automatiquement tous les assets

---

## 💰 COÛTS TOTAUX

### Développement
- **Capacitor** : Gratuit (open source)
- **Plugins Capacitor** : Gratuits (open source)

### Publication
- **App Store (iOS)** : 99 $/an
- **Google Play (Android)** : 25 $ (paiement unique)

### Total première année
- **iOS + Android** : 124 $ (99 $ + 25 $)
- **Années suivantes** : 99 $/an (iOS uniquement)

---

## 📋 CHECKLIST DE PUBLICATION

### Avant de publier

- [ ] Application testée sur appareils réels (iOS et Android)
- [ ] Tous les assets (icônes, screenshots) préparés
- [ ] Politique de confidentialité créée
- [ ] Description de l'app rédigée
- [ ] Mots-clés définis
- [ ] Support client configuré
- [ ] Version de l'app définie
- [ ] Certificats de signature configurés

### iOS spécifique

- [ ] Compte développeur Apple actif
- [ ] Certificats de distribution créés
- [ ] Provisioning profiles configurés
- [ ] App Store Connect configuré
- [ ] Screenshots pour toutes les tailles d'écran

### Android spécifique

- [ ] Compte développeur Google créé
- [ ] Clé de signature générée et sauvegardée
- [ ] AAB généré et signé
- [ ] Google Play Console configuré
- [ ] Screenshots pour téléphone et tablette

---

## 🎯 PROCHAINES ÉTAPES

1. **Installer Capacitor** :
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   ```

2. **Initialiser Capacitor** :
   ```bash
   npx cap init
   ```

3. **Configurer l'app** :
   - Modifier `capacitor.config.ts`
   - Mettre à jour `vite.config.ts`
   - Ajouter les assets

4. **Tester localement** :
   ```bash
   npm run build
   npx cap sync
   npx cap open ios
   npx cap open android
   ```

5. **Préparer la publication** :
   - Créer les comptes développeurs
   - Générer les assets
   - Tester sur appareils réels

---

## 📚 RESSOURCES

- **Documentation Capacitor** : https://capacitorjs.com/docs
- **App Store Connect** : https://appstoreconnect.apple.com
- **Google Play Console** : https://play.google.com/console
- **Guide Apple** : https://developer.apple.com/app-store/review/guidelines/
- **Guide Google** : https://play.google.com/about/developer-content-policy/

---

**Dernière mise à jour** : 2025-01-22

