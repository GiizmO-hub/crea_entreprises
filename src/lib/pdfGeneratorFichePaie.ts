import jsPDF from 'jspdf';
import { supabase } from './supabase';

interface FichePaieLigne {
  libelle: string;
  base: number;
  taux_salarial?: number;
  montant_salarial?: number;
  taux_patronal?: number;
  montant_patronal?: number;
  montant_a_payer?: number;
  ordre_affichage?: number;
  groupe_affichage?: string;
}

interface FichePaieData {
  id: string;
  numero: string;
  periode_debut: string;
  periode_fin: string;
  salaire_brut: number | string;
  net_a_payer: number | string;
  collaborateur_id: string;
  entreprise_id: string;
  collaborateurs_entreprise: {
    nom: string;
    prenom: string;
    email?: string;
  };
  entreprises: {
    nom: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    siret?: string;
    email?: string;
    telephone?: string;
  };
  lignes?: FichePaieLigne[];
}

// Petit utilitaire pour arrondir à 2 décimales
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function generatePDFFichePaie(data: FichePaieData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Marges et cadre général
  const margin = 15;
  let yPos = margin;

  // Normalisation des montants
  const salaireBrut = Number(data.salaire_brut || 0);
  const netAPayer = Number(data.net_a_payer || 0);

  // Si la base est invalide, on arrête proprement
  if (!salaireBrut || salaireBrut <= 0) {
    throw new Error('Salaire brut invalide pour la génération de la fiche de paie');
  }

  // Utiliser les lignes depuis la base de données si disponibles, sinon calculer
  type LigneFusionnee = {
    libelle: string;
    base: number;
    tauxSal: number;
    montantSal: number;
    tauxPat: number;
    montantPat: number;
  };

  let lignesFusionnees: LigneFusionnee[] = [];
  let totalSalarialesCalcule = 0;
  let totalPatronalesCalcule = 0;
  let salaireNetAvantImpot = 0;
  let coutTotalEmployeur = 0;

  if (data.lignes && data.lignes.length > 0) {
    // Utiliser les lignes depuis fiches_paie_lignes
    const lignesMap = new Map<string, LigneFusionnee>();

    data.lignes.forEach((ligne) => {
      const libelle = ligne.libelle;
      const existing = lignesMap.get(libelle);
      
      if (existing) {
        // Fusionner avec la ligne existante
        existing.tauxSal = ligne.taux_salarial || existing.tauxSal;
        existing.montantSal = ligne.montant_salarial ? Math.abs(ligne.montant_salarial) : existing.montantSal;
        existing.tauxPat = ligne.taux_patronal || existing.tauxPat;
        existing.montantPat = ligne.montant_patronal || existing.montantPat;
        existing.base = ligne.base || existing.base;
      } else {
        // Créer une nouvelle ligne
        lignesMap.set(libelle, {
          libelle,
          base: ligne.base || salaireBrut,
          tauxSal: ligne.taux_salarial || 0,
          montantSal: ligne.montant_salarial ? Math.abs(ligne.montant_salarial) : 0,
          tauxPat: ligne.taux_patronal || 0,
          montantPat: ligne.montant_patronal || 0,
        });
      }
    });

    lignesFusionnees = Array.from(lignesMap.values())
      .sort((a, b) => {
        // Trier par ordre logique : salariales d'abord, puis patronales
        if (a.montantSal !== 0 && b.montantSal === 0) return -1;
        if (a.montantSal === 0 && b.montantSal !== 0) return 1;
        return 0;
      });

    totalSalarialesCalcule = round2(
      lignesFusionnees.reduce((sum, l) => sum + l.montantSal, 0)
    );
    totalPatronalesCalcule = round2(
      lignesFusionnees.reduce((sum, l) => sum + l.montantPat, 0)
    );
    salaireNetAvantImpot = round2(salaireBrut - totalSalarialesCalcule);
    coutTotalEmployeur = round2(salaireBrut + totalPatronalesCalcule);
  } else {
    // Fallback : calculer les lignes comme avant (pour compatibilité)
    const totalSalariales = Math.max(salaireBrut - netAPayer, 0);
    const lignesSalarialesBase = [
      { libelle: 'Sécurité sociale - Maladie, maternité, invalidité, décès', poids: 4 },
      { libelle: 'Sécurité sociale - Vieillesse (plafonnée)', poids: 7 },
      { libelle: 'Sécurité sociale - Vieillesse (déplafonnée)', poids: 1 },
      { libelle: 'Assurance chômage', poids: 3 },
      { libelle: 'Retraite complémentaire', poids: 4 },
      { libelle: 'CSG/CRDS déductible', poids: 6 },
      { libelle: 'CSG/CRDS non déductible', poids: 3 },
    ];

    const totalPoidsSal = lignesSalarialesBase.reduce((sum, l) => sum + l.poids, 0);
    const lignesSalariales = lignesSalarialesBase.map((l) => {
      const montant = totalPoidsSal > 0 ? (totalSalariales * l.poids) / totalPoidsSal : 0;
      const taux = salaireBrut > 0 ? (montant / salaireBrut) * 100 : 0;
      return { ...l, base: salaireBrut, taux: round2(taux), montant: round2(montant) };
    });

    totalSalarialesCalcule = round2(
      lignesSalariales.reduce((sum, l) => sum + l.montant, 0)
    );

    const totalPatronales = round2(salaireBrut * 0.42);
    const lignesPatronalesBase = [
      { libelle: 'Sécurité sociale - Maladie, maternité, invalidité, décès', poids: 6 },
      { libelle: 'Sécurité sociale - Vieillesse (plafonnée)', poids: 8 },
      { libelle: 'Sécurité sociale - Vieillesse (déplafonnée)', poids: 2 },
      { libelle: 'Allocations familiales', poids: 5 },
      { libelle: 'Accidents du travail / maladies professionnelles', poids: 3 },
      { libelle: 'Assurance chômage', poids: 4 },
      { libelle: 'Retraite complémentaire', poids: 6 },
      { libelle: 'Autres contributions (formation, etc.)', poids: 2 },
    ];

    const totalPoidsPat = lignesPatronalesBase.reduce((sum, l) => sum + l.poids, 0);
    const lignesPatronales = lignesPatronalesBase.map((l) => {
      const montant = totalPoidsPat > 0 ? (totalPatronales * l.poids) / totalPoidsPat : 0;
      const taux = salaireBrut > 0 ? (montant / salaireBrut) * 100 : 0;
      return { ...l, base: salaireBrut, taux: round2(taux), montant: round2(montant) };
    });

    totalPatronalesCalcule = round2(
      lignesPatronales.reduce((sum, l) => sum + l.montant, 0)
    );

    const lignesMap = new Map<string, LigneFusionnee>();
    lignesSalariales.forEach((l) => {
      lignesMap.set(l.libelle, {
        libelle: l.libelle,
        base: l.base,
        tauxSal: l.taux,
        montantSal: l.montant,
        tauxPat: 0,
        montantPat: 0,
      });
    });
    lignesPatronales.forEach((l) => {
      const existing = lignesMap.get(l.libelle);
      if (existing) {
        existing.tauxPat = l.taux;
        existing.montantPat = l.montant;
      } else {
        lignesMap.set(l.libelle, {
          libelle: l.libelle,
          base: l.base,
          tauxSal: 0,
          montantSal: 0,
          tauxPat: l.taux,
          montantPat: l.montant,
        });
      }
    });

    lignesFusionnees = Array.from(lignesMap.values());
    salaireNetAvantImpot = round2(salaireBrut - totalSalarialesCalcule);
    coutTotalEmployeur = round2(salaireBrut + totalPatronalesCalcule);
  }

  // Couleurs
  const primaryColor = [59, 130, 246]; // Blue-500
  const textColor = [31, 41, 55]; // Gray-800
  const lightGray = [156, 163, 175]; // Gray-400

  // Cadre général de la fiche
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setLineWidth(0.4);
  doc.rect(margin - 5, margin - 10, pageWidth - (margin - 5) * 2, pageHeight - (margin - 5) * 2, 'S');

  // En-tête simple (sans bandeau coloré)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE DE PAIE', pageWidth / 2, margin, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bulletin N° ${data.numero}`, pageWidth / 2, margin + 7, { align: 'center' });

  yPos = margin + 14;

  // Bloc informations entreprise + salarié encadré
  const infoBlockTop = yPos;
  const infoBlockHeight = 36;
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(margin, infoBlockTop, pageWidth - 2 * margin, infoBlockHeight, 'S');

  // Séparation verticale milieu
  const middleX = pageWidth / 2;
  doc.line(middleX, infoBlockTop, middleX, infoBlockTop + infoBlockHeight);

  // Informations entreprise (gauche)
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Employeur', margin + 3, yPos + 6);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.entreprises.nom || 'Entreprise', margin + 3, yPos);
  yPos += 5;
  
  if (data.entreprises.adresse) {
    doc.text(data.entreprises.adresse, margin + 3, yPos);
    yPos += 5;
  }
  
  if (data.entreprises.code_postal && data.entreprises.ville) {
    doc.text(`${data.entreprises.code_postal} ${data.entreprises.ville}`, margin + 3, yPos);
    yPos += 5;
  }
  
  if (data.entreprises.siret) {
    doc.text(`SIRET: ${data.entreprises.siret}`, margin + 3, yPos);
    yPos += 5;
  }

  // Informations salarié (droite)
  yPos = infoBlockTop + 8;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Salarié', pageWidth - margin - 3, yPos, { align: 'right' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const salarieNom = `${data.collaborateurs_entreprise.prenom} ${data.collaborateurs_entreprise.nom}`;
  doc.text(salarieNom, pageWidth - margin - 3, yPos, { align: 'right' });
  yPos += 5;
  
  if (data.collaborateurs_entreprise.email) {
    doc.text(data.collaborateurs_entreprise.email, pageWidth - margin - 3, yPos, { align: 'right' });
    yPos += 5;
  }

  yPos = infoBlockTop + infoBlockHeight + 8;

  // Période
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Période', margin, yPos);
  
  const periodeDebut = new Date(data.periode_debut).toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const periodeFin = new Date(data.periode_fin).toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Du ${periodeDebut} au ${periodeFin}`, margin + 30, yPos);
  yPos += 15;

  // Bloc Salaire brut
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Rémunération', margin + 6, yPos + 8);
  yPos += 18;

  doc.setFont('helvetica', 'normal');
  doc.text('Salaire brut', margin + 6, yPos);
  doc.text(`${salaireBrut.toFixed(2)} €`, pageWidth - margin - 5, yPos, { align: 'right' });
  yPos += 10;

  // Tableau unique des charges : inspiré d'un bulletin standard
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Éléments de paie / Cotisations sociales', margin + 6, yPos + 8);
  yPos += 16;

  doc.setFontSize(8.5);
  // Colonnes : Éléments de paie | Base | Taux | À déduire | Charges patronales
  const tableStartX = margin + 3;                  // Rubrique très proche du cadre gauche
  const colBaseX = tableStartX + 55;               // Base
  const colTauxX = tableStartX + 83;               // Taux (salarié)
  const colADeduireX = tableStartX + 113;          // À déduire (part salarié)
  const colChargesPatX = pageWidth - margin - 6;   // Charges patronales (part employeur)

  doc.text('Éléments de paie', tableStartX, yPos);
  doc.text('Base', colBaseX, yPos, { align: 'right' });
  doc.text('Taux', colTauxX, yPos, { align: 'right' });
  doc.text('À déduire', colADeduireX, yPos, { align: 'right' });
  doc.text('Charges patronales', colChargesPatX, yPos, { align: 'right' });
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  lignesFusionnees.forEach((l) => {
    // Éléments de paie
    doc.text(l.libelle, tableStartX, yPos);
    // Base toujours le salaire brut (affiché une seule fois par ligne)
    doc.text(`${salaireBrut.toFixed(2)} €`, colBaseX, yPos, { align: 'right' });
    // Taux salarié (si existant)
    if (l.tauxSal > 0) {
      doc.text(`${l.tauxSal.toFixed(2)} %`, colTauxX, yPos, { align: 'right' });
      doc.text(`-${l.montantSal.toFixed(2)} €`, colADeduireX, yPos, { align: 'right' });
    }
    // Charges patronales
    if (l.tauxPat > 0 || l.montantPat !== 0) {
      doc.text(`${l.montantPat.toFixed(2)} €`, colChargesPatX, yPos, { align: 'right' });
    }
    yPos += 4.5;
  });

  // Totaux en bas du tableau
  yPos += 2;
  doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Total part salarié', tableStartX, yPos);
  doc.text(`-${totalSalarialesCalcule.toFixed(2)} €`, colADeduireX, yPos, { align: 'right' });
  yPos += 5;
  doc.text('Total part employeur', tableStartX, yPos);
  doc.text(`${totalPatronalesCalcule.toFixed(2)} €`, colChargesPatX, yPos, { align: 'right' });
  yPos += 5;

  doc.setFontSize(9.5);
  doc.text('Salaire net avant impôt', tableStartX, yPos);
  doc.text(`${salaireNetAvantImpot.toFixed(2)} €`, colADeduireX, yPos, { align: 'right' });
  yPos += 5;
  doc.text('Net à payer', tableStartX, yPos);
  doc.text(`${netAPayer.toFixed(2)} €`, colADeduireX, yPos, { align: 'right' });
  yPos += 5;
  doc.text('Coût total employeur', tableStartX, yPos);
  doc.text(`${coutTotalEmployeur.toFixed(2)} €`, colChargesPatX, yPos, { align: 'right' });
  yPos += 12;

  // Bloc Congés payés (vision simple et indicative)
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Droits à congés payés (indicatif)', margin + 6, yPos + 8);
  yPos += 16;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const congesCol1 = margin + 6;
  const congesCol2 = congesCol1 + 60;
  const congesCol3 = congesCol2 + 60;

  doc.text('Congés acquis', congesCol1, yPos);
  doc.text('Congés pris', congesCol2, yPos);
  doc.text('Solde', congesCol3, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  // Hypothèse simple : 2,5 jours acquis sur la période, rien de pris (à adapter plus tard avec les vraies données)
  const congesAcquis = 2.5;
  const congesPris = 0;
  const congesSolde = congesAcquis - congesPris;
  doc.text(`${congesAcquis.toFixed(2)} j`, congesCol1, yPos);
  doc.text(`${congesPris.toFixed(2)} j`, congesCol2, yPos);
  doc.text(`${congesSolde.toFixed(2)} j`, congesCol3, yPos);
  yPos += 14;

  // Mentions légales
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text(
    'Bulletin établi à titre indicatif. Les taux et montants de cotisations peuvent varier selon la convention collective, les accords d\'entreprise et la législation en vigueur.',
    margin,
    pageHeight - 32,
    { maxWidth: pageWidth - 2 * margin }
  );
  doc.text(
    'Ce document ne se substitue pas à un bulletin de paie officiel mais reprend la structure légale principale (rémunération, cotisations, congés, net à payer, coût employeur).',
    margin,
    pageHeight - 24,
    { maxWidth: pageWidth - 2 * margin }
  );
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, pageHeight - 14);

  // Télécharger le PDF
  const fileName = `Fiche_Paie_${data.numero}_${data.collaborateurs_entreprise.nom}_${data.collaborateurs_entreprise.prenom}.pdf`;
  doc.save(fileName);
}

