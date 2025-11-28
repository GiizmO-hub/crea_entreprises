# 📋 Guide : Comment Récupérer la SERVICE_ROLE_KEY

## 🎯 Méthode 1 : Dashboard Supabase (RECOMMANDÉE)

### Étapes détaillées :

1. **Ouvrez votre projet Supabase :**
   - URL directe : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/settings/api

2. **Dans la page Settings → API :**
   - Vous verrez une section **"Project API keys"**
   - Il y a deux clés :
     - `anon` `public` - Clé publique (sûre pour le frontend)
     - `service_role` `secret` - Clé secrète (⚠️ NE JAMAIS EXPOSER)

3. **Récupérer la service_role key :**
   - Trouvez la ligne avec **"service_role"** et **"secret"**
   - Cliquez sur l'icône **"Reveal"** (œil 👁️) pour révéler la clé
   - Copiez la clé complète (elle commence par `eyJ...`)

4. **⚠️ SÉCURITÉ IMPORTANTE :**
   - Cette clé donne **accès complet** à votre base de données
   - Ne la partagez JAMAIS publiquement
   - Ne la commitez JAMAIS dans Git
   - Utilisez-la uniquement pour les scripts de test en local

---

## 🚀 Utilisation

Une fois récupérée, vous pouvez l'utiliser de deux façons :

### Option 1 : Variable d'environnement (recommandé)

```bash
export SUPABASE_SERVICE_ROLE_KEY="votre_cle_ici"
node scripts/test-workflow-via-api.mjs
```

### Option 2 : Ajouter au fichier .env (⚠️ ne pas commiter)

Créez ou modifiez le fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://ewlozuwvrteopotfizcr.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

Puis utilisez :

```bash
node scripts/test-workflow-via-api.mjs
```

---

## 📝 Alternative : Utiliser le Script SQL

Si vous préférez ne pas utiliser la SERVICE_ROLE_KEY, vous pouvez tester directement avec le script SQL :

**Fichier :** `APPLY_AND_TEST_NOW.sql`

1. Ouvrez : https://supabase.com/dashboard/project/ewlozuwvrteopotfizcr/sql/new
2. Ouvrez le fichier : `APPLY_AND_TEST_NOW.sql`
3. Copiez tout et exécutez

Cette méthode ne nécessite pas de SERVICE_ROLE_KEY car vous êtes déjà authentifié dans le Dashboard.

---

## 🔍 Vérification

Pour vérifier que votre clé fonctionne, testez :

```bash
export SUPABASE_SERVICE_ROLE_KEY="votre_cle"
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ewlozuwvrteopotfizcr.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('paiements').select('count').then(r => console.log('✅ Clé valide !', r));
"
```

---

## 💡 Emplacement dans le Dashboard

```
Supabase Dashboard
└── Votre Projet (ewlozuwvrteopotfizcr)
    └── Settings (⚙️)
        └── API
            └── Project API keys
                ├── anon public (clé publique)
                └── service_role secret (👁️ Cliquez pour révéler)
```

---

**📌 Note :** La SERVICE_ROLE_KEY est différente du mot de passe PostgreSQL. Elle est utilisée pour l'API REST Supabase, tandis que le mot de passe PostgreSQL est utilisé pour les connexions directes à la base de données.

