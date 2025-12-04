## PRD – Plateforme Crea+Entreprises

### 1. Vision & objectifs

- **Objectif**: Plateforme SaaS tout‑en‑un pour TPE/PME permettant de gérer la création d’entreprise, les clients/CRM, la facturation, la comptabilité, la paie, les collaborateurs, les documents et les notifications.
- **Principes clés**:
  - Séparation stricte **plateforme** (administrateur) / **espaces clients**.
  - Automatisation maximale (workflow de création d’entreprise, factures d’abonnement, écritures comptables, paie…).
  - Un **fichier tampon** unique (`src/types/shared.ts`) pour tous les types partagés afin d’éviter les conflits entre modules.

---

### 2. Fichier tampon `src/types/shared.ts`

**Rôle critique**
- Source de vérité pour les types / interfaces partagés entre modules (`Entreprise`, `Client`, `Facture`, `FactureLigne`, `Avoir`, `ClientContact`, `Notification`, `ParametresDocuments`, etc.).
- Garantit la cohérence des données entre Facturation, Compta, CRM, Finances, etc.

**Règles d’utilisation**
- Tous les modules doivent **importer** leurs types partagés depuis `shared.ts`.
- Toute nouvelle donnée partagée (ex. nouveau champ dans `Entreprise` ou `Facture`) doit être ajoutée **d’abord** dans `shared.ts`, puis alignée en base et dans le front.
- Ne jamais dupliquer un type (ex. `Entreprise`, `Client`) dans un autre fichier.

---

### 3. Migrations – bonnes pratiques

- Avant chaque migration:
  - Analyser les migrations existantes qui touchent les mêmes tables / fonctions.
  - Vérifier la signature des fonctions déjà utilisées par le front (ex. `create_complete_entreprise_automated`).
  - Contrôler l’existence de colonnes / tables avant de créer ou modifier (`information_schema`).
- Écrire des migrations robustes:
  - Utiliser `DROP FUNCTION IF EXISTS ...` / `CREATE OR REPLACE FUNCTION`.
  - Pour les tables / colonnes: utiliser des blocs `DO $$ BEGIN IF NOT EXISTS ... END; $$`.
  - Éviter les contraintes / triggers dupliqués (`DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`).
- Toujours tenir compte du fichier tampon: les noms de colonnes / types doivent rester cohérents.

---

### 4. Synthèse des modules actuels

#### 4.1 Auth & Rôles

- Auth Supabase (`auth.users`) + table `utilisateurs` synchronisée.
- Rôles: `super_admin` plateforme, `admin`, rôles clients (`client_super_admin`, etc.).
- RLS renforcé (policies corrigées, `search_path` fixé).
- Protection du compte créateur `meddecyril@icloud.com` (fonction `is_user_protected` + trigger).

**État**: fonctionnel, à maintenir lors des évolutions.

---

#### 4.2 Création d’entreprise & workflow d’abonnement

- Frontend: page `EntreprisesPlateforme.tsx`:
  - Utilise `import type { Entreprise } from '../../types/shared';`.
  - Appelle `supabase.rpc('create_complete_entreprise_automated', {...})` avec tous les paramètres (dont `code_ape`, `code_naf`, `convention_collective`).
- Backend:
  - Fonction `create_complete_entreprise_automated` (migration finale `20250203000008_fix_create_entreprise_signature_final.sql`):
    - Signature **exacte** alignée sur le front (sans défauts ambigus).
    - Crée l’entreprise, le client principal, le paiement, et remplit `workflow_data`.
  - Fonctions de workflow:
    - `valider_paiement_carte_immediat`: valide un paiement et déclenche le workflow complet.
    - `creer_facture_et_abonnement_apres_paiement`: crée la facture d’abonnement, l’abonnement, l’espace membre et les droits.
  - Table `workflow_data`: stocke toutes les infos nécessaires pour reprendre le workflow en cas de souci.

**État**: workflow 0 → 100 % fonctionnel, signatures corrigées, plus d’erreurs de fonction non trouvée.

---

#### 4.3 Plans d’abonnement

- Tables: `plans_abonnement`, `abonnement_options`, `abonnements`.
- Écran de **Gestion des plans** côté plateforme (création/édition de plans & options).
- Intégration:
  - Utilisés par `create_complete_entreprise_automated` (choix du plan lors de la création).
  - Stockés dans `workflow_data`.
  - Utilisés pour créer les `abonnements` et les factures d’abonnement.

**État**: fonctionnel, raccordé à la création d’entreprise et au workflow.

---

#### 4.4 Facturation (hors devis)

- Modèle:
  - `Facture`, `FactureLigne`, `Avoir` dans `shared.ts`.
  - Table unique `factures` avec champs (numéro, dates, montants, `type`, `source`, `statut`, etc.).
  - Lignes de facture dans une table dédiée.
