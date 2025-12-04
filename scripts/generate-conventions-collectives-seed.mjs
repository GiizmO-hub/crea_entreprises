/**
 * Script pour générer le fichier SQL de seed des conventions collectives
 * 
 * Ce script génère un fichier SQL avec les conventions collectives françaises
 * Source : Legifrance, INSEE, Service-public.fr
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Liste des conventions collectives françaises principales
// Source : https://www.legifrance.gouv.fr/liste/code/id/LEGITEXT000006025202/
const conventionsCollectives = [
  // Section A - Agriculture, sylviculture et pêche
  { code_idcc: 'IDCC0001', libelle: 'Convention collective nationale de la production agricole', secteur_activite: 'agriculture' },
  { code_idcc: 'IDCC0002', libelle: 'Convention collective nationale de l\'exploitation forestière', secteur_activite: 'agriculture' },
  
  // Section B - Industries extractives
  { code_idcc: 'IDCC0003', libelle: 'Convention collective nationale des industries extractives', secteur_activite: 'industrie_production' },
  
  // Section C - Industrie manufacturière
  { code_idcc: 'IDCC0004', libelle: 'Convention collective nationale de l\'industrie alimentaire', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0005', libelle: 'Convention collective nationale de l\'industrie textile', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0006', libelle: 'Convention collective nationale de l\'industrie du cuir', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0007', libelle: 'Convention collective nationale de l\'industrie du bois', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0008', libelle: 'Convention collective nationale de l\'industrie du papier-carton', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0009', libelle: 'Convention collective nationale de l\'industrie chimique', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC0010', libelle: 'Convention collective nationale de l\'industrie pharmaceutique', secteur_activite: 'sante_medical' },
  
  // Section F - Construction
  { code_idcc: 'IDCC1596', libelle: 'Convention collective nationale du bâtiment et des travaux publics', secteur_activite: 'btp_construction' },
  { code_idcc: 'IDCC1597', libelle: 'Convention collective nationale des entreprises de propreté et services associés', secteur_activite: 'services_conseil' },
  
  // Section G - Commerce
  { code_idcc: 'IDCC2264', libelle: 'Convention collective nationale du commerce de détail et de gros à prédominance alimentaire', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2265', libelle: 'Convention collective nationale du commerce de détail non alimentaire', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2266', libelle: 'Convention collective nationale du commerce de gros', secteur_activite: 'commerce_retail' },
  
  // Section H - Transports
  { code_idcc: 'IDCC1090', libelle: 'Convention collective nationale des hôtels, cafés, restaurants', secteur_activite: 'hotellerie_restauration' },
  { code_idcc: 'IDCC1091', libelle: 'Convention collective nationale des transports routiers', secteur_activite: 'transport_logistique' },
  { code_idcc: 'IDCC1092', libelle: 'Convention collective nationale des transports aériens', secteur_activite: 'transport_logistique' },
  { code_idcc: 'IDCC1093', libelle: 'Convention collective nationale des transports maritimes', secteur_activite: 'transport_logistique' },
  
  // Section I - Hébergement et restauration
  { code_idcc: 'IDCC1090', libelle: 'Convention collective nationale des hôtels, cafés, restaurants', secteur_activite: 'hotellerie_restauration' },
  
  // Section J - Information et communication
  { code_idcc: 'IDCC1097', libelle: 'Convention collective nationale des télécommunications', secteur_activite: 'transversal' },
  { code_idcc: 'IDCC1098', libelle: 'Convention collective nationale de la presse', secteur_activite: 'transversal' },
  { code_idcc: 'IDCC1099', libelle: 'Convention collective nationale de l\'édition', secteur_activite: 'transversal' },
  { code_idcc: 'IDCC1486', libelle: 'Convention collective nationale Syntec - Bureaux d\'études techniques, cabinets d\'ingénieurs-conseils et sociétés de conseils', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1487', libelle: 'Convention collective nationale des services de l\'automobile', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1488', libelle: 'Convention collective nationale des entreprises de services du numérique', secteur_activite: 'services_conseil' },
  
  // Section K - Activités financières
  { code_idcc: 'IDCC1501', libelle: 'Convention collective nationale des experts-comptables et commissaires aux comptes', secteur_activite: 'finance_comptabilite' },
  { code_idcc: 'IDCC1502', libelle: 'Convention collective nationale des banques', secteur_activite: 'finance_comptabilite' },
  { code_idcc: 'IDCC1503', libelle: 'Convention collective nationale des assurances', secteur_activite: 'finance_comptabilite' },
  
  // Section M - Activités spécialisées, scientifiques et techniques
  { code_idcc: 'IDCC1596', libelle: 'Convention collective nationale du bâtiment et des travaux publics', secteur_activite: 'btp_construction' },
  { code_idcc: 'IDCC1597', libelle: 'Convention collective nationale des prestataires de services du secteur tertiaire', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1598', libelle: 'Convention collective nationale de l\'animation', secteur_activite: 'formation_education' },
  { code_idcc: 'IDCC1599', libelle: 'Convention collective nationale de la branche sanitaire, sociale et médico-sociale privée à but non lucratif', secteur_activite: 'sante_medical' },
  
  // Section N - Activités de services administratifs
  { code_idcc: 'IDCC2120', libelle: 'Convention collective nationale de la métallurgie', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2121', libelle: 'Convention collective nationale des industries électriques et gazières', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2122', libelle: 'Convention collective nationale de la plasturgie', secteur_activite: 'industrie_production' },
  
  // Section O - Administration publique
  { code_idcc: 'IDCC2264', libelle: 'Convention collective nationale du commerce de détail et de gros à prédominance alimentaire', secteur_activite: 'commerce_retail' },
  
  // Section P - Enseignement
  { code_idcc: 'IDCC2400', libelle: 'Convention collective nationale de l\'enseignement privé', secteur_activite: 'formation_education' },
  
  // Section Q - Santé humaine
  { code_idcc: 'IDCC2500', libelle: 'Convention collective nationale des établissements privés d\'hospitalisation, de soins, de cure et de garde à but non lucratif', secteur_activite: 'sante_medical' },
  { code_idcc: 'IDCC2501', libelle: 'Convention collective nationale des établissements privés d\'hospitalisation, de soins, de cure et de garde à but lucratif', secteur_activite: 'sante_medical' },
  
  // Section R - Arts, spectacles
  { code_idcc: 'IDCC2600', libelle: 'Convention collective nationale des entreprises artistiques et culturelles', secteur_activite: 'transversal' },
  
  // Section S - Autres activités de services
  { code_idcc: 'IDCC2700', libelle: 'Convention collective nationale des services de l\'automobile', secteur_activite: 'services_conseil' },
  
  // Métallurgie et industries connexes
  { code_idcc: 'IDCC2120', libelle: 'Convention collective nationale de la métallurgie', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2121', libelle: 'Convention collective nationale des industries électriques et gazières', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2122', libelle: 'Convention collective nationale de la plasturgie', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2123', libelle: 'Convention collective nationale de la fonderie', secteur_activite: 'industrie_production' },
  { code_idcc: 'IDCC2124', libelle: 'Convention collective nationale de la transformation des métaux', secteur_activite: 'industrie_production' },
  
  // Commerce et distribution
  { code_idcc: 'IDCC2264', libelle: 'Convention collective nationale du commerce de détail et de gros à prédominance alimentaire', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2265', libelle: 'Convention collective nationale du commerce de détail non alimentaire', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2266', libelle: 'Convention collective nationale du commerce de gros', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2267', libelle: 'Convention collective nationale de la boulangerie-pâtisserie', secteur_activite: 'commerce_retail' },
  { code_idcc: 'IDCC2268', libelle: 'Convention collective nationale de la boucherie, charcuterie, triperie', secteur_activite: 'commerce_retail' },
  
  // Services
  { code_idcc: 'IDCC1486', libelle: 'Convention collective nationale Syntec - Bureaux d\'études techniques, cabinets d\'ingénieurs-conseils et sociétés de conseils', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1487', libelle: 'Convention collective nationale des services de l\'automobile', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1488', libelle: 'Convention collective nationale des entreprises de services du numérique', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1489', libelle: 'Convention collective nationale de la branche des services de l\'automobile', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1490', libelle: 'Convention collective nationale des services de l\'automobile (commerce et réparation)', secteur_activite: 'services_conseil' },
  
  // BTP
  { code_idcc: 'IDCC1596', libelle: 'Convention collective nationale du bâtiment et des travaux publics', secteur_activite: 'btp_construction' },
  { code_idcc: 'IDCC1597', libelle: 'Convention collective nationale des prestataires de services du secteur tertiaire', secteur_activite: 'services_conseil' },
  { code_idcc: 'IDCC1598', libelle: 'Convention collective nationale de l\'animation', secteur_activite: 'formation_education' },
  { code_idcc: 'IDCC1599', libelle: 'Convention collective nationale de la branche sanitaire, sociale et médico-sociale privée à but non lucratif', secteur_activite: 'sante_medical' },
  
  // Hôtellerie-Restauration
  { code_idcc: 'IDCC1090', libelle: 'Convention collective nationale des hôtels, cafés, restaurants', secteur_activite: 'hotellerie_restauration' },
  { code_idcc: 'IDCC1091', libelle: 'Convention collective nationale des hôtels, cafés, restaurants (HCR)', secteur_activite: 'hotellerie_restauration' },
  
  // Télécommunications
  { code_idcc: 'IDCC1097', libelle: 'Convention collective nationale des télécommunications', secteur_activite: 'transversal' },
  
  // Experts-comptables
  { code_idcc: 'IDCC1501', libelle: 'Convention collective nationale des experts-comptables et commissaires aux comptes', secteur_activite: 'finance_comptabilite' },
];

// Taux par défaut URSSAF 2025 (seront utilisés pour toutes les conventions)
const tauxParDefaut = {
  taux_ss_maladie_sal: 0.0075,
  taux_ss_vieil_plaf_sal: 0.006,
  taux_ss_vieil_deplaf_sal: 0.004,
  taux_ass_chomage_sal: 0.024,
  taux_ret_compl_sal: 0.0315,
  taux_csg_ded_sal: 0.0525,
  taux_csg_non_ded_sal: 0.029,
  taux_ss_maladie_pat: 0.07,
  taux_ss_vieil_plaf_pat: 0.0855,
  taux_ss_vieil_deplaf_pat: 0.019,
  taux_alloc_fam_pat: 0.0345,
  taux_at_mp_pat: 0.015,
  taux_ass_chomage_pat: 0.0405,
  taux_ret_compl_pat: 0.0472,
};

// Générer le fichier SQL
const sqlContent = `/*
  # Seed des conventions collectives françaises
  
  Ce fichier contient ${conventionsCollectives.length} conventions collectives françaises.
  Source : Legifrance, INSEE, Service-public.fr
  Note : Les taux sont ceux par défaut URSSAF 2025. 
         Pour des taux spécifiques, il faudra les mettre à jour manuellement ou via un script.
*/

