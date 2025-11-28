# 📁 EXPLICATION : POURQUOI CERTAINS FICHIERS SONT AU ROOT

## 🔍 DIFFÉRENCE ENTRE ROOT ET MIGRATIONS/

### ✅ `/supabase/migrations/` = **MIGRATIONS PERMANENTES**
- **169 migrations** organisées chronologiquement
- Format : `YYYYMMDDHHMMSS_description.sql`
- **Versionnées dans Git**
- **Appliquées automatiquement** par Supabase CLI
- **Historique complet** de votre base de données

**Pourquoi ici ?**
→ Structure officielle Supabase pour les migrations
→ Ordre chronologique garanti
→ Traçabilité complète

---

### ⚠️ `/ROOT/*.sql` = **FICHIERS TEMPORAIRES**
- **32 fichiers SQL** créés pour corrections urgentes
- Pas de nommage chronologique
- **Appliqués manuellement** via Dashboard
- **Pas versionnés** (doublons de migrations)

**Pourquoi ici ?**
→ Corrections rapides pendant le développement
→ Fichiers créés pour vous permettre d'appliquer manuellement
→ Duplication avec les vraies migrations

---

## 📋 TYPES DE FICHIERS AU ROOT

### 1. **APPLY_*.sql** (12 fichiers)
→ Copies des migrations pour application manuelle
→ **DOUBLONS** des migrations existantes

### 2. **FIX_*.sql** (8 fichiers)
→ Corrections rapides
→ La plupart sont déjà dans les migrations

### 3. **TEST_*.sql** (5 fichiers)
→ Scripts de test temporaires
→ **À archiver**

### 4. **DIAGNOSTIC_*.sql** (2 fichiers)
→ Scripts de diagnostic
→ **À archiver**

### 5. **CLEANUP_*.sql** (1 fichier)
→ Scripts de nettoyage ponctuels
→ **À archiver**

---

## ✅ SOLUTION : RANGEMENT PROPOSÉ

```
votre-projet/
├── supabase/
│   └── migrations/          ← SEULEMENT LES VRAIES MIGRATIONS (169)
├── archive/
│   ├── temp-sql/           ← Fichiers SQL temporaires du root (32)
│   └── temp-docs/          ← Fichiers Markdown temporaires (90+)
├── README.md               ← Seul MD au root
└── [autres fichiers normaux]
```

---

## 🎯 RÈGLES

### ✅ **DOIT être dans `migrations/`** :
- Toute modification de schéma de base de données
- Création/modification de tables, fonctions, triggers
- Toute correction permanente

### ✅ **PEUT être au root (temporairement)** :
- Scripts de test ponctuels
- Diagnostics rapides
- **MAIS** → Les archiver après utilisation

### ❌ **NE JAMAIS** :
- Dupliquer une migration au root
- Garder des fichiers de test au root
- Oublier de créer une vraie migration après un fix manuel

---

## 💡 VOTRE CAS

**Problème actuel :**
- 32 fichiers SQL au root = **confusion**
- Beaucoup sont des doublons de migrations
- Difficile de savoir quel fichier appliquer

**Solution :**
1. ✅ Vérifier si chaque fichier root a sa migration correspondante
2. ✅ Archiver les fichiers temporaires dans `archive/`
3. ✅ Garder seulement les migrations dans `migrations/`

---

## 📊 STATISTIQUES

- **Migrations officielles** : 169 ✅
- **Fichiers SQL root** : 32 ⚠️ (à archiver)
- **Fichiers MD root** : 90+ ⚠️ (à archiver)

