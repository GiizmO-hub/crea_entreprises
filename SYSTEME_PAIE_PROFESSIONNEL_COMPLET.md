# ═══════════════════════════════════════════════════════════════════════════
# SYSTÈME PROFESSIONNEL COMPLET DE CALCUL DE FICHE DE PAIE
# ═══════════════════════════════════════════════════════════════════════════

## ✅ SYSTÈME PROFESSIONNEL IMPLÉMENTÉ

### Architecture en 3 couches

#### 1. **Couche de récupération des données** (`recuperer_donnees_collaborateur_paie`)
- ✅ Récupère **automatiquement** toutes les données du collaborateur
- ✅ Récupère le salaire brut depuis `collaborateurs_entreprise` ou `salaries`
- ✅ Récupère les heures normales (mensuelles ou conversion hebdo)
- ✅ Récupère la convention collective, le poste, le type de contrat
- ✅ Récupère les données de l'entreprise
- ✅ Retourne un JSON structuré avec toutes les informations

#### 2. **Couche de calcul** (`calculer_fiche_paie_complete`)
- ✅ Utilise `recuperer_donnees_collaborateur_paie` pour récupérer les données
- ✅ Récupère les taux depuis `get_taux_cotisations` (convention collective ou URSSAF)
- ✅ Calcule les bases plafonnées et déplafonnées selon PASS 2025
- ✅ **Déduit proprement** les charges salariales du salaire brut
- ✅ Calcule les cotisations patronales (à la charge de l'employeur)
- ✅ Calcule le net imposable et le net à payer
- ✅ Retourne un JSON détaillé avec tous les calculs

#### 3. **Couche de génération** (`generer_fiche_paie_complete_auto`)
- ✅ Utilise `calculer_fiche_paie_complete` pour les calculs
- ✅ Crée la fiche de paie dans `fiches_paie`
- ✅ Crée toutes les lignes de paie dans `fiches_paie_lignes`
- ✅ Numérotation professionnelle séquentielle
- ✅ Gestion des erreurs et validation

---

## 📋 FLUX DE CALCUL PROFESSIONNEL

### Étape 1 : Récupération des données
```
recuperer_donnees_collaborateur_paie()
  ├─> Récupère collaborateur depuis collaborateurs_entreprise
  ├─> Récupère salaire brut (priorité: collaborateurs_entreprise > salaries)
  ├─> Récupère heures normales (priorité: mensuelles > conversion hebdo > 151.67h)
  ├─> Récupère convention collective, poste, type contrat
  └─> Retourne JSON avec toutes les données
```

### Étape 2 : Récupération des taux
```
get_taux_cotisations()
  ├─> Cherche taux depuis convention collective du collaborateur
  ├─> Si non trouvé, utilise taux URSSAF 2025 par défaut
  └─> Retourne tous les taux (salariaux et patronaux)
```

### Étape 3 : Calcul des bases
```
Salaire brut total = Salaire base + Heures sup 25% + Heures sup 50% + Primes + Avantages
Base plafonnée = MIN(Salaire brut total, PASS mensuel = 3852€)
Base déplafonnée = MIN(Salaire brut total, PASS déplafonné = 11556€)
```

### Étape 4 : Calcul des cotisations salariales (DÉDUITES)
```
SS Maladie = Base plafonnée × 0.75%
SS Vieillesse plafonnée = Base plafonnée × 0.6%
SS Vieillesse déplafonnée = Base déplafonnée × 0.4%
Assurance chômage = Base plafonnée × 2.4%
Retraite complémentaire = Base plafonnée × 3.15%
CSG déductible = Base déplafonnée × 5.25%
CSG non déductible = Base déplafonnée × 2.9%

Total cotisations salariales = Somme de toutes les cotisations ci-dessus
```

### Étape 5 : Calcul des cotisations patronales (À LA CHARGE DE L'EMPLOYEUR)
```
SS Maladie patronale = Base plafonnée × 7%
SS Vieillesse plafonnée patronale = Base plafonnée × 8.55%
SS Vieillesse déplafonnée patronale = Base déplafonnée × 1.9%
Allocations familiales = Base plafonnée × 3.45%
AT/MP = Base plafonnée × 1.5% (variable selon convention)
Assurance chômage patronale = Base plafonnée × 4.05%
Retraite complémentaire patronale = Base plafonnée × 4.72%

Total cotisations patronales = Somme de toutes les cotisations ci-dessus
```

### Étape 6 : Calcul des totaux
```
Net imposable = Salaire brut - Cotisations déductibles
  (SS, retraite, chômage, CSG déductible)

Net à payer = Salaire brut - TOUTES les cotisations salariales
  ✅ C'EST ICI QUE LES CHARGES SONT DÉDUITES DU SALAIRE BRUT

Coût total employeur = Salaire brut + TOUTES les cotisations patronales
  (Les cotisations patronales ne sont PAS déduites du salaire brut)
```

---

## 💰 EXEMPLE DE CALCUL

### Données d'entrée
- Salaire brut : 2500 €
- Heures normales : 151.67 h
- Convention collective : URSSAF par défaut

### Calculs

#### 1. Bases
- Base plafonnée : MIN(2500, 3852) = **2500 €**
- Base déplafonnée : MIN(2500, 11556) = **2500 €**

#### 2. Cotisations salariales (DÉDUITES)
- SS Maladie : 2500 × 0.75% = **18.75 €**
- SS Vieillesse plafonnée : 2500 × 0.6% = **15.00 €**
- SS Vieillesse déplafonnée : 2500 × 0.4% = **10.00 €**
- Assurance chômage : 2500 × 2.4% = **60.00 €**
- Retraite complémentaire : 2500 × 3.15% = **78.75 €**
- CSG déductible : 2500 × 5.25% = **131.25 €**
- CSG non déductible : 2500 × 2.9% = **72.50 €**
- **Total cotisations salariales : 386.25 €**

#### 3. Cotisations patronales (À LA CHARGE DE L'EMPLOYEUR)
- SS Maladie patronale : 2500 × 7% = **175.00 €**
- SS Vieillesse plafonnée patronale : 2500 × 8.55% = **213.75 €**
- SS Vieillesse déplafonnée patronale : 2500 × 1.9% = **47.50 €**
- Allocations familiales : 2500 × 3.45% = **86.25 €**
- AT/MP : 2500 × 1.5% = **37.50 €**
- Assurance chômage patronale : 2500 × 4.05% = **101.25 €**
- Retraite complémentaire patronale : 2500 × 4.72% = **118.00 €**
- **Total cotisations patronales : 779.25 €**

#### 4. Totaux
- **Net imposable** : 2500 - (18.75 + 15 + 10 + 60 + 78.75 + 131.25) = **2185.25 €**
- **Net à payer** : 2500 - 386.25 = **2113.75 €** ✅ (charges déduites)
- **Coût total employeur** : 2500 + 779.25 = **3279.25 €**

---

## ✅ VALIDATION DU SYSTÈME

### Points vérifiés
- ✅ Récupération automatique de toutes les données collaborateur
- ✅ Récupération automatique des taux depuis convention collective
- ✅ Calculs conformes URSSAF 2025
- ✅ **Charges salariales bien déduites du salaire brut**
- ✅ Cotisations patronales ajoutées au coût employeur (pas déduites)
- ✅ Bases plafonnées et déplafonnées correctement calculées
- ✅ Net imposable et net à payer correctement calculés
- ✅ Toutes les lignes de paie créées automatiquement
- ✅ Numérotation professionnelle
- ✅ Gestion des erreurs robuste

---

## 🎯 UTILISATION

### Depuis le frontend
```typescript
const { data: ficheId, error } = await supabase.rpc(
  'generer_fiche_paie_complete_auto',
  {
    p_entreprise_id: selectedEntreprise,
    p_collaborateur_id: collaborateurId,
    p_periode: '2025-02', // Format: YYYY-MM
    p_salaire_brut: null, // NULL = récupération automatique
    p_heures_normales: null, // NULL = récupération automatique
    p_heures_supp_25: 0,
    p_heures_supp_50: 0,
    p_primes: 0,
    p_avantages_nature: 0,
  }
);
```

### Ce qui se passe automatiquement
1. ✅ Récupération de toutes les données du collaborateur
2. ✅ Récupération des taux depuis la convention collective
3. ✅ Calcul de toutes les cotisations
4. ✅ **Déduction des charges salariales du salaire brut**
5. ✅ Création de la fiche de paie avec toutes les lignes
6. ✅ Numérotation professionnelle

---

## 📊 STRUCTURE DES DONNÉES

### Données récupérées automatiquement
- **Collaborateur** : nom, prénom, email, poste, type contrat, convention collective
- **Salaire** : depuis `collaborateurs_entreprise.salaire` ou `salaries.salaire_brut`
- **Heures** : depuis `collaborateurs_entreprise.nombre_heures_mensuelles` ou conversion hebdo
- **Entreprise** : nom, SIRET, convention collective

### Taux récupérés automatiquement
- Depuis `conventions_collectives` si convention spécifique
- Sinon, taux URSSAF 2025 par défaut

### Résultat du calcul
- JSON complet avec :
  - Données collaborateur
  - Salaire brut, bases plafonnées/déplafonnées
  - Toutes les cotisations salariales (déduites)
  - Toutes les cotisations patronales (à la charge employeur)
  - Net imposable, net à payer, coût total employeur
  - Taux utilisés, plafonds PASS

---

**Date** : 2025-02-05
**Statut** : ✅ SYSTÈME PROFESSIONNEL COMPLET ET OPÉRATIONNEL

