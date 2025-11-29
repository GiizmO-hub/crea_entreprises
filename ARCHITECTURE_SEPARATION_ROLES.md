# 🏗️ ARCHITECTURE : SÉPARATION DES RÔLES

## 📋 PROBLÈME ACTUEL
- Un seul fichier `Entreprises.tsx` gère deux cas d'usage différents
- Logique complexe avec beaucoup de conditions (`if (isClient)`, `if (isSuperAdmin)`)
- Risques de conflits et de bugs
- Code difficile à maintenir

## ✅ SOLUTION PROPOSÉE

### Structure des fichiers :

```
src/pages/
├── Entreprises.tsx                    # 🔀 Routeur/Container (logique de routage)
└── entreprises/
    ├── EntreprisesPlateforme.tsx      # 👑 Gestion plateforme (Super Admin)
    └── EntrepriseClient.tsx           # 👤 Vue client (client_super_admin)
```

### Responsabilités :

#### 1. `Entreprises.tsx` (Routeur)
- ✅ Détermine le rôle de l'utilisateur
- ✅ Route vers le bon composant
- ✅ Gestion des états de chargement initiaux
- ❌ PAS de logique métier spécifique

#### 2. `EntreprisesPlateforme.tsx` (Plateforme)
- ✅ Gestion complète des entreprises
- ✅ Création, modification, suppression
- ✅ Liste de toutes les entreprises
- ✅ Formulaires de création
- ❌ PAS de logique client

#### 3. `EntrepriseClient.tsx` (Client)
- ✅ Affichage de l'entreprise du client
- ✅ Gestion des membres de l'équipe
- ✅ Informations de l'entreprise (lecture seule partiellement)
- ❌ PAS de création d'entreprise
- ❌ PAS d'accès aux autres entreprises

## 🎯 AVANTAGES

1. ✅ **Séparation claire** : Chaque fichier a une responsabilité unique
2. ✅ **Pas de conflits** : Logique isolée pour chaque rôle
3. ✅ **Maintenance facilitée** : Modifications indépendantes
4. ✅ **Tests plus faciles** : Tests séparés pour chaque rôle
5. ✅ **Performance** : Code splitting naturel (lazy loading possible)
6. ✅ **Lisibilité** : Code plus clair et compréhensible

## 📝 LOGIQUE DE ROUTAGE

```typescript
// Entreprises.tsx (Routeur)
function Entreprises() {
  const { user } = useAuth();
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérification simple : a-t-il un espace_membre_client ?
    checkRole();
  }, [user]);

  if (loading) return <Loading />;
  if (isClient === true) return <EntrepriseClient />;
  if (isClient === false) return <EntreprisesPlateforme />;
  return <Loading />;
}
```

## 🚀 PROCHAINES ÉTAPES

1. ✅ Créer `EntreprisesPlateforme.tsx` (extraire la logique plateforme)
2. ✅ Créer `EntrepriseClient.tsx` (extraire la logique client)
3. ✅ Refactoriser `Entreprises.tsx` en routeur simple
4. ✅ Tester chaque composant indépendamment

