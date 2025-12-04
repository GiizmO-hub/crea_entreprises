import jsPDF from 'jspdf';
import { supabase } from './supabase';

interface ContratData {
  collaborateur: {
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    date_naissance?: string;
    numero_securite_sociale?: string;
  };
  entreprise: {
    nom: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    siret?: string;
    email?: string;
    telephone?: string;
    forme_juridique?: string;
    capital?: number;
  };
  contrat: {
    type_contrat: string;
    poste: string;
    date_entree: string;
    salaire_brut?: number;
    nombre_heures_hebdo?: number;
    nombre_heures_mensuelles?: number;
    forfait_jours?: number;
    est_cadre: boolean;
    statut_professionnel?: string;
    convention_collective_nom?: string;
    convention_collective_numero?: string;
    fonctions_poste?: string; // Description détaillée des fonctions
    lieu_travail?: string; // Lieu de travail principal
    periode_essai_jours?: number; // Durée période d'essai en jours
    horaires_travail?: string; // Horaires de travail
    a_mutuelle?: boolean; // Mutuelle d'entreprise
    mutuelle_nom?: string;
  };
}

// Fonction utilitaire pour vérifier si on doit ajouter une nouvelle page
function checkPageBreak(doc: jsPDF, yPos: number, pageHeight: number, margin: number): number {
  if (yPos > pageHeight - 30) {
    doc.addPage();
    return margin;
  }
  return yPos;
}

// Fonction pour ajouter un article avec gestion automatique des pages
function addArticle(
  doc: jsPDF,
  title: string,
  content: string[],
  yPos: number,
  pageWidth: number,
  pageHeight: number,
  margin: number
): number {
  let currentY = yPos;
  
  // Vérifier l'espace pour le titre
  currentY = checkPageBreak(doc, currentY, pageHeight, margin);
  
  // Titre de l'article
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(title, margin, currentY);
  currentY += 8;
  
  // Contenu
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  content.forEach((line) => {
    currentY = checkPageBreak(doc, currentY, pageHeight, margin);
    
    // Gérer les lignes longues avec splitText
    const lines = doc.splitTextToSize(line, pageWidth - 2 * margin);
    lines.forEach((textLine: string) => {
      currentY = checkPageBreak(doc, currentY, pageHeight, margin);
      doc.text(textLine, margin, currentY);
      currentY += 6;
    });
  });
  
  currentY += 5; // Espace après l'article
  return currentY;
}

