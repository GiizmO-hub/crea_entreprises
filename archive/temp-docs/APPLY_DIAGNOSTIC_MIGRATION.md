# 🚀 APPLICATION DE LA MIGRATION DE DIAGNOSTIC

## ✅ Migration prête

**Fichier:** `supabase/migrations/20250123000038_diagnostic_workflow_complet.sql`

## 📋 INSTRUCTIONS RAPIDES (2 minutes)

### Méthode 1 : Via Supabase Dashboard (RECOMMANDÉ)

1. **Ouvrez Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Connectez-vous et sélectionnez votre projet

2. **Ouvrez le SQL Editor**
   - Dans le menu de gauche, cliquez sur **"SQL Editor"**
   - Cliquez sur **"New Query"** (en haut à droite)

3. **Ouvrez le fichier de migration**
   - Dans votre éditeur de code, ouvrez :
   - `supabase/migrations/20250123000038_diagnostic_workflow_complet.sql`
   - **Sélectionnez tout** (Cmd+A sur Mac / Ctrl+A sur Windows)
   - **Copiez** (Cmd+C / Ctrl+C)

4. **Collez dans Supabase**
   - Dans le SQL Editor de Supabase, **collez** (Cmd+V / Ctrl+V)
   - Vérifiez que tout le contenu est bien là (ça devrait faire ~550 lignes)

5. **Exécutez**
   - Cliquez sur le bouton **"Run"** en bas à droite
   - Ou appuyez sur **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows)

6. **Vérifiez le résultat**
   - Vous devriez voir des messages dans les logs
   - Le diagnostic s'affichera automatiquement

## ✅ Vérifier que ça a marché

Dans le SQL Editor, exécutez :

```sql
SELECT test_diagnostic_rapide();
```

Vous devriez voir un message comme :

```
📊 DIAGNOSTIC WORKFLOW COMPLET
═══════════════════════════════════════════════

✅ Fonctions: 7/7
✅ Triggers: 1/1
✅ Tables: 7/7

❌ Problèmes critiques: 0
⚠️  Avertissements: 0

✅ Tous les éléments critiques sont en place !
```

## 🔄 Prochaines étapes

Une fois la migration appliquée et le diagnostic exécuté :
1. Notez les problèmes trouvés (s'il y en a)
2. Partagez-les moi
3. Je créerai les corrections nécessaires

## 💡 Alternative : Méthode automatique (si vous avez DATABASE_URL)

Si vous avez le `DATABASE_URL` dans votre `.env`, vous pouvez utiliser :

```bash
node scripts/apply-migration-direct.mjs
```

**Pour obtenir DATABASE_URL :**
1. Supabase Dashboard → Settings → Database
2. Section "Connection string"
3. Copiez la "URI" (format: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`)
4. Ajoutez `DATABASE_URL=...` dans votre `.env`

---

**⚠️ Note :** La méthode Dashboard est la plus simple et la plus fiable !


