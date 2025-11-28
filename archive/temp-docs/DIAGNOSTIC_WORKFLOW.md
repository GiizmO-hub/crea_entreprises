# 🔍 DIAGNOSTIC COMPLET DU WORKFLOW

## ❌ PROBLÈMES IDENTIFIÉS

### 1. Workflow Carte Bancaire
- ✅ `PaymentChoiceModal` appelle Edge Function `create-stripe-checkout`
- ❌ Edge Function `create-stripe-checkout` **N'EXISTE PAS** dans le projet
- ⚠️ `PaymentSuccess.tsx` appelle `valider_paiement_carte_immediat` en fallback
- ❓ Webhook Stripe ne semble pas appeler la validation du paiement

### 2. Fonctions RPC Manquantes/Problématiques
- ✅ `create_complete_entreprise_automated` - EXISTE
- ✅ `valider_paiement_carte_immediat` - EXISTE
- ✅ `choisir_paiement_virement` - EXISTE
- ✅ `creer_facture_et_abonnement_apres_paiement` - EXISTE
- ✅ `finaliser_creation_apres_paiement` - EXISTE

### 3. Triggers
- ✅ `trigger_creer_facture_abonnement_apres_paiement` - EXISTE
- ⚠️ Trigger se déclenche quand statut passe à 'paye'
- ❓ Vérifier que le trigger est bien activé en base

### 4. Flux de Données
- ✅ `create_complete_entreprise_automated` crée le paiement avec `notes` JSON contenant plan_id
- ✅ Le paiement est créé avec statut 'en_attente'
- ❓ La validation du paiement met le statut à 'paye' correctement ?
- ❓ Le trigger se déclenche-t-il vraiment ?

## 🔄 WORKFLOW ATTENDU

### Carte Bancaire :
1. User crée entreprise → `create_complete_entreprise_automated` → Crée paiement 'en_attente'
2. `PaymentChoiceModal` → Appelle Edge Function `create-stripe-checkout` → Redirige vers Stripe
3. User paie sur Stripe
4. **PROBLÈME** : Pas d'Edge Function `create-stripe-checkout`
5. Retour sur `PaymentSuccess.tsx`
6. `PaymentSuccess` appelle `valider_paiement_carte_immediat` → Met statut à 'paye'
7. **Trigger** → `trigger_creer_facture_abonnement_apres_paiement` → Appelle `creer_facture_et_abonnement_apres_paiement`
8. `creer_facture_et_abonnement_apres_paiement` → Crée facture + appelle `finaliser_creation_apres_paiement` → Crée abonnement

### Virement :
1. User crée entreprise → `create_complete_entreprise_automated` → Crée paiement 'en_attente'
2. `PaymentChoiceModal` → User choisit virement → Appelle `choisir_paiement_virement`
3. `choisir_paiement_virement` → Met statut à 'en_attente_validation'
4. **PROBLÈME** : Pas de mécanisme de validation manuelle par l'équipe
5. Après validation manuelle → Appeler `valider_paiement_virement_manuel`
6. **Trigger** → Même workflow que carte

## 🛠️ ACTIONS NÉCESSAIRES

### CRITIQUE :
1. **Créer l'Edge Function `create-stripe-checkout`** ou modifier le flux pour ne pas l'utiliser
2. **Vérifier que le trigger est actif** en base de données
3. **Tester chaque étape** du workflow individuellement

### IMPORTANT :
4. Créer une interface pour valider manuellement les virements
5. Améliorer les logs pour diagnostiquer les problèmes
6. Ajouter des vérifications de cohérence dans les fonctions

### AMÉLIORATION :
7. Ajouter des notifications utilisateur à chaque étape
8. Améliorer la gestion d'erreurs
9. Ajouter des retry automatiques


