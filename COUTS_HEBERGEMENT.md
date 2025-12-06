# 💰 COÛTS D'HÉBERGEMENT - Crea+Entreprises

## 📊 Vue d'ensemble

Cette application SaaS utilise plusieurs services cloud pour son fonctionnement. Voici le détail des coûts estimés.

---

## 🛠️ Services utilisés

### 1. **Supabase** (Backend principal)
- **Base de données PostgreSQL**
- **Authentification**
- **Stockage de fichiers**
- **Edge Functions**
- **Row Level Security (RLS)**

### 2. **Vercel** (Hébergement Frontend)
- **Déploiement React/TypeScript**
- **CDN global**
- **SSL automatique**

### 3. **Stripe** (Paiements)
- **Gestion des paiements**
- **Webhooks**
- **Abonnements récurrents**

---

## 💵 DÉTAIL DES COÛTS

### 📦 **SUPABASE**

#### Plan Gratuit (Free Tier)
- ✅ **0 €/mois**
- **Limites :**
  - 500 MB base de données
  - 1 GB stockage fichiers
  - 2 GB bande passante
  - 50 000 utilisateurs actifs/mois
  - 2 millions d'invocations Edge Functions/mois
  - 500 MB transfert de données/mois

**⚠️ Limites pour une application SaaS :**
- Base de données : **500 MB** (limite rapidement atteinte avec plusieurs entreprises)
- Stockage : **1 GB** (limite pour les documents/factures)
- Bande passante : **2 GB** (limite pour le trafic)

#### Plan Pro
- 💰 **25 $/mois** (~23 €/mois)
- **Limites :**
  - 8 GB base de données
  - 100 GB stockage fichiers
  - 250 GB bande passante
  - 100 000 utilisateurs actifs/mois
  - 2 millions d'invocations Edge Functions/mois
  - 50 GB transfert de données/mois

#### Plan Team
- 💰 **599 $/mois** (~550 €/mois)
- **Limites :**
  - 32 GB base de données
  - 1 TB stockage fichiers
  - 1 TB bande passante
  - Utilisateurs illimités
  - 5 millions d'invocations Edge Functions/mois
  - 200 GB transfert de données/mois

**📈 Coûts additionnels Supabase :**
- **Dépassement base de données** : 0.125 $/GB/mois
- **Dépassement stockage** : 0.021 $/GB/mois
- **Dépassement bande passante** : 0.09 $/GB/mois

---

### 🚀 **VERCEL**

#### Plan Gratuit (Hobby)
- ✅ **0 €/mois**
- **Limites :**
  - 100 GB bande passante/mois
  - Builds illimités
  - Déploiements illimités
  - SSL automatique
  - CDN global

**⚠️ Limites :**
- Bande passante : **100 GB/mois** (limite pour le trafic)

#### Plan Pro
- 💰 **20 $/mois** (~18 €/mois) par utilisateur
- **Limites :**
  - 1 TB bande passante/mois
  - Builds illimités
  - Déploiements illimités
  - Analytics avancés
  - Support prioritaire

**📈 Coûts additionnels Vercel :**
- **Dépassement bande passante** : 0.40 $/GB

---

### 💳 **STRIPE**

#### Frais de transaction
- **Carte de crédit/débit** : 1.4% + 0.25 € par transaction (Europe)
- **Carte internationale** : 2.9% + 0.25 € par transaction
- **Prélèvement SEPA** : 0.8% + 0.25 € par transaction (max 2 €)

**Exemple de coûts :**
- Abonnement 50 €/mois : **0.95 €** de frais (1.4% + 0.25 €)
- Abonnement 100 €/mois : **1.65 €** de frais (1.4% + 0.25 €)
- Abonnement 200 €/mois : **3.05 €** de frais (1.4% + 0.25 €)

**💡 Note :** Les frais Stripe sont généralement répercutés sur le client ou inclus dans le prix.

---

## 📊 ESTIMATION DES COÛTS SELON L'USAGE

### 🟢 **Phase de démarrage (0-10 entreprises)**
- **Supabase** : Gratuit (0 €)
- **Vercel** : Gratuit (0 €)
- **Stripe** : Frais de transaction uniquement
- **Total mensuel** : **0 €** (hors frais Stripe)

### 🟡 **Phase de croissance (10-50 entreprises)**
- **Supabase Pro** : 25 $/mois (~23 €/mois)
- **Vercel Pro** : 20 $/mois (~18 €/mois)
- **Stripe** : Frais de transaction uniquement
- **Total mensuel** : **~41 €/mois** (hors frais Stripe)

### 🔴 **Phase de scale (50+ entreprises)**
- **Supabase Team** : 599 $/mois (~550 €/mois)
- **Vercel Pro** : 20 $/mois (~18 €/mois)
- **Stripe** : Frais de transaction uniquement
- **Total mensuel** : **~568 €/mois** (hors frais Stripe)

---

## 💡 RECOMMANDATIONS

### Pour démarrer
1. ✅ **Utiliser les plans gratuits** (Supabase Free + Vercel Hobby)
2. ✅ **Surveiller l'utilisation** des ressources
3. ✅ **Optimiser les requêtes** base de données
4. ✅ **Compresser les fichiers** stockés

### Quand passer au plan payant
- **Supabase Pro** : Quand vous dépassez 500 MB de base de données ou 1 GB de stockage
- **Vercel Pro** : Quand vous dépassez 100 GB de bande passante/mois

### Optimisation des coûts
1. **Base de données** :
   - Nettoyer les données anciennes
   - Archiver les données non utilisées
   - Optimiser les index

2. **Stockage** :
   - Compresser les PDFs
   - Supprimer les fichiers obsolètes
   - Utiliser un CDN pour les fichiers statiques

3. **Bande passante** :
   - Optimiser les images
   - Utiliser la mise en cache
   - Compresser les réponses API

---

## 📈 PROJECTION ANNUELLE

### Scénario conservateur (10-20 entreprises)
- **Année 1** : 0 € (plans gratuits)
- **Année 2** : ~500 €/an (Supabase Pro + Vercel Pro)
- **Total 2 ans** : **~500 €**

### Scénario optimiste (50+ entreprises)
- **Année 1** : ~500 € (plans gratuits puis payants)
- **Année 2** : ~6 800 €/an (Supabase Team + Vercel Pro)
- **Total 2 ans** : **~7 300 €**

---

## ⚠️ POINTS D'ATTENTION

1. **Supabase Free Tier** :
   - Limite de 500 MB base de données (rapidement atteinte)
   - Limite de 1 GB stockage (limite pour documents)
   - **Recommandation** : Passer au Pro dès 5-10 entreprises actives

2. **Vercel Free Tier** :
   - Limite de 100 GB bande passante/mois
   - **Recommandation** : Surveiller le trafic mensuel

3. **Stripe** :
   - Frais de transaction à prévoir dans le pricing
   - **Recommandation** : Inclure les frais dans le prix ou les répercuter

---

## 📝 CONCLUSION

**Coût minimum (démarrage)** : **0 €/mois** (plans gratuits)

**Coût recommandé (croissance)** : **~41 €/mois** (Supabase Pro + Vercel Pro)

**Coût scale (50+ entreprises)** : **~568 €/mois** (Supabase Team + Vercel Pro)

**💡 Astuce** : Commencez avec les plans gratuits et montez en gamme selon vos besoins réels.

---

**Dernière mise à jour** : 2025-01-22
**Source** : Documentation officielle Supabase, Vercel, Stripe (2025)