- Fonctionnalités:
  - Création / édition / suppression de factures.
  - Avoirs liés aux factures.
  - Séparation plateforme / espaces clients:
    - Plateforme ne voit pas les factures éditées par les clients dans leur espace.
    - Clients voient leurs propres factures émises / reçues, avec badges (abonnement, services…).
  - Notifications lors de l’envoi / réception.
  - Génération de PDF avec entêtes paramétrables (module `ParametresDocuments`).
- Intégration:
  - Facture d’abonnement créée automatiquement via le workflow de création d’entreprise.
  - Base pour la comptabilité (journal des ventes) et pour le module Finances.

**État**: module **validé** pour les factures; devis reste à implémenter.

---

#### 4.5 Clients / CRM

- Clients:
  - Table `clients` (clients de la plateforme par entreprise).
  - Table `client_contacts` (clients des clients dans les espaces membres).
  - Types `Client` et `ClientContact` centralisés dans `shared.ts`.
- CRM:
  - Tables pour opportunités, pipelines, tâches.
  - UI Kanban (opportunités par étape, notes, etc.).

**État**: base fonctionnelle OK; à approfondir pour l’intégration directe avec devis/factures.

---

#### 4.6 Collaborateurs / Contrats / Paie

- Collaborateurs:
  - Table `collaborateurs_entreprise` enrichie (SSN, URSSAF, emploi, statut, échelon, date d’entrée, ancienneté, convention collective, matricule, salaire, etc.).
  - UI de gestion par entreprise (liste, filtrage, recherche).
  - Génération:
    - PDF « fiche collaborateur ».
    - PDF « contrat de travail » détaillé (6–10 pages, sections légales, fonctions du poste).
- Paie:
  - Table `fiches_paie` + table `fiches_paie_lignes` (lignes détaillées).
  - Table `rubriques_paie` (cotisations, bases, taux).
  - Table `parametres_paie` (paramètres de calcul).
  - Génération PDF fiche de paie:
    - Tableau unique avec rubriques, base, taux salarié / employeur, montants.
    - Résumé: brut, net, net imposable, coût employeur, congés.

**État**: très avancé; reste à améliorer l’édition des lignes de paie directement dans l’UI et le lien automatique avec les taux de cotisations.

---

#### 4.7 Compta & Finances

- Comptabilité:
  - Structure de base mise en place (journaux, écritures, soldes) pour automatiser à terme:
    - Ventes (factures),
    - Achats (factures reçues futures),
    - Banque (paiements),
    - Paie (charges de personnel).
- Finances:
  - Module Finances opérationnel: affichage du CA et des statistiques par période (jour/mois/année) avec filtres corrigés.

**État**: fondations prêtes; la compta complète (journaux, FEC, TVA, URSSAF) restera à finaliser.

---

#### 4.8 Notifications / Paramètres / Documents

- Notifications:
  - Table `notifications` + RLS.
  - Types `Notification` dans `shared.ts`.
  - Envoi de notifications pour certains événements (factures, workflow).
- Paramètres:
  - Onglet Paramètres avec:
    - Profil utilisateur.
    - Configuration des entreprises (dont onglet pour les entreprises plateforme).
    - Module `ParametresDocuments` (logo, couleurs, polices, marges, mentions).
  - Conventions collectives et codes APE/NAF intégrés avec autocomplétion.

**État**: fonctionnel; à enrichir pour les mentions légales et un centre de notifications complet.

---

### 5. Tableau de dépendances entre modules

| Module                    | Dépend de…                                                | Alimente…                                  |
|---------------------------|-----------------------------------------------------------|--------------------------------------------|
| Auth & Utilisateurs       | `auth.users`, `utilisateurs`, RLS                        | Tous les modules                           |
| Création d’entreprise     | Auth, Plans, Paiements, `workflow_data`                  | Entreprises, Clients, Abonnements, Factures|
| Plans & Abonnements       | Entreprises, Paiements                                   | Facturation, Compta, Finances              |
| Facturation               | Entreprises, Clients, Articles, Abonnements, Paiements   | Compta (ventes), Finances, Notifications   |
| Clients / CRM             | Entreprises, Utilisateurs                                | Facturation, Projets, Notifications        |
| Collaborateurs / Paie     | Entreprises, Utilisateurs, Conventions, Codes APE/NAF    | Compta (charges), Finances                 |
| Compta                    | Facturation, Paie, Abonnements, Paiements, Entreprises   | Finances, exports (FEC, TVA, URSSAF…)      |
| Finances                  | Facturation, Compta, Paie, Abonnements                   | Dashboard, rapports                         |
| Notifications             | Facturation, Workflow, CRM, Paie                         | UI notifications, emails                    |
| Paramètres / Documents    | Entreprises, Paramètres documents                        | PDFs (factures, devis, contrats, rapports) |

---

### 6. Module DEVIS – Spécification

#### 6.1 Objectif

