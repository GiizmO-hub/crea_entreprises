/**
 * Script pour générer le fichier SQL de seed des codes APE/NAF
 * 
 * Ce script génère un fichier SQL avec les 732 codes APE/NAF officiels
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Liste des codes APE/NAF les plus courants (exemples)
// En production, vous devriez utiliser la liste complète de l'INSEE
const codesAPENAF = [
  // Section A - Agriculture, sylviculture et pêche
  { code: '0111Z', libelle: 'Culture de céréales (à l\'exception du riz), de légumineuses et de graines oléagineuses', section: 'A', division: '01', groupe: '011', classe: '0111', sous_classe: '0111Z' },
  { code: '0112Z', libelle: 'Culture du riz', section: 'A', division: '01', groupe: '011', classe: '0112', sous_classe: '0112Z' },
  
  // Section B - Industries extractives
  { code: '0510Z', libelle: 'Extraction de houille', section: 'B', division: '05', groupe: '051', classe: '0510', sous_classe: '0510Z' },
  
  // Section C - Industrie manufacturière
  { code: '1011Z', libelle: 'Transformation et conservation de la viande de boucherie', section: 'C', division: '10', groupe: '101', classe: '1011', sous_classe: '1011Z' },
  { code: '1012Z', libelle: 'Transformation et conservation de la viande de volaille', section: 'C', division: '10', groupe: '101', classe: '1012', sous_classe: '1012Z' },
  
  // Section D - Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné
  { code: '3511Z', libelle: 'Production d\'électricité', section: 'D', division: '35', groupe: '351', classe: '3511', sous_classe: '3511Z' },
  
  // Section E - Production et distribution d'eau ; assainissement, gestion des déchets et dépollution
  { code: '3600Z', libelle: 'Captage, traitement et distribution d\'eau', section: 'E', division: '36', groupe: '360', classe: '3600', sous_classe: '3600Z' },
  
  // Section F - Construction
  { code: '4110A', libelle: 'Promotion immobilière de logements', section: 'F', division: '41', groupe: '411', classe: '4110', sous_classe: '4110A' },
  { code: '4110B', libelle: 'Promotion immobilière de bâtiments autres que pour le logement', section: 'F', division: '41', groupe: '411', classe: '4110', sous_classe: '4110B' },
  { code: '4120A', libelle: 'Construction de maisons individuelles', section: 'F', division: '41', groupe: '412', classe: '4120', sous_classe: '4120A' },
  { code: '4120B', libelle: 'Construction d\'autres bâtiments', section: 'F', division: '41', groupe: '412', classe: '4120', sous_classe: '4120B' },
  
  // Section G - Commerce ; réparation d'automobiles et de motocycles
  { code: '4511Z', libelle: 'Commerce de voitures et de véhicules automobiles légers', section: 'G', division: '45', groupe: '451', classe: '4511', sous_classe: '4511Z' },
  { code: '4519Z', libelle: 'Commerce d\'autres véhicules automobiles', section: 'G', division: '45', groupe: '451', classe: '4519', sous_classe: '4519Z' },
  { code: '4611Z', libelle: 'Intermédiaires du commerce en matières premières agricoles, animaux vivants, matières premières textiles et produits semi-finis', section: 'G', division: '46', groupe: '461', classe: '4611', sous_classe: '4611Z' },
  { code: '4612Z', libelle: 'Intermédiaires du commerce en combustibles, métaux, minéraux et produits chimiques', section: 'G', division: '46', groupe: '461', classe: '4612', sous_classe: '4612Z' },
  { code: '4613Z', libelle: 'Intermédiaires du commerce en bois et matériaux de construction', section: 'G', division: '46', groupe: '461', classe: '4613', sous_classe: '4613Z' },
  { code: '4614Z', libelle: 'Intermédiaires du commerce en machines, équipements industriels, navires et avions', section: 'G', division: '46', groupe: '461', classe: '4614', sous_classe: '4614Z' },
  { code: '4615Z', libelle: 'Intermédiaires du commerce en meubles, articles de ménage et quincaillerie', section: 'G', division: '46', groupe: '461', classe: '4615', sous_classe: '4615Z' },
  { code: '4616Z', libelle: 'Intermédiaires du commerce en textiles, habillement, fourrures, chaussures et articles en cuir', section: 'G', division: '46', groupe: '461', classe: '4616', sous_classe: '4616Z' },
  { code: '4617Z', libelle: 'Intermédiaires du commerce en denrées, boissons et tabac', section: 'G', division: '46', groupe: '461', classe: '4617', sous_classe: '4617Z' },
  { code: '4619A', libelle: 'Centrales d\'achat alimentaires', section: 'G', division: '46', groupe: '461', classe: '4619', sous_classe: '4619A' },
  { code: '4619B', libelle: 'Autres intermédiaires du commerce en produits divers', section: 'G', division: '46', groupe: '461', classe: '4619', sous_classe: '4619B' },
  
  // Section H - Transports et entreposage
  { code: '4910Z', libelle: 'Transport ferroviaire de voyageurs', section: 'H', division: '49', groupe: '491', classe: '4910', sous_classe: '4910Z' },
  { code: '4920Z', libelle: 'Transports ferroviaires de fret', section: 'H', division: '49', groupe: '492', classe: '4920', sous_classe: '4920Z' },
  { code: '4931Z', libelle: 'Transports urbains et suburbains de voyageurs', section: 'H', division: '49', groupe: '493', classe: '4931', sous_classe: '4931Z' },
  { code: '4932Z', libelle: 'Autres transports terrestres de voyageurs', section: 'H', division: '49', groupe: '493', classe: '4932', sous_classe: '4932Z' },
  { code: '4939A', libelle: 'Transports routiers de fret interurbains', section: 'H', division: '49', groupe: '493', classe: '4939', sous_classe: '4939A' },
  { code: '4939B', libelle: 'Transports routiers de fret de proximité', section: 'H', division: '49', groupe: '493', classe: '4939', sous_classe: '4939B' },
  { code: '4939C', libelle: 'Location de camions avec chauffeur', section: 'H', division: '49', groupe: '493', classe: '4939', sous_classe: '4939C' },
  
  // Section I - Hébergement et restauration
  { code: '5510Z', libelle: 'Hôtels et hébergement similaire', section: 'I', division: '55', groupe: '551', classe: '5510', sous_classe: '5510Z' },
  { code: '5520Z', libelle: 'Hébergement touristique et autre hébergement de courte durée', section: 'I', division: '55', groupe: '552', classe: '5520', sous_classe: '5520Z' },
  { code: '5530Z', libelle: 'Terrains de camping et parcs pour caravanes ou véhicules de loisirs', section: 'I', division: '55', groupe: '553', classe: '5530', sous_classe: '5530Z' },
  { code: '5590Z', libelle: 'Autres hébergements', section: 'I', division: '55', groupe: '559', classe: '5590', sous_classe: '5590Z' },
  { code: '5610A', libelle: 'Restauration traditionnelle', section: 'I', division: '56', groupe: '561', classe: '5610', sous_classe: '5610A' },
  { code: '5610B', libelle: 'Cafétérias et autres libres-services', section: 'I', division: '56', groupe: '561', classe: '5610', sous_classe: '5610B' },
  { code: '5621Z', libelle: 'Services des traiteurs', section: 'I', division: '56', groupe: '562', classe: '5621', sous_classe: '5621Z' },
  { code: '5629A', libelle: 'Restauration collective sous contrat', section: 'I', division: '56', groupe: '562', classe: '5629', sous_classe: '5629A' },
  { code: '5629B', libelle: 'Autres services de restauration n.c.a.', section: 'I', division: '56', groupe: '562', classe: '5629', sous_classe: '5629B' },
  { code: '5630Z', libelle: 'Débits de boissons', section: 'I', division: '56', groupe: '563', classe: '5630', sous_classe: '5630Z' },
  
  // Section J - Information et communication
  { code: '5811Z', libelle: 'Édition de livres', section: 'J', division: '58', groupe: '581', classe: '5811', sous_classe: '5811Z' },
  { code: '5812Z', libelle: 'Édition de répertoires et de fichiers d\'adresses', section: 'J', division: '58', groupe: '581', classe: '5812', sous_classe: '5812Z' },
  { code: '5813Z', libelle: 'Édition de journaux', section: 'J', division: '58', groupe: '581', classe: '5813', sous_classe: '5813Z' },
  { code: '5814Z', libelle: 'Édition de revues et périodiques', section: 'J', division: '58', groupe: '581', classe: '5814', sous_classe: '5814Z' },
  { code: '5819Z', libelle: 'Autres activités d\'édition', section: 'J', division: '58', groupe: '581', classe: '5819', sous_classe: '5819Z' },
  { code: '5821Z', libelle: 'Édition de jeux électroniques', section: 'J', division: '58', groupe: '582', classe: '5821', sous_classe: '5821Z' },
  { code: '5829A', libelle: 'Édition de logiciels système et de réseau', section: 'J', division: '58', groupe: '582', classe: '5829', sous_classe: '5829A' },
  { code: '5829B', libelle: 'Édition de logiciels outils de développement et de langages de programmation', section: 'J', division: '58', groupe: '582', classe: '5829', sous_classe: '5829B' },
  { code: '5829C', libelle: 'Édition de logiciels applicatifs', section: 'J', division: '58', groupe: '582', classe: '5829', sous_classe: '5829C' },
  { code: '5911A', libelle: 'Production de films et de programmes pour la télévision', section: 'J', division: '59', groupe: '591', classe: '5911', sous_classe: '5911A' },
  { code: '5911B', libelle: 'Production de films institutionnels et publicitaires', section: 'J', division: '59', groupe: '591', classe: '5911', sous_classe: '5911B' },
  { code: '5911C', libelle: 'Production de films pour le cinéma', section: 'J', division: '59', groupe: '591', classe: '5911', sous_classe: '5911C' },
  { code: '5912Z', libelle: 'Post-production cinématographique et audiovisuelle', section: 'J', division: '59', groupe: '591', classe: '5912', sous_classe: '5912Z' },
  { code: '5913A', libelle: 'Distribution de films cinématographiques', section: 'J', division: '59', groupe: '591', classe: '5913', sous_classe: '5913A' },
  { code: '5913B', libelle: 'Édition et distribution vidéo', section: 'J', division: '59', groupe: '591', classe: '5913', sous_classe: '5913B' },
  { code: '5914Z', libelle: 'Projection de films cinématographiques', section: 'J', division: '59', groupe: '591', classe: '5914', sous_classe: '5914Z' },
  { code: '5920Z', libelle: 'Enregistrement sonore et édition musicale', section: 'J', division: '59', groupe: '592', classe: '5920', sous_classe: '5920Z' },
  { code: '6010Z', libelle: 'Édition et diffusion de programmes radio', section: 'J', division: '60', groupe: '601', classe: '6010', sous_classe: '6010Z' },
  { code: '6020A', libelle: 'Édition de chaînes généralistes', section: 'J', division: '60', groupe: '602', classe: '6020', sous_classe: '6020A' },
  { code: '6020B', libelle: 'Édition de chaînes thématiques', section: 'J', division: '60', groupe: '602', classe: '6020', sous_classe: '6020B' },
  { code: '6110Z', libelle: 'Télécommunications filaires', section: 'J', division: '61', groupe: '611', classe: '6110', sous_classe: '6110Z' },
  { code: '6120Z', libelle: 'Télécommunications sans fil', section: 'J', division: '61', groupe: '612', classe: '6120', sous_classe: '6120Z' },
  { code: '6130Z', libelle: 'Télécommunications par satellite', section: 'J', division: '61', groupe: '613', classe: '6130', sous_classe: '6130Z' },
  { code: '6190Z', libelle: 'Autres activités de télécommunication', section: 'J', division: '61', groupe: '619', classe: '6190', sous_classe: '6190Z' },
  { code: '6201Z', libelle: 'Programmation informatique', section: 'J', division: '62', groupe: '620', classe: '6201', sous_classe: '6201Z' },
  { code: '6202Z', libelle: 'Conseil informatique', section: 'J', division: '62', groupe: '620', classe: '6202', sous_classe: '6202Z' },
  { code: '6203Z', libelle: 'Gestion d\'installations informatiques', section: 'J', division: '62', groupe: '620', classe: '6203', sous_classe: '6203Z' },
  { code: '6209Z', libelle: 'Autres activités informatiques', section: 'J', division: '62', groupe: '620', classe: '6209', sous_classe: '6209Z' },
  { code: '6311Z', libelle: 'Traitement de données, hébergement et activités connexes', section: 'J', division: '63', groupe: '631', classe: '6311', sous_classe: '6311Z' },
  { code: '6312Z', libelle: 'Portails Internet', section: 'J', division: '63', groupe: '631', classe: '6312', sous_classe: '6312Z' },
  { code: '6391Z', libelle: 'Activités des agences de presse', section: 'J', division: '63', groupe: '639', classe: '6391', sous_classe: '6391Z' },
  { code: '6399Z', libelle: 'Autres services d\'information n.c.a.', section: 'J', division: '63', groupe: '639', classe: '6399', sous_classe: '6399Z' },
  
  // Section K - Activités financières et d'assurance
  { code: '6411Z', libelle: 'Activités de banque centrale', section: 'K', division: '64', groupe: '641', classe: '6411', sous_classe: '6411Z' },
  { code: '6419Z', libelle: 'Autres intermédiations monétaires', section: 'K', division: '64', groupe: '641', classe: '6419', sous_classe: '6419Z' },
  { code: '6420Z', libelle: 'Activités des sociétés holding', section: 'K', division: '64', groupe: '642', classe: '6420', sous_classe: '6420Z' },
  { code: '6430Z', libelle: 'Fonds de placement et entités financières similaires', section: 'K', division: '64', groupe: '643', classe: '6430', sous_classe: '6430Z' },
  { code: '6491Z', libelle: 'Crédit-bail', section: 'K', division: '64', groupe: '649', classe: '6491', sous_classe: '6491Z' },
  { code: '6492Z', libelle: 'Autre distribution de crédit', section: 'K', division: '64', groupe: '649', classe: '6492', sous_classe: '6492Z' },
  { code: '6499Z', libelle: 'Autres activités des services financiers, hors assurance et caisses de retraite, n.c.a.', section: 'K', division: '64', groupe: '649', classe: '6499', sous_classe: '6499Z' },
  { code: '6511Z', libelle: 'Assurance vie', section: 'K', division: '65', groupe: '651', classe: '6511', sous_classe: '6511Z' },
  { code: '6512Z', libelle: 'Autres assurances', section: 'K', division: '65', groupe: '651', classe: '6512', sous_classe: '6512Z' },
  { code: '6520Z', libelle: 'Réassurance', section: 'K', division: '65', groupe: '652', classe: '6520', sous_classe: '6520Z' },
  { code: '6530Z', libelle: 'Caisses de retraite', section: 'K', division: '65', groupe: '653', classe: '6530', sous_classe: '6530Z' },
  { code: '6611Z', libelle: 'Administration de marchés financiers', section: 'K', division: '66', groupe: '661', classe: '6611', sous_classe: '6611Z' },
  { code: '6612Z', libelle: 'Courtage de valeurs mobilières et de marchandises', section: 'K', division: '66', groupe: '661', classe: '6612', sous_classe: '6612Z' },
  { code: '6619A', libelle: 'Supports juridiques de gestion de patrimoine mobilier', section: 'K', division: '66', groupe: '661', classe: '6619', sous_classe: '6619A' },
  { code: '6619B', libelle: 'Autres activités auxiliaires de services financiers, hors assurance et caisses de retraite, n.c.a.', section: 'K', division: '66', groupe: '661', classe: '6619', sous_classe: '6619B' },
  { code: '6621Z', libelle: 'Évaluation des risques et dommages', section: 'K', division: '66', groupe: '662', classe: '6621', sous_classe: '6621Z' },
  { code: '6622Z', libelle: 'Activités des agents et courtiers d\'assurances', section: 'K', division: '66', groupe: '662', classe: '6622', sous_classe: '6622Z' },
  { code: '6629Z', libelle: 'Autres activités auxiliaires d\'assurance et de caisses de retraite', section: 'K', division: '66', groupe: '662', classe: '6629', sous_classe: '6629Z' },
  { code: '6630Z', libelle: 'Gestion de fonds', section: 'K', division: '66', groupe: '663', classe: '6630', sous_classe: '6630Z' },
  
  // Section L - Activités immobilières
  { code: '6810Z', libelle: 'Promotion immobilière', section: 'L', division: '68', groupe: '681', classe: '6810', sous_classe: '6810Z' },
  { code: '6820A', libelle: 'Location de logements', section: 'L', division: '68', groupe: '682', classe: '6820', sous_classe: '6820A' },
  { code: '6820B', libelle: 'Location de terrains et d\'autres biens immobiliers', section: 'L', division: '68', groupe: '682', classe: '6820', sous_classe: '6820B' },
  { code: '6831Z', libelle: 'Agences immobilières', section: 'L', division: '68', groupe: '683', classe: '6831', sous_classe: '6831Z' },
  { code: '6832A', libelle: 'Administration de biens immobiliers', section: 'L', division: '68', groupe: '683', classe: '6832', sous_classe: '6832A' },
  { code: '6832B', libelle: 'Supports juridiques de gestion de patrimoine immobilier', section: 'L', division: '68', groupe: '683', classe: '6832', sous_classe: '6832B' },
  
  // Section M - Activités spécialisées, scientifiques et techniques
  { code: '6910Z', libelle: 'Activités juridiques', section: 'M', division: '69', groupe: '691', classe: '6910', sous_classe: '6910Z' },
  { code: '6920Z', libelle: 'Activités comptables', section: 'M', division: '69', groupe: '692', classe: '6920', sous_classe: '6920Z' },
  { code: '7010Z', libelle: 'Activités des sièges sociaux', section: 'M', division: '70', groupe: '701', classe: '7010', sous_classe: '7010Z' },
  { code: '7021Z', libelle: 'Conseil en relations publiques et communication', section: 'M', division: '70', groupe: '702', classe: '7021', sous_classe: '7021Z' },
  { code: '7022Z', libelle: 'Conseil pour les affaires et autres conseils de gestion', section: 'M', division: '70', groupe: '702', classe: '7022', sous_classe: '7022Z' },
  { code: '7111Z', libelle: 'Activités d\'architecture', section: 'M', division: '71', groupe: '711', classe: '7111', sous_classe: '7111Z' },
  { code: '7112A', libelle: 'Ingénierie, études techniques', section: 'M', division: '71', groupe: '711', classe: '7112', sous_classe: '7112A' },
  { code: '7112B', libelle: 'Activité des géomètres-experts', section: 'M', division: '71', groupe: '711', classe: '7112', sous_classe: '7112B' },
  { code: '7120A', libelle: 'Contrôle technique automobile', section: 'M', division: '71', groupe: '712', classe: '7120', sous_classe: '7120A' },
  { code: '7120B', libelle: 'Analyses, essais et inspections techniques', section: 'M', division: '71', groupe: '712', classe: '7120', sous_classe: '7120B' },
  { code: '7211Z', libelle: 'Recherche-développement en biotechnologie', section: 'M', division: '72', groupe: '721', classe: '7211', sous_classe: '7211Z' },
  { code: '7219Z', libelle: 'Recherche-développement sur les autres sciences physiques et naturelles', section: 'M', division: '72', groupe: '721', classe: '7219', sous_classe: '7219Z' },
  { code: '7220Z', libelle: 'Recherche-développement en sciences humaines et sociales', section: 'M', division: '72', groupe: '722', classe: '7220', sous_classe: '7220Z' },
  { code: '7311Z', libelle: 'Activités des agences de publicité', section: 'M', division: '73', groupe: '731', classe: '7311', sous_classe: '7311Z' },
  { code: '7312Z', libelle: 'Régie publicitaire de médias', section: 'M', division: '73', groupe: '731', classe: '7312', sous_classe: '7312Z' },
  { code: '7320Z', libelle: 'Études de marché et sondages', section: 'M', division: '73', groupe: '732', classe: '7320', sous_classe: '7320Z' },
  { code: '7410Z', libelle: 'Activités de design', section: 'M', division: '74', groupe: '741', classe: '7410', sous_classe: '7410Z' },
  { code: '7420Z', libelle: 'Activités photographiques', section: 'M', division: '74', groupe: '742', classe: '7420', sous_classe: '7420Z' },
  { code: '7430Z', libelle: 'Traduction et interprétation', section: 'M', division: '74', groupe: '743', classe: '7430', sous_classe: '7430Z' },
  { code: '7490A', libelle: 'Activités des agences de recrutement', section: 'M', division: '74', groupe: '749', classe: '7490', sous_classe: '7490A' },
  { code: '7490B', libelle: 'Activités des agences de travail temporaire', section: 'M', division: '74', groupe: '749', classe: '7490', sous_classe: '7490B' },
  { code: '7490C', libelle: 'Autre mise à disposition de ressources humaines', section: 'M', division: '74', groupe: '749', classe: '7490', sous_classe: '7490C' },
  { code: '7500Z', libelle: 'Activités vétérinaires', section: 'M', division: '75', groupe: '750', classe: '7500', sous_classe: '7500Z' },
  
  // Section N - Activités de services administratifs et de soutien
  { code: '7711A', libelle: 'Location de courte durée de voitures et de véhicules automobiles légers', section: 'N', division: '77', groupe: '771', classe: '7711', sous_classe: '7711A' },
  { code: '7711B', libelle: 'Location de longue durée de voitures et de véhicules automobiles légers', section: 'N', division: '77', groupe: '771', classe: '7711', sous_classe: '7711B' },
  { code: '7712Z', libelle: 'Location et location-bail de camions', section: 'N', division: '77', groupe: '771', classe: '7712', sous_classe: '7712Z' },
  { code: '7721Z', libelle: 'Location et location-bail d\'articles de loisirs et de sport', section: 'N', division: '77', groupe: '772', classe: '7721', sous_classe: '7721Z' },
  { code: '7722Z', libelle: 'Location de vidéos et disques vidéo', section: 'N', division: '77', groupe: '772', classe: '7722', sous_classe: '7722Z' },
  { code: '7729Z', libelle: 'Location et location-bail d\'autres biens personnels et domestiques', section: 'N', division: '77', groupe: '772', classe: '7729', sous_classe: '7729Z' },
  { code: '7731Z', libelle: 'Location et location-bail de machines et équipements agricoles', section: 'N', division: '77', groupe: '773', classe: '7731', sous_classe: '7731Z' },
  { code: '7732Z', libelle: 'Location et location-bail de machines et équipements pour la construction', section: 'N', division: '77', groupe: '773', classe: '7732', sous_classe: '7732Z' },
  { code: '7733Z', libelle: 'Location et location-bail de machines de bureau et de matériel informatique', section: 'N', division: '77', groupe: '773', classe: '7733', sous_classe: '7733Z' },
  { code: '7734Z', libelle: 'Location et location-bail de matériels de transport par eau', section: 'N', division: '77', groupe: '773', classe: '7734', sous_classe: '7734Z' },
  { code: '7735Z', libelle: 'Location et location-bail de matériels de transport aérien', section: 'N', division: '77', groupe: '773', classe: '7735', sous_classe: '7735Z' },
  { code: '7739Z', libelle: 'Location et location-bail d\'autres machines, équipements et biens matériels n.c.a.', section: 'N', division: '77', groupe: '773', classe: '7739', sous_classe: '7739Z' },
  { code: '7740Z', libelle: 'Location-bail de propriété intellectuelle et de produits similaires, à l\'exception des œuvres soumises à copyright', section: 'N', division: '77', groupe: '774', classe: '7740', sous_classe: '7740Z' },
  { code: '7810Z', libelle: 'Activités des agences de placement de main-d\'œuvre', section: 'N', division: '78', groupe: '781', classe: '7810', sous_classe: '7810Z' },
  { code: '7820Z', libelle: 'Activités des agences de travail temporaire', section: 'N', division: '78', groupe: '782', classe: '7820', sous_classe: '7820Z' },
  { code: '7830Z', libelle: 'Autre mise à disposition de ressources humaines', section: 'N', division: '78', groupe: '783', classe: '7830', sous_classe: '7830Z' },
  { code: '7911Z', libelle: 'Activités des agences de voyage', section: 'N', division: '79', groupe: '791', classe: '7911', sous_classe: '7911Z' },
  { code: '7912Z', libelle: 'Activités des voyagistes', section: 'N', division: '79', groupe: '791', classe: '7912', sous_classe: '7912Z' },
  { code: '7990Z', libelle: 'Autres services de réservation et activités connexes', section: 'N', division: '79', groupe: '799', classe: '7990', sous_classe: '7990Z' },
  { code: '8010Z', libelle: 'Activités de sécurité privée', section: 'N', division: '80', groupe: '801', classe: '8010', sous_classe: '8010Z' },
  { code: '8020Z', libelle: 'Activités liées aux systèmes de sécurité', section: 'N', division: '80', groupe: '802', classe: '8020', sous_classe: '8020Z' },
  { code: '8030Z', libelle: 'Activités d\'enquête', section: 'N', division: '80', groupe: '803', classe: '8030', sous_classe: '8030Z' },
  { code: '8110Z', libelle: 'Activités combinées de soutien lié aux bâtiments', section: 'N', division: '81', groupe: '811', classe: '8110', sous_classe: '8110Z' },
  { code: '8121Z', libelle: 'Nettoyage courant des bâtiments', section: 'N', division: '81', groupe: '812', classe: '8121', sous_classe: '8121Z' },
  { code: '8122Z', libelle: 'Autres activités de nettoyage des bâtiments et nettoyage industriel', section: 'N', division: '81', groupe: '812', classe: '8122', sous_classe: '8122Z' },
  { code: '8129A', libelle: 'Désinfection, désinsectisation, dératisation', section: 'N', division: '81', groupe: '812', classe: '8129', sous_classe: '8129A' },
  { code: '8129B', libelle: 'Autres activités de nettoyage n.c.a.', section: 'N', division: '81', groupe: '812', classe: '8129', sous_classe: '8129B' },
  { code: '8130Z', libelle: 'Services d\'aménagement paysager', section: 'N', division: '81', groupe: '813', classe: '8130', sous_classe: '8130Z' },
  { code: '8211Z', libelle: 'Services administratifs combinés de bureau', section: 'N', division: '82', groupe: '821', classe: '8211', sous_classe: '8211Z' },
  { code: '8219Z', libelle: 'Photocopie, préparation de documents et autres activités spécialisées de soutien de bureau', section: 'N', division: '82', groupe: '821', classe: '8219', sous_classe: '8219Z' },
  { code: '8220Z', libelle: 'Activités de centres d\'appels', section: 'N', division: '82', groupe: '822', classe: '8220', sous_classe: '8220Z' },
  { code: '8230Z', libelle: 'Organisation de foires, salons professionnels et congrès', section: 'N', division: '82', groupe: '823', classe: '8230', sous_classe: '8230Z' },
  { code: '8291Z', libelle: 'Activités des agences de recouvrement de factures et des sociétés d\'information financière sur la clientèle', section: 'N', division: '82', groupe: '829', classe: '8291', sous_classe: '8291Z' },
  { code: '8292Z', libelle: 'Activités de conditionnement', section: 'N', division: '82', groupe: '829', classe: '8292', sous_classe: '8292Z' },
  { code: '8299Z', libelle: 'Autres activités de soutien aux entreprises n.c.a.', section: 'N', division: '82', groupe: '829', classe: '8299', sous_classe: '8299Z' },
  
  // Section O - Administration publique
  { code: '8411Z', libelle: 'Administration publique générale', section: 'O', division: '84', groupe: '841', classe: '8411', sous_classe: '8411Z' },
  { code: '8412Z', libelle: 'Administration publique (tutelle) de la santé, de la formation, de la culture et des services sociaux, autre que sécurité sociale', section: 'O', division: '84', groupe: '841', classe: '8412', sous_classe: '8412Z' },
  { code: '8413Z', libelle: 'Administration publique (tutelle) des activités économiques', section: 'O', division: '84', groupe: '841', classe: '8413', sous_classe: '8413Z' },
  { code: '8421Z', libelle: 'Affaires étrangères', section: 'O', division: '84', groupe: '842', classe: '8421', sous_classe: '8421Z' },
  { code: '8422Z', libelle: 'Défense', section: 'O', division: '84', groupe: '842', classe: '8422', sous_classe: '8422Z' },
  { code: '8423Z', libelle: 'Justice', section: 'O', division: '84', groupe: '842', classe: '8423', sous_classe: '8423Z' },
  { code: '8424Z', libelle: 'Activités d\'ordre public et de sécurité', section: 'O', division: '84', groupe: '842', classe: '8424', sous_classe: '8424Z' },
  { code: '8425Z', libelle: 'Services du feu', section: 'O', division: '84', groupe: '842', classe: '8425', sous_classe: '8425Z' },
  { code: '8430A', libelle: 'Sécurité sociale obligatoire', section: 'O', division: '84', groupe: '843', classe: '8430', sous_classe: '8430A' },
  { code: '8430B', libelle: 'Autres activités de sécurité sociale', section: 'O', division: '84', groupe: '843', classe: '8430', sous_classe: '8430B' },
  { code: '8510Z', libelle: 'Enseignement pré-primaire', section: 'O', division: '85', groupe: '851', classe: '8510', sous_classe: '8510Z' },
  { code: '8520Z', libelle: 'Enseignement primaire', section: 'O', division: '85', groupe: '852', classe: '8520', sous_classe: '8520Z' },
  { code: '8531Z', libelle: 'Enseignement secondaire général', section: 'O', division: '85', groupe: '853', classe: '8531', sous_classe: '8531Z' },
  { code: '8532Z', libelle: 'Enseignement secondaire technique ou professionnel', section: 'O', division: '85', groupe: '853', classe: '8532', sous_classe: '8532Z' },
  { code: '8541Z', libelle: 'Enseignement post-secondaire non supérieur', section: 'O', division: '85', groupe: '854', classe: '8541', sous_classe: '8541Z' },
  { code: '8542Z', libelle: 'Enseignement supérieur', section: 'O', division: '85', groupe: '854', classe: '8542', sous_classe: '8542Z' },
  { code: '8551Z', libelle: 'Enseignement de disciplines sportives et d\'activités de loisirs', section: 'O', division: '85', groupe: '855', classe: '8551', sous_classe: '8551Z' },
  { code: '8552Z', libelle: 'Enseignement culturel', section: 'O', division: '85', groupe: '855', classe: '8552', sous_classe: '8552Z' },
  { code: '8553Z', libelle: 'Enseignement de la conduite', section: 'O', division: '85', groupe: '855', classe: '8553', sous_classe: '8553Z' },
  { code: '8559A', libelle: 'Formation continue d\'adultes', section: 'O', division: '85', groupe: '855', classe: '8559', sous_classe: '8559A' },
  { code: '8559B', libelle: 'Autres enseignements', section: 'O', division: '85', groupe: '855', classe: '8559', sous_classe: '8559B' },
  { code: '8560Z', libelle: 'Activités de soutien à l\'enseignement', section: 'O', division: '85', groupe: '856', classe: '8560', sous_classe: '8560Z' },
  { code: '8610Z', libelle: 'Activités hospitalières', section: 'O', division: '86', groupe: '861', classe: '8610', sous_classe: '8610Z' },
  { code: '8621Z', libelle: 'Activité des médecins généralistes', section: 'O', division: '86', groupe: '862', classe: '8621', sous_classe: '8621Z' },
  { code: '8622A', libelle: 'Activités de radiodiagnostic et de radiothérapie', section: 'O', division: '86', groupe: '862', classe: '8622', sous_classe: '8622A' },
  { code: '8622B', libelle: 'Activités des médecins spécialistes', section: 'O', division: '86', groupe: '862', classe: '8622', sous_classe: '8622B' },
  { code: '8623Z', libelle: 'Pratique dentaire', section: 'O', division: '86', groupe: '862', classe: '8623', sous_classe: '8623Z' },
  { code: '8690A', libelle: 'Ambulances', section: 'O', division: '86', groupe: '869', classe: '8690', sous_classe: '8690A' },
  { code: '8690B', libelle: 'Autres activités pour la santé humaine n.c.a.', section: 'O', division: '86', groupe: '869', classe: '8690', sous_classe: '8690B' },
  { code: '8710A', libelle: 'Hébergement social pour personnes âgées', section: 'O', division: '87', groupe: '871', classe: '8710', sous_classe: '8710A' },
  { code: '8710B', libelle: 'Hébergement social pour handicapés mentaux et malades mentaux', section: 'O', division: '87', groupe: '871', classe: '8710', sous_classe: '8710B' },
  { code: '8710C', libelle: 'Hébergement social pour enfants en difficulté', section: 'O', division: '87', groupe: '871', classe: '8710', sous_classe: '8710C' },
  { code: '8710D', libelle: 'Autres hébergements sociaux', section: 'O', division: '87', groupe: '871', classe: '8710', sous_classe: '8710D' },
  { code: '8720A', libelle: 'Hébergement social pour handicapés physiques', section: 'O', division: '87', groupe: '872', classe: '8720', sous_classe: '8720A' },
  { code: '8720B', libelle: 'Autres activités d\'hébergement social n.c.a.', section: 'O', division: '87', groupe: '872', classe: '8720', sous_classe: '8720B' },
  { code: '8730A', libelle: 'Hébergement social pour adultes et familles en difficulté', section: 'O', division: '87', groupe: '873', classe: '8730', sous_classe: '8730A' },
  { code: '8730B', libelle: 'Autres hébergements sociaux n.c.a.', section: 'O', division: '87', groupe: '873', classe: '8730', sous_classe: '8730B' },
  { code: '8790A', libelle: 'Action sociale sans hébergement pour personnes âgées', section: 'O', division: '87', groupe: '879', classe: '8790', sous_classe: '8790A' },
  { code: '8790B', libelle: 'Action sociale sans hébergement pour handicapés', section: 'O', division: '87', groupe: '879', classe: '8790', sous_classe: '8790B' },
  { code: '8790C', libelle: 'Action sociale sans hébergement n.c.a.', section: 'O', division: '87', groupe: '879', classe: '8790', sous_classe: '8790C' },
  { code: '8810A', libelle: 'Aide à domicile', section: 'O', division: '88', groupe: '881', classe: '8810', sous_classe: '8810A' },
  { code: '8810B', libelle: 'Accueil ou accompagnement sans hébergement d\'adultes ou d\'enfants handicapés ou de personnes âgées', section: 'O', division: '88', groupe: '881', classe: '8810', sous_classe: '8810B' },
  { code: '8810C', libelle: 'Aide par le travail', section: 'O', division: '88', groupe: '881', classe: '8810', sous_classe: '8810C' },
  { code: '8891A', libelle: 'Accueil de jeunes enfants', section: 'O', division: '88', groupe: '889', classe: '8891', sous_classe: '8891A' },
  { code: '8891B', libelle: 'Autres accueils ou accompagnements sans hébergement d\'enfants et d\'adolescents', section: 'O', division: '88', groupe: '889', classe: '8891', sous_classe: '8891B' },
  { code: '8899A', libelle: 'Autre accueil ou accompagnement sans hébergement d\'adultes handicapés ou de personnes âgées', section: 'O', division: '88', groupe: '889', classe: '8899', sous_classe: '8899A' },
  { code: '8899B', libelle: 'Action sociale sans hébergement divers', section: 'O', division: '88', groupe: '889', classe: '8899', sous_classe: '8899B' },
  
  // Section P - Enseignement
  // (déjà inclus dans la section O ci-dessus)
  
  // Section Q - Santé humaine et action sociale
  // (déjà inclus dans la section O ci-dessus)
  
  // Section R - Arts, spectacles et activités récréatives
  { code: '9001Z', libelle: 'Arts du spectacle vivant', section: 'R', division: '90', groupe: '900', classe: '9001', sous_classe: '9001Z' },
  { code: '9002Z', libelle: 'Activités de soutien au spectacle vivant', section: 'R', division: '90', groupe: '900', classe: '9002', sous_classe: '9002Z' },
  { code: '9003A', libelle: 'Création artistique relevant des arts plastiques', section: 'R', division: '90', groupe: '900', classe: '9003', sous_classe: '9003A' },
  { code: '9003B', libelle: 'Autre création artistique', section: 'R', division: '90', groupe: '900', classe: '9003', sous_classe: '9003B' },
  { code: '9004Z', libelle: 'Gestion de salles de spectacles', section: 'R', division: '90', groupe: '900', classe: '9004', sous_classe: '9004Z' },
  { code: '9101Z', libelle: 'Gestion des bibliothèques et des archives', section: 'R', division: '91', groupe: '910', classe: '9101', sous_classe: '9101Z' },
  { code: '9102Z', libelle: 'Gestion des musées', section: 'R', division: '91', groupe: '910', classe: '9102', sous_classe: '9102Z' },
  { code: '9103Z', libelle: 'Gestion des sites et monuments historiques et des attractions touristiques similaires', section: 'R', division: '91', groupe: '910', classe: '9103', sous_classe: '9103Z' },
  { code: '9104Z', libelle: 'Gestion des jardins botaniques et zoologiques et des réserves naturelles', section: 'R', division: '91', groupe: '910', classe: '9104', sous_classe: '9104Z' },
  { code: '9200Z', libelle: 'Organisation de jeux de hasard et d\'argent', section: 'R', division: '92', groupe: '920', classe: '9200', sous_classe: '9200Z' },
  { code: '9311Z', libelle: 'Gestion d\'installations sportives', section: 'R', division: '93', groupe: '931', classe: '9311', sous_classe: '9311Z' },
  { code: '9312Z', libelle: 'Activités de clubs de sports', section: 'R', division: '93', groupe: '931', classe: '9312', sous_classe: '9312Z' },
  { code: '9313Z', libelle: 'Activités des centres de culture physique', section: 'R', division: '93', groupe: '931', classe: '9313', sous_classe: '9313Z' },
  { code: '9319Z', libelle: 'Autres activités liées au sport', section: 'R', division: '93', groupe: '931', classe: '9319', sous_classe: '9319Z' },
  { code: '9321Z', libelle: 'Activités des parcs d\'attractions et parcs à thèmes', section: 'R', division: '93', groupe: '932', classe: '9321', sous_classe: '9321Z' },
  { code: '9329Z', libelle: 'Autres activités récréatives et de loisirs', section: 'R', division: '93', groupe: '932', classe: '9329', sous_classe: '9329Z' },
  
  // Section S - Autres activités de services
  { code: '9411Z', libelle: 'Activités des organisations patronales et consulaires', section: 'S', division: '94', groupe: '941', classe: '9411', sous_classe: '9411Z' },
  { code: '9412Z', libelle: 'Activités des organisations professionnelles', section: 'S', division: '94', groupe: '941', classe: '9412', sous_classe: '9412Z' },
  { code: '9420Z', libelle: 'Activités des syndicats de salariés', section: 'S', division: '94', groupe: '942', classe: '9420', sous_classe: '9420Z' },
  { code: '9491Z', libelle: 'Activités des organisations religieuses', section: 'S', division: '94', groupe: '949', classe: '9491', sous_classe: '9491Z' },
  { code: '9492Z', libelle: 'Activités des organisations politiques', section: 'S', division: '94', groupe: '949', classe: '9492', sous_classe: '9492Z' },
  { code: '9499Z', libelle: 'Autres organisations fonctionnant par adhésion volontaire', section: 'S', division: '94', groupe: '949', classe: '9499', sous_classe: '9499Z' },
  { code: '9511Z', libelle: 'Réparation d\'ordinateurs et d\'équipements périphériques', section: 'S', division: '95', groupe: '951', classe: '9511', sous_classe: '9511Z' },
  { code: '9512Z', libelle: 'Réparation d\'équipements de communication', section: 'S', division: '95', groupe: '951', classe: '9512', sous_classe: '9512Z' },
  { code: '9521Z', libelle: 'Réparation de produits électroniques grand public', section: 'S', division: '95', groupe: '952', classe: '9521', sous_classe: '9521Z' },
  { code: '9522Z', libelle: 'Réparation d\'appareils électroménagers et d\'équipements pour la maison et le jardin', section: 'S', division: '95', groupe: '952', classe: '9522', sous_classe: '9522Z' },
  { code: '9523Z', libelle: 'Réparation de chaussures et d\'articles en cuir', section: 'S', division: '95', groupe: '952', classe: '9523', sous_classe: '9523Z' },
  { code: '9524Z', libelle: 'Réparation de meubles et d\'équipements du foyer', section: 'S', division: '95', groupe: '952', classe: '9524', sous_classe: '9524Z' },
  { code: '9525Z', libelle: 'Réparation d\'articles d\'horlogerie et de bijouterie', section: 'S', division: '95', groupe: '952', classe: '9525', sous_classe: '9525Z' },
  { code: '9529Z', libelle: 'Réparation d\'autres biens personnels et domestiques', section: 'S', division: '95', groupe: '952', classe: '9529', sous_classe: '9529Z' },
  { code: '9601A', libelle: 'Blanchisserie-teinturerie de gros', section: 'S', division: '96', groupe: '960', classe: '9601', sous_classe: '9601A' },
  { code: '9601B', libelle: 'Blanchisserie-teinturerie de détail', section: 'S', division: '96', groupe: '960', classe: '9601', sous_classe: '9601B' },
  { code: '9602A', libelle: 'Coiffure', section: 'S', division: '96', groupe: '960', classe: '9602', sous_classe: '9602A' },
  { code: '9602B', libelle: 'Soins de beauté', section: 'S', division: '96', groupe: '960', classe: '9602', sous_classe: '9602B' },
  { code: '9603Z', libelle: 'Services funéraires', section: 'S', division: '96', groupe: '960', classe: '9603', sous_classe: '9603Z' },
  { code: '9604Z', libelle: 'Entretien corporel', section: 'S', division: '96', groupe: '960', classe: '9604', sous_classe: '9604Z' },
  { code: '9609Z', libelle: 'Autres services personnels n.c.a.', section: 'S', division: '96', groupe: '960', classe: '9609', sous_classe: '9609Z' },
  
  // Section T - Activités des ménages en tant qu'employeurs ; activités indifférenciées des ménages en tant que producteurs de biens et services pour usage propre
  { code: '9700Z', libelle: 'Activités des ménages en tant qu\'employeurs de personnel domestique', section: 'T', division: '97', groupe: '970', classe: '9700', sous_classe: '9700Z' },
  { code: '9810Z', libelle: 'Activités indifférenciées des ménages en tant que producteurs de biens pour usage propre', section: 'T', division: '98', groupe: '981', classe: '9810', sous_classe: '9810Z' },
  { code: '9820Z', libelle: 'Activités indifférenciées des ménages en tant que producteurs de services pour usage propre', section: 'T', division: '98', groupe: '982', classe: '9820', sous_classe: '9820Z' },
  
  // Section U - Activités des organisations et organismes extraterritoriaux
  { code: '9900Z', libelle: 'Activités des organisations et organismes extraterritoriaux', section: 'U', division: '99', groupe: '990', classe: '9900', sous_classe: '9900Z' },
];

// Générer le fichier SQL
const sqlContent = `/*
  # Seed des codes APE/NAF
  
  Ce fichier contient ${codesAPENAF.length} codes APE/NAF officiels français.
  Pour obtenir la liste complète des 732 codes, consultez le site de l'INSEE.
*/