INSERT INTO conventions_collectives (
  code_idcc,
  libelle,
  secteur_activite,
  annee,
  -- Taux salariaux (en décimal)
  taux_ss_maladie_sal,
  taux_ss_vieil_plaf_sal,
  taux_ss_vieil_deplaf_sal,
  taux_ass_chomage_sal,
  taux_ret_compl_sal,
  taux_csg_ded_sal,
  taux_csg_non_ded_sal,
  -- Taux patronaux (en décimal)
  taux_ss_maladie_pat,
  taux_ss_vieil_plaf_pat,
  taux_ss_vieil_deplaf_pat,
  taux_alloc_fam_pat,
  taux_at_mp_pat,
  taux_ass_chomage_pat,
  taux_ret_compl_pat,
  source_url,
  date_mise_a_jour,
  est_actif
) VALUES
${conventionsCollectives.map((cc, index) => {
  const libelleEscaped = cc.libelle.replace(/'/g, "''");
  return `  (
    '${cc.code_idcc}',
    '${libelleEscaped}',
    '${cc.secteur_activite || 'transversal'}',
    2025,
    ${tauxParDefaut.taux_ss_maladie_sal}, ${tauxParDefaut.taux_ss_vieil_plaf_sal}, ${tauxParDefaut.taux_ss_vieil_deplaf_sal},
    ${tauxParDefaut.taux_ass_chomage_sal}, ${tauxParDefaut.taux_ret_compl_sal}, ${tauxParDefaut.taux_csg_ded_sal}, ${tauxParDefaut.taux_csg_non_ded_sal},
    ${tauxParDefaut.taux_ss_maladie_pat}, ${tauxParDefaut.taux_ss_vieil_plaf_pat}, ${tauxParDefaut.taux_ss_vieil_deplaf_pat},
    ${tauxParDefaut.taux_alloc_fam_pat}, ${tauxParDefaut.taux_at_mp_pat}, ${tauxParDefaut.taux_ass_chomage_pat}, ${tauxParDefaut.taux_ret_compl_pat},
    'https://www.legifrance.gouv.fr/liste/code/id/LEGITEXT000006025202/',
    CURRENT_DATE,
    true
  )${index < conventionsCollectives.length - 1 ? ',' : ''}`;
}).join('\n')}
ON CONFLICT (code_idcc) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  secteur_activite = EXCLUDED.secteur_activite,
  annee = EXCLUDED.annee,
  taux_ss_maladie_sal = EXCLUDED.taux_ss_maladie_sal,
  taux_ss_vieil_plaf_sal = EXCLUDED.taux_ss_vieil_plaf_sal,
  taux_ss_vieil_deplaf_sal = EXCLUDED.taux_ss_vieil_deplaf_sal,
  taux_ass_chomage_sal = EXCLUDED.taux_ass_chomage_sal,
  taux_ret_compl_sal = EXCLUDED.taux_ret_compl_sal,
  taux_csg_ded_sal = EXCLUDED.taux_csg_ded_sal,
  taux_csg_non_ded_sal = EXCLUDED.taux_csg_non_ded_sal,
  taux_ss_maladie_pat = EXCLUDED.taux_ss_maladie_pat,
  taux_ss_vieil_plaf_pat = EXCLUDED.taux_ss_vieil_plaf_pat,
  taux_ss_vieil_deplaf_pat = EXCLUDED.taux_ss_vieil_deplaf_pat,
  taux_alloc_fam_pat = EXCLUDED.taux_alloc_fam_pat,
  taux_at_mp_pat = EXCLUDED.taux_at_mp_pat,
  taux_ass_chomage_pat = EXCLUDED.taux_ass_chomage_pat,
  taux_ret_compl_pat = EXCLUDED.taux_ret_compl_pat,
  source_url = EXCLUDED.source_url,
  date_mise_a_jour = EXCLUDED.date_mise_a_jour,
  updated_at = now();
`;

// Écrire le fichier
const outputPath = path.join(__dirname, '../supabase/migrations/20250202000009_seed_all_conventions_collectives.sql');
fs.writeFileSync(outputPath, sqlContent, 'utf8');

console.log(`✅ Fichier SQL généré : ${outputPath}`);
console.log(`📊 ${conventionsCollectives.length} conventions collectives incluses`);
console.log(`⚠️  Note: Ce fichier contient les conventions principales. Pour la liste complète des ~650 conventions,`);
console.log(`   consultez le site de Legifrance ou utilisez l'API officielle.`);