Permettre de gérer des **devis**:
- créés manuellement (plateforme et/ou espace client),
- générés automatiquement à partir d’autres modules (CRM, projets, voix/IA),
avec la possibilité de transformer un devis accepté en **facture**.

#### 6.2 Choix d’architecture

- Utiliser la **même table** `factures` pour les devis et les factures, avec un champ `type`:
  - `type = 'facture'` → facture classique,
  - `type = 'devis'` → devis,
  - `type = 'proforma'` → proforma si nécessaire.
- Avantages:
  - Pas de duplication de schéma,
  - Compta / Finances peuvent filtrer par `type`,
  - La transformation devis → facture reste simple (changement de type et/ou création d’une nouvelle ligne liée).

#### 6.3 Impacts sur `shared.ts`

- Type `Facture`:
  - Étendre le champ `type` pour inclure `'devis'`.
- Constante `FACTURE_TYPES`:
  - Ajouter `'devis'` dans la liste.
- Optionnel: ajouter des champs pour les besoins spécifiques des devis:
  - `date_validite?: string;`
  - `conditions?: string | null;`

#### 6.4 Devis manuels

**Fonctionnalités:**
- Onglet ou filtre « Devis » dans le module Facturation.
- Création / édition de devis:
  - Sélection du client,
  - Dates (émission, validité),
  - Lignes (articles, quantités, prix, TVA),
  - Conditions particulières.
- Statuts possibles:
  - `brouillon`, `envoye`, `accepte`, `refuse`, `expire`.
- Actions:
  - Dupliquer un devis,
  - Transformer un devis accepté en facture:
    - soit en changeant `type` et le statut,
    - soit en créant une nouvelle facture liée.
  - Générer un **PDF devis**:
    - Titre « Devis »,
    - Mentions spécifiques (validité, conditions),
    - Mise en page calquée sur la facture.

**Implémentation front:**
- Réutiliser le formulaire facture existant avec un « mode devis »:
  - `mode = 'facture' | 'devis'`,
  - Filtrer la liste selon `type`.

**Implémentation back:**
- S’assurer que la colonne `type` de `factures` accepte `'devis'`.
- Ajouter éventuellement `date_validite` et `conditions` dans la table `factures`.

#### 6.5 Devis automatiques

**Sources principales envisagées:**

1. **CRM (opportunités gagnées)**
   - Quand une opportunité passe en statut « gagnée »:
     - Bouton « Générer un devis »,
     - Devis pré‑rempli à partir:
       - du client,
       - du titre / descriptif de l’opportunité,
       - du montant estimé.
   - L’utilisateur peut ensuite ajuster les lignes avant envoi.

2. **Projets / Temps (plus tard)**
   - À partir d’un projet ou du temps prévu:
     - Générer un devis basé sur les tâches / heures prévues et les tarifs associés.

3. **Voice Invoice / IA (plus tard)**
   - Mode « devis » dans le parseur vocal ou textuel:
     - Générer un devis plutôt qu’une facture,
     - Toujours produire un objet compatible avec `Facture` / `FactureLigne`.

**Règle commune:**
- Les devis automatiques créent toujours une entrée dans `factures` avec `type = 'devis'` pour rester compatibles avec:
  - Compta,
  - Finances,
  - Export / reporting.

---

### 7. Roadmap synthétique

1. **Stabilisation (en cours / prioritaire)**
   - Valider la création d’entreprise + workflow vs. plans/abonnements (fait).
   - Vérifier la suppression complète et la protection des comptes (fait).
   - S’assurer que tous les types partagés passent bien par `shared.ts` (en grande partie fait).

2. **Devis manuels (prochaine étape)**
   - Étendre `Facture` / `FACTURE_TYPES` pour ajouter `'devis'`.
   - Ajouter l’onglet / filtre « Devis » au module Facturation.
   - Adapter le formulaire et le PDF pour le mode devis.
   - Ajouter la transformation devis → facture.

3. **Devis automatiques (v1 CRM)**
   - Intégrer le bouton « Générer un devis » dans la fiche opportunité CRM.
   - Créer un devis pré‑rempli et ouvrir en édition.

4. **Extensions futures**
   - Compta avancée (journaux, FEC, TVA, URSSAF).
   - Finances évoluées (marges, trésorerie, prévisions).
   - Projets / temps / stock liés à facturation et compta.
   - Voice invoice stabilisée avec Whisper + IA pour la compréhension des montants.

---

### 8. Conclusion

- Le cœur de l’application (création d’entreprise, plans, facturation, collaborateurs, paie, finances de base, sécurité) est en grande partie **en place et stabilisé**.
- Le **fichier tampon** `shared.ts` est la pierre angulaire pour éviter les conflits entre modules et doit être utilisé systématiquement.
- Le prochain gros chantier fonctionnel identifié est le **module Devis** (manuel puis automatique), conçu pour s’intégrer proprement dans l’architecture existante et préparer la suite (CRM, Projets, Compta complète).


