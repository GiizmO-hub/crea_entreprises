# 🚀 Instructions Rapides - Application Migration de Logs

## ✅ Méthode Simple (Recommandée)

### 1. Ouvrir Supabase Dashboard
👉 https://app.supabase.com → Sélectionner votre projet

### 2. SQL Editor
👉 Menu gauche → **SQL Editor** → **New query**

### 3. Copier-Coller
👉 Ouvrir: `supabase/migrations/20250123000039_add_detailed_logs_workflow.sql`
👉 Tout sélectionner (Ctrl+A) → Copier (Ctrl+C)
👉 Coller dans SQL Editor (Ctrl+V)

### 4. Exécuter
👉 Cliquer sur **Run** (ou Ctrl+Enter)

### 5. Vérifier
👉 Vous devriez voir "Success" ou "Query executed successfully"

---

## 🎯 Après Application

Les logs seront automatiquement activés dans:
- ✅ `create_complete_entreprise_automated`
- ✅ `valider_paiement_carte_immediat`
- ✅ `creer_facture_et_abonnement_apres_paiement`
- ✅ `finaliser_creation_apres_paiement`
- ✅ `trigger_creer_facture_abonnement_apres_paiement`

---

## 📊 Voir les Logs

**Dashboard Supabase → Logs → Postgres Logs**

Filtrez par:
- Niveau: `NOTICE` ou `WARNING`
- Recherche: `[create_complete_entreprise_automated]`

---

✅ **C'est tout ! Les logs sont maintenant actifs.**
