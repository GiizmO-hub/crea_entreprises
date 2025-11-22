# 🚀 Crea+Entreprises - Application SaaS de Gestion d'Entreprise

Application SaaS complète de gestion d'entreprise avec React, TypeScript, Vite et Supabase.

---

## ✨ Fonctionnalités Actuelles

- ✅ **Authentification Supabase** (connexion/inscription)
- ✅ **Dashboard de base** (structure prête)
- ✅ **Interface moderne** avec Tailwind CSS

---

## 🛠️ Technologies

- **Frontend:** React 19 + TypeScript + Vite 7
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Styling:** Tailwind CSS 3
- **Icons:** Lucide React

---

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp ENV_EXAMPLE.txt .env
# Éditer .env avec vos clés Supabase

# Lancer le serveur de développement
npm run dev
```

---

## 🔐 Variables d'environnement

Créer un fichier `.env` à la racine :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon
```

---

## 📁 Structure du Projet

```
src/
├── components/     # Composants React (à créer)
├── contexts/       # Contextes React (AuthContext ✅)
├── hooks/          # Hooks personnalisés (à créer)
├── lib/            # Utilitaires (supabase.ts ✅)
├── pages/          # Pages (Auth ✅, Dashboard ✅)
├── App.tsx         # Composant principal ✅
└── main.tsx        # Point d'entrée ✅
```

---

## 📝 Scripts disponibles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run preview      # Prévisualisation du build
npm run lint         # Linter ESLint
npm run typecheck    # Vérification TypeScript
```

---

## 🚀 Déploiement

### Vercel
Le projet est prêt pour Vercel.

**Variables d'environnement à configurer sur Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 📄 Documentation

- Documentation complète à venir
- Cahier des charges à créer
- Plan d'action 30 jours à créer

---

## 🔒 Sécurité

- ✅ Row Level Security (RLS) sur Supabase (à configurer)
- ✅ Authentification sécurisée avec Supabase Auth
- ✅ Types TypeScript stricts
- ✅ Variables d'environnement sécurisées

---

## 📄 Licence

Projet privé et propriétaire.

---

**Version:** 1.0.0  
**Dernière mise à jour:** 2025-01-22