export async function generatePDFContrat(data: ContratData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Couleurs
  const primaryColor = [59, 130, 246]; // Blue-500
  const textColor = [30, 30, 30];
  const lightGray = [200, 200, 200];

  // ============================================
  // PAGE 1 - EN-TÊTE ET IDENTIFICATION
  // ============================================
  
  // Titre sans bandeau bleu
  doc.setTextColor(...textColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRAT DE TRAVAIL', pageWidth / 2, margin + 10, { align: 'center' });

  yPos = margin + 25;

  // Ligne de séparation sous le titre
  doc.setDrawColor(...lightGray);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Informations de l'entreprise et du salarié côte à côte
  const colWidth = (pageWidth - 3 * margin) / 2; // Largeur de chaque colonne
  const leftColX = margin;
  const rightColX = margin + colWidth + margin;

  // Colonne gauche - EMPLOYEUR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('EMPLOYEUR', leftColX, yPos);
  
  let leftY = yPos + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.entreprise.nom, leftColX, leftY);
  leftY += 5;
  
  if (data.entreprise.forme_juridique) {
    doc.text(`Forme: ${data.entreprise.forme_juridique}`, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.adresse) {
    doc.text(data.entreprise.adresse, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.code_postal && data.entreprise.ville) {
    doc.text(`${data.entreprise.code_postal} ${data.entreprise.ville}`, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.siret) {
    doc.text(`SIRET: ${data.entreprise.siret}`, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.capital) {
    doc.text(`Capital: ${data.entreprise.capital.toFixed(2)} €`, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.email) {
    doc.text(`Email: ${data.entreprise.email}`, leftColX, leftY);
    leftY += 5;
  }
  
  if (data.entreprise.telephone) {
    doc.text(`Tel: ${data.entreprise.telephone}`, leftColX, leftY);
    leftY += 5;
  }

  // Colonne droite - SALARIÉ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SALARIÉ', rightColX, yPos);
  
  let rightY = yPos + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${data.collaborateur.prenom} ${data.collaborateur.nom}`, rightColX, rightY);
  rightY += 5;
  
  if (data.collaborateur.date_naissance) {
    const dateNaissance = new Date(data.collaborateur.date_naissance).toLocaleDateString('fr-FR');
    doc.text(`Né(e) le: ${dateNaissance}`, rightColX, rightY);
    rightY += 5;
  }
  
  if (data.collaborateur.adresse) {
    doc.text(data.collaborateur.adresse, rightColX, rightY);
    rightY += 5;
  }
  
  if (data.collaborateur.code_postal && data.collaborateur.ville) {
    doc.text(`${data.collaborateur.code_postal} ${data.collaborateur.ville}`, rightColX, rightY);
    rightY += 5;
  }
  
  if (data.collaborateur.email) {
    doc.text(`Email: ${data.collaborateur.email}`, rightColX, rightY);
    rightY += 5;
  }
  
  if (data.collaborateur.telephone) {
    doc.text(`Tel: ${data.collaborateur.telephone}`, rightColX, rightY);
    rightY += 5;
  }
  
  if (data.collaborateur.numero_securite_sociale) {
    doc.text(`N° SS: ${data.collaborateur.numero_securite_sociale}`, rightColX, rightY);
    rightY += 5;
  }

  // Prendre le Y le plus bas des deux colonnes
  yPos = Math.max(leftY, rightY) + 10;

  // Ligne de séparation
  doc.setDrawColor(...lightGray);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ============================================
  // ARTICLE 1 - NATURE DU CONTRAT
  // ============================================
  const typeContrat = data.contrat.type_contrat || data.contrat.statut_professionnel || 'CDI';
  const natureContrat = typeContrat === 'CDI' ? 'indéterminée (CDI)' : typeContrat === 'CDD' ? 'déterminée (CDD)' : typeContrat;
  
  yPos = addArticle(
    doc,
    'ARTICLE 1 - NATURE DU CONTRAT',
    [
      `Le présent contrat est un contrat de travail à durée ${natureContrat}.`,
      `Le salarié est engagé au poste de: ${data.contrat.poste || 'Non spécifié'}.`,
      data.contrat.est_cadre ? 'Le salarié est engagé en qualité de cadre.' : 'Le salarié est engagé en qualité de non-cadre.',
      'Le présent contrat est régi par les dispositions du Code du travail français et, le cas échéant, par la convention collective applicable.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 2 - DATE D'ENTRÉE ET PÉRIODE D'ESSAI
  // ============================================
  const dateEntree = data.contrat.date_entree ? new Date(data.contrat.date_entree).toLocaleDateString('fr-FR') : 'Non spécifiée';
  const periodeEssai = data.contrat.periode_essai_jours || (data.contrat.est_cadre ? 90 : 30);
  const periodeEssaiRenouvelable = data.contrat.est_cadre ? 90 : 30;
  
  yPos = addArticle(
    doc,
    'ARTICLE 2 - DATE D\'ENTRÉE ET PÉRIODE D\'ESSAI',
    [
      `Le salarié prendra ses fonctions le: ${dateEntree}.`,
      `Le présent contrat est conclu sous réserve d'une période d'essai de ${periodeEssai} jours calendaires, renouvelable une fois pour une durée maximale de ${periodeEssaiRenouvelable} jours calendaires.`,
      'Pendant la période d\'essai, chacune des parties peut rompre le contrat sans préavis ni indemnité de rupture, sauf disposition conventionnelle plus favorable.',
      'La période d\'essai peut être rompue à tout moment par l\'une ou l\'autre des parties, sans motif, par lettre recommandée avec accusé de réception ou remise contre récépissé.',
      'En cas de rupture de la période d\'essai par l\'employeur, le salarié a droit à une indemnité compensatrice de congés payés proportionnelle à la durée de la période d\'essai effectuée.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 3 - LIEU DE TRAVAIL
  // ============================================
  const lieuTravail = data.contrat.lieu_travail || 
    (data.entreprise.adresse && data.entreprise.ville 
      ? `${data.entreprise.adresse}, ${data.entreprise.code_postal} ${data.entreprise.ville}`
      : 'Siège social de l\'entreprise');
  
  yPos = addArticle(
    doc,
    'ARTICLE 3 - LIEU DE TRAVAIL',
    [
      `Le salarié exercera ses fonctions au ${lieuTravail}.`,
      'L\'employeur se réserve la possibilité d\'affecter le salarié sur un autre site de l\'entreprise, dans un périmètre géographique raisonnable, après l\'avoir informé dans un délai raisonnable.',
      'En cas de déplacement temporaire, l\'employeur prendra en charge les frais de transport et d\'hébergement selon les modalités en vigueur dans l\'entreprise.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 4 - DESCRIPTION DES FONCTIONS
  // ============================================
  const fonctionsPoste = data.contrat.fonctions_poste || 
    `Le salarié exercera les fonctions liées au poste de ${data.contrat.poste || 'Non spécifié'}. 
    Il/Elle sera chargé(e) d'assurer les missions confiées par sa hiérarchie dans le respect des objectifs fixés par l'entreprise.`;
  
  yPos = addArticle(
    doc,
    'ARTICLE 4 - DESCRIPTION DES FONCTIONS',
    [
      fonctionsPoste,
      'Le salarié s\'engage à exercer ses fonctions avec diligence, loyauté et dans l\'intérêt de l\'entreprise.',
      'Il/Elle devra respecter les instructions de sa hiérarchie et se conformer aux règles de sécurité, d\'hygiène et de discipline en vigueur dans l\'entreprise.',
      'L\'employeur se réserve le droit de modifier les fonctions du salarié dans le cadre de son poste, en fonction des besoins de l\'entreprise, tout en respectant sa qualification professionnelle.',
      'Toute modification substantielle des fonctions devra faire l\'objet d\'un avenant au présent contrat.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 5 - DURÉE DU TRAVAIL
  // ============================================
  let dureeTravail: string[] = [];
  
  if (data.contrat.forfait_jours && data.contrat.est_cadre) {
    dureeTravail = [
      `Le salarié est soumis à un forfait jours de ${data.contrat.forfait_jours} jours par an, conformément aux dispositions légales applicables aux cadres.`,
      'Le salarié organise librement son temps de travail dans le respect des contraintes de l\'entreprise et des objectifs qui lui sont assignés.',
      'Le salarié bénéficie d\'un nombre de jours de repos équivalent aux jours travaillés au-delà de la durée légale du travail.'
    ];
  } else if (data.contrat.nombre_heures_hebdo) {
    dureeTravail = [
      `La durée du travail est fixée à ${data.contrat.nombre_heures_hebdo} heures par semaine.`,
      data.contrat.nombre_heures_mensuelles 
        ? `Soit ${data.contrat.nombre_heures_mensuelles} heures par mois (moyenne sur l'année).`
        : 'La durée mensuelle est calculée selon les dispositions légales en vigueur.',
      data.contrat.horaires_travail 
        ? `Les horaires de travail sont les suivants: ${data.contrat.horaires_travail}.`
        : 'Les horaires de travail seront communiqués au salarié lors de sa prise de fonction.',
      'Les heures supplémentaires effectuées au-delà de la durée légale du travail donneront lieu à rémunération ou à récupération selon les modalités prévues par la convention collective applicable.',
      'Le salarié bénéficie d\'un temps de pause d\'au moins 20 minutes consécutives pour une journée de travail de plus de 6 heures.'
    ];
  } else {
    dureeTravail = [
      'La durée du travail est fixée selon les dispositions légales en vigueur et la convention collective applicable.',
      'Les horaires de travail seront communiqués au salarié lors de sa prise de fonction.'
    ];
  }
  
  yPos = addArticle(
    doc,
    'ARTICLE 5 - DURÉE ET ORGANISATION DU TRAVAIL',
    dureeTravail,
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 6 - RÉMUNÉRATION
  // ============================================
  let remuneration: string[] = [];
  
  if (data.contrat.salaire_brut) {
    const salaireAnnuel = data.contrat.salaire_brut * 12;
    remuneration = [
      `Le salaire brut mensuel est fixé à ${data.contrat.salaire_brut.toFixed(2)} €.`,
      `Soit un salaire brut annuel de ${salaireAnnuel.toFixed(2)} €.`,
      'Le salaire est versé mensuellement, par virement bancaire, le dernier jour ouvrable du mois de travail.',
      'Le salarié recevra un bulletin de paie détaillé indiquant les éléments de rémunération, les cotisations sociales et le net à payer.',
      'Le salaire peut être révisé annuellement, en fonction de l\'évolution des responsabilités, de la performance et de la situation économique de l\'entreprise.',
      'Toute modification du salaire fera l\'objet d\'un avenant au présent contrat.'
    ];
  } else {
    remuneration = [
      'Le salaire sera fixé selon les dispositions de la convention collective applicable et les grilles de salaires en vigueur dans l\'entreprise.',
      'Le salaire sera communiqué au salarié lors de sa prise de fonction.',
      'Le salaire est versé mensuellement, par virement bancaire, le dernier jour ouvrable du mois de travail.'
    ];
  }
  
  yPos = addArticle(
    doc,
    'ARTICLE 6 - RÉMUNÉRATION',
    remuneration,
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 7 - CONVENTION COLLECTIVE
  // ============================================
  if (data.contrat.convention_collective_nom || data.contrat.convention_collective_numero) {
    let convText = 'Le présent contrat est régi par';
    if (data.contrat.convention_collective_numero) {
      convText += ` la convention collective n° ${data.contrat.convention_collective_numero}`;
    }
    if (data.contrat.convention_collective_nom) {
      convText += ` (${data.contrat.convention_collective_nom})`;
    }
    convText += '.';
    
    yPos = addArticle(
      doc,
      'ARTICLE 7 - CONVENTION COLLECTIVE',
      [
        convText,
        'La convention collective est consultable sur le site du ministère du Travail ou auprès de l\'employeur.',
        'En cas de conflit entre les dispositions du présent contrat et celles de la convention collective, les dispositions les plus favorables au salarié s\'appliquent.'
      ],
      yPos,
      pageWidth,
      pageHeight,
      margin
    );
  }

  // ============================================
  // ARTICLE 8 - CONGÉS PAYÉS
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 8 - CONGÉS PAYÉS',
    [
      'Le salarié bénéficie de congés payés dans les conditions prévues par le Code du travail et la convention collective applicable.',
      'La durée des congés payés est de 2,5 jours ouvrables par mois de travail effectif, soit 30 jours ouvrables (5 semaines) pour une année complète de travail.',
      'Les dates de prise des congés sont fixées d\'un commun accord entre l\'employeur et le salarié, en tenant compte des nécessités de fonctionnement de l\'entreprise.',
      'Le salarié doit informer l\'employeur de ses souhaits de congés au moins un mois à l\'avance.',
      'Les congés payés sont payés selon les modalités prévues par la convention collective ou, à défaut, selon les dispositions légales en vigueur.',
      'En cas de rupture du contrat, les congés payés acquis et non pris donnent lieu au paiement d\'une indemnité compensatrice.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 9 - ABSENCES ET CONGÉS EXCEPTIONNELS
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 9 - ABSENCES ET CONGÉS EXCEPTIONNELS',
    [
      'Le salarié bénéficie des congés exceptionnels prévus par le Code du travail et la convention collective applicable, notamment:',
      '- Congés pour événements familiaux (mariage, décès, naissance, etc.)',
      '- Congés pour formation',
      '- Congés sans solde (sous réserve d\'accord de l\'employeur)',
      'Toute absence doit être justifiée et portée à la connaissance de l\'employeur dans les meilleurs délais.',
      'En cas d\'absence pour maladie ou accident, le salarié doit fournir un certificat médical dans les 48 heures suivant le début de l\'absence.',
      'Les absences non justifiées peuvent entraîner des sanctions disciplinaires.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 10 - PROTECTION SOCIALE
  // ============================================
  let protectionSociale: string[] = [
    'Le salarié bénéficie de la protection sociale prévue par la législation en vigueur:',
    '- Assurance maladie, maternité, invalidité, décès',
    '- Assurance vieillesse',
    '- Assurance chômage',
    '- Accidents du travail et maladies professionnelles',
    '- Retraite complémentaire'
  ];
  
  if (data.contrat.a_mutuelle && data.contrat.mutuelle_nom) {
    protectionSociale.push(`- Mutuelle d'entreprise: ${data.contrat.mutuelle_nom}`);
    protectionSociale.push('La cotisation à la mutuelle d\'entreprise est prise en charge partiellement par l\'employeur selon les modalités en vigueur.');
  }
  
  protectionSociale.push('Le salarié peut consulter les conditions détaillées de sa protection sociale auprès du service des ressources humaines.');
  
  yPos = addArticle(
    doc,
    'ARTICLE 10 - PROTECTION SOCIALE',
    protectionSociale,
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 11 - FORMATION PROFESSIONNELLE
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 11 - FORMATION PROFESSIONNELLE',
    [
      'L\'employeur s\'engage à favoriser l\'évolution professionnelle du salarié et peut proposer des actions de formation professionnelle.',
      'Le salarié bénéficie du compte personnel de formation (CPF) et peut utiliser ses droits à la formation selon les modalités prévues par la législation.',
      'Toute formation suivie pendant le temps de travail est rémunérée comme du temps de travail effectif.',
      'Les formations suivies en dehors du temps de travail peuvent donner lieu à une compensation selon les modalités prévues par la convention collective.',
      'Le salarié s\'engage à suivre les formations obligatoires ou nécessaires à l\'exercice de ses fonctions.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 12 - OBLIGATIONS DU SALARIÉ
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 12 - OBLIGATIONS DU SALARIÉ',
    [
      'Le salarié s\'engage à:',
      '- Exercer ses fonctions avec diligence, loyauté et dans l\'intérêt de l\'entreprise',
      '- Respecter les horaires de travail et les règles de discipline en vigueur',
      '- Respecter les instructions de sa hiérarchie',
      '- Respecter les règles de sécurité, d\'hygiène et de protection de l\'environnement',
      '- Respecter la confidentialité des informations relatives à l\'entreprise',
      '- Ne pas exercer d\'activité concurrente pendant la durée du contrat',
      '- Informer l\'employeur de toute absence dans les meilleurs délais',
      '- Respecter les valeurs et l\'éthique de l\'entreprise'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 13 - OBLIGATIONS DE L'EMPLOYEUR
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 13 - OBLIGATIONS DE L\'EMPLOYEUR',
    [
      'L\'employeur s\'engage à:',
      '- Fournir au salarié un travail conforme à sa qualification',
      '- Verser la rémunération convenue aux échéances prévues',
      '- Respecter les dispositions légales et conventionnelles en matière de durée du travail, de repos et de congés',
      '- Assurer la sécurité et la santé du salarié dans l\'exercice de ses fonctions',
      '- Informer le salarié des risques professionnels et des mesures de prévention',
      '- Respecter la dignité du salarié et prévenir toute forme de harcèlement',
      '- Permettre au salarié de bénéficier de ses droits à la formation professionnelle',
      '- Respecter la vie privée du salarié'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 14 - CLAUSE DE CONFIDENTIALITÉ
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 14 - CLAUSE DE CONFIDENTIALITÉ',
    [
      'Le salarié s\'engage à ne pas divulguer, pendant et après la fin de son contrat, les informations confidentielles dont il aura eu connaissance dans l\'exercice de ses fonctions.',
      'Sont considérées comme confidentielles toutes les informations relatives à:',
      '- Les données clients, fournisseurs et partenaires',
      '- Les stratégies commerciales et financières',
      '- Les procédés techniques, méthodes et savoir-faire',
      '- Les informations relatives aux salaires et conditions de travail des autres salariés',
      '- Toute autre information désignée comme confidentielle par l\'employeur',
      'Cette obligation de confidentialité s\'applique pendant toute la durée du contrat et après sa cessation, sans limitation de durée.',
      'En cas de violation de cette clause, le salarié pourra être tenu responsable des préjudices causés à l\'entreprise.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 15 - CLAUSE DE NON-CONCURRENCE
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 15 - CLAUSE DE NON-CONCURRENCE',
    [
      'Une clause de non-concurrence peut être prévue par avenant au présent contrat, dans le respect des conditions légales.',
      'Toute clause de non-concurrence doit être:',
      '- Limitée dans le temps (maximum 2 ans)',
      '- Limitée géographiquement',
      '- Limitée au secteur d\'activité concerné',
      '- Compensée financièrement',
      'En l\'absence d\'avenant spécifique, aucune clause de non-concurrence ne s\'applique au présent contrat.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 16 - PROPRIÉTÉ INTELLECTUELLE
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 16 - PROPRIÉTÉ INTELLECTUELLE',
    [
      'Toutes les créations, inventions, découvertes, améliorations, méthodes, procédés, logiciels, documents et autres œuvres de l\'esprit réalisés par le salarié dans l\'exercice de ses fonctions ou en relation avec celles-ci appartiennent à l\'employeur.',
      'Le salarié cède à l\'employeur tous ses droits de propriété intellectuelle sur ces créations, y compris les droits d\'auteur, brevets, marques et autres droits de propriété industrielle.',
      'Le salarié s\'engage à signer tous documents nécessaires pour permettre à l\'employeur de faire valoir ses droits de propriété intellectuelle.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 17 - RUPTURE DU CONTRAT
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 17 - RUPTURE DU CONTRAT',
    [
      'Le présent contrat peut prendre fin:',
      '- Par démission du salarié',
      '- Par licenciement pour motif personnel ou économique',
      '- Par rupture conventionnelle',
      '- Par mise à la retraite',
      '- Par décès du salarié',
      '- Par force majeure',
      'En cas de démission, le salarié doit respecter un préavis dont la durée est fixée par la convention collective ou, à défaut, par la loi.',
      'En cas de licenciement, l\'employeur doit respecter la procédure légale et conventionnelle applicable, notamment en matière de préavis et d\'indemnités.',
      'En cas de rupture conventionnelle, les modalités sont définies par accord entre les parties et soumises à validation de l\'administration compétente.',
      'Toute rupture du contrat doit faire l\'objet d\'un écrit et respecter les formalités légales et conventionnelles.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 18 - DISCIPLINE ET SANCTIONS
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 18 - DISCIPLINE ET SANCTIONS',
    [
      'Le salarié est tenu de respecter le règlement intérieur de l\'entreprise, s\'il existe, ainsi que les règles de discipline en vigueur.',
      'En cas de manquement aux obligations contractuelles ou aux règles de l\'entreprise, le salarié peut faire l\'objet de sanctions disciplinaires selon la procédure prévue par la convention collective ou la loi.',
      'Les sanctions disciplinaires sont:',
      '- L\'avertissement',
      '- Le blâme',
      '- La mise à pied disciplinaire',
      '- La rétrogradation',
      '- Le licenciement pour faute',
      'Toute sanction disciplinaire doit être motivée et notifiée au salarié par écrit.',
      'Le salarié dispose d\'un droit de réponse et peut contester la sanction devant les instances compétentes.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // ARTICLE 19 - DISPOSITIONS GÉNÉRALES
  // ============================================
  yPos = addArticle(
    doc,
    'ARTICLE 19 - DISPOSITIONS GÉNÉRALES',
    [
      'Le présent contrat est régi par le Code du travail français et, le cas échéant, par la convention collective applicable.',
      'Toute modification du présent contrat doit faire l\'objet d\'un avenant écrit, signé par les deux parties.',
      'En cas de litige, les parties s\'engagent à rechercher une solution amiable avant toute action judiciaire.',
      'À défaut d\'accord amiable, les litiges relèvent de la compétence des tribunaux compétents.',
      'Si une clause du présent contrat est déclarée nulle ou inapplicable, les autres clauses demeurent en vigueur.',
      'Le présent contrat est établi en deux exemplaires originaux, un pour chaque partie.'
    ],
    yPos,
    pageWidth,
    pageHeight,
    margin
  );

  // ============================================
  // SIGNATURES
  // ============================================
  yPos = checkPageBreak(doc, yPos + 10, pageHeight, margin);
  
  doc.setDrawColor(...lightGray);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  
  // Date et lieu (centré)
  const lieuSignature = data.entreprise.ville || '_____________________';
  const dateSignature = new Date().toLocaleDateString('fr-FR');
  
  doc.text(`Fait à ${lieuSignature}, le ${dateSignature}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;
  
  // Signatures côte à côte
  const sigColWidth = (pageWidth - 3 * margin) / 2;
  const sigLeftX = margin;
  const sigRightX = margin + sigColWidth + margin;
  const signatureY = yPos;
  
  // Signature employeur (gauche)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('L\'EMPLOYEUR', sigLeftX, signatureY);
  
  let sigLeftY = signatureY + 20;
  doc.setFont('helvetica', 'normal');
  doc.line(sigLeftX, sigLeftY, sigLeftX + 80, sigLeftY);
  sigLeftY += 5;
  doc.setFontSize(8);
  doc.text('Signature et cachet', sigLeftX, sigLeftY);

  // Signature salarié (droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Le SALARIÉ', sigRightX, signatureY);
  
  let sigRightY = signatureY + 20;
  doc.setFont('helvetica', 'normal');
  doc.line(sigRightX, sigRightY, sigRightX + 80, sigRightY);
  sigRightY += 5;
  doc.setFontSize(8);
  doc.text('Signature', sigRightX, sigRightY);

  // Mentions légales en bas de dernière page
  yPos = pageHeight - 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Document généré le ' + new Date().toLocaleDateString('fr-FR'), pageWidth / 2, yPos, { align: 'center' });

  // Nom du fichier
  const fileName = `Contrat_${data.collaborateur.nom}_${data.collaborateur.prenom}_${new Date().getFullYear()}.pdf`;
  
  // Télécharger le PDF
  doc.save(fileName);
}