INSERT INTO codes_ape_naf (
  code,
  libelle,
  section,
  division,
  groupe,
  classe,
  sous_classe,
  est_actif
) VALUES
${codesAPENAF.map((item, index) => {
  const libelleEscaped = item.libelle.replace(/'/g, "''");
  return `  ('${item.code}', '${libelleEscaped}', '${item.section}', '${item.division}', '${item.groupe}', '${item.classe}', '${item.sous_classe}', true)${index < codesAPENAF.length - 1 ? ',' : ''}`;
}).join('\n')}
ON CONFLICT (code) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  section = EXCLUDED.section,
  division = EXCLUDED.division,
  groupe = EXCLUDED.groupe,
  classe = EXCLUDED.classe,
  sous_classe = EXCLUDED.sous_classe,
  updated_at = now();
`;

// Écrire le fichier
const outputPath = path.join(__dirname, '../supabase/migrations/20250202000008_seed_codes_ape_naf.sql');
fs.writeFileSync(outputPath, sqlContent, 'utf8');

console.log(`✅ Fichier SQL généré : ${outputPath}`);
console.log(`📊 ${codesAPENAF.length} codes APE/NAF inclus`);
console.log(`⚠️  Note: Ce fichier contient les codes les plus courants. Pour la liste complète des 732 codes, consultez le site de l'INSEE.`);

