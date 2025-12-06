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
  net_imposable?: number | string;
  total_cotisations_salariales?: number | string;
  total_cotisations_patronales?: number | string;
  cout_total_employeur?: number | string;
  heures_normales?: number | string;
  heures_supp_25?: number | string;
  heures_supp_50?: number | string;
  collaborateur_id: string;
  entreprise_id: string;
  collaborateurs_entreprise: {
    nom: string;
    prenom: string;
    email?: string;
    poste?: string;
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

// Fonction pour formater un montant en euros
function formatCurrency(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

// Fonction pour calculer les allègements de cotisations patronales (Réduction générale)
// Basée sur la formule de la réduction générale des cotisations patronales 2025
function calculerAllegements(salaireBrut: number, cotisationsPatronales: number): number {
  // SMIC mensuel 2025
  const SMIC_MENSUEL = 1826.40;
  
  // Seuils pour la réduction générale
  const SEUIL_MIN = SMIC_MENSUEL * 1.6; // 2,922.24 €
  const SEUIL_MAX = SMIC_MENSUEL * 3.5; // 6,392.40 €
  
  // Si le salaire brut est en dehors des seuils, pas d'allègement
  if (salaireBrut < SEUIL_MIN || salaireBrut > SEUIL_MAX) {
    return 0;
  }
  
  // Coefficient de réduction (formule simplifiée)
  // Coefficient = (0,3191 / 0,6) × ((1,6 × SMIC / salaire brut) - 1)
  const coefficient = (0.3191 / 0.6) * ((1.6 * SMIC_MENSUEL / salaireBrut) - 1);
  
  // Limiter le coefficient entre 0 et 0,3191
  const coefficientLimite = Math.max(0, Math.min(0.3191, coefficient));
  
  // Allègement = coefficient × cotisations patronales (limité aux cotisations éligibles)
  // On applique environ 80% des cotisations patronales sont éligibles
  const cotisationsEligibles = cotisationsPatronales * 0.80;
  const allegement = round2(coefficientLimite * cotisationsEligibles);
  
  return allegement;
}

export async function generatePDFFichePaie(data: FichePaieData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Marges professionnelles
  const margin = 15;
  const marginTop = 20;
  let yPos = marginTop;

  // Normalisation des montants
  const salaireBrut = Number(data.salaire_brut || 0);
  const netAPayer = Number(data.net_a_payer || 0);
  const netImposable = Number(data.net_imposable || 0);
  const totalCotisationsSalariales = Number(data.total_cotisations_salariales || 0);
  const totalCotisationsPatronales = Number(data.total_cotisations_patronales || 0);
  const coutTotalEmployeur = Number(data.cout_total_employeur || 0);

  // Si la base est invalide, on arrête proprement
  if (!salaireBrut || salaireBrut <= 0) {
    throw new Error('Salaire brut invalide pour la génération de la fiche de paie');
  }

  // Couleurs professionnelles
  const primaryColor = [59, 130, 246]; // Bleu professionnel
  const darkGray = [31, 41, 55]; // Texte principal
  const mediumGray = [107, 114, 128]; // Texte secondaire
  const lightGray = [243, 244, 246]; // Fond clair
  const borderGray = [209, 213, 219]; // Bordures
  const successGreen = [34, 197, 94]; // Vert pour net à payer

  // ═══════════════════════════════════════════════════════════════════════════
  // EN-TÊTE PROFESSIONNEL
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Titre principal centré (sans bandeau bleu)
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE DE PAIE', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOC INFORMATIONS EMPLOYEUR / SALARIÉ (TABLEAU PROPRE)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const infoBlockTop = yPos;
  const infoBlockWidth = pageWidth - 2 * margin;
  const infoBlockHeight = 45;
  const middleX = pageWidth / 2;
  
  // Fond blanc avec bordure
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, infoBlockTop, infoBlockWidth, infoBlockHeight, 'F');
  
  // Bordure extérieure
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, infoBlockTop, infoBlockWidth, infoBlockHeight, 'S');
  
  // Ligne de séparation verticale (colonne)
  doc.setLineWidth(0.3);
  doc.line(middleX, infoBlockTop, middleX, infoBlockTop + infoBlockHeight);

  // ───────────────────────────────────────────────────────────────────────────
  // EMPLOYEUR (Colonne gauche)
  // ───────────────────────────────────────────────────────────────────────────
  
  const infoColWidth = (infoBlockWidth - 0.3) / 2; // Moins l'épaisseur de la ligne
  let xEmployeur = margin + 8;
  let yEmployeur = infoBlockTop + 10;
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEUR', xEmployeur, yEmployeur);
  
  yEmployeur += 7;
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const entrepriseNom = data.entreprises.nom || 'Entreprise';
  doc.text(entrepriseNom, xEmployeur, yEmployeur, { maxWidth: infoColWidth - 16 });
  
  yEmployeur += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  if (data.entreprises.adresse) {
    doc.text(data.entreprises.adresse, xEmployeur, yEmployeur, { maxWidth: infoColWidth - 16 });
    yEmployeur += 4.5;
  }
  
  if (data.entreprises.code_postal && data.entreprises.ville) {
    doc.text(`${data.entreprises.code_postal} ${data.entreprises.ville}`, xEmployeur, yEmployeur, { maxWidth: infoColWidth - 16 });
    yEmployeur += 4.5;
  }
  
  if (data.entreprises.siret) {
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.setFontSize(8);
    doc.text(`SIRET : ${data.entreprises.siret}`, xEmployeur, yEmployeur, { maxWidth: infoColWidth - 16 });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SALARIÉ (Colonne droite)
  // ───────────────────────────────────────────────────────────────────────────
  
  let xSalarie = middleX + 8;
  let ySalarie = infoBlockTop + 10;
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SALARIÉ', xSalarie, ySalarie);
  
  ySalarie += 7;
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const salarieNom = `${data.collaborateurs_entreprise.prenom || ''} ${data.collaborateurs_entreprise.nom || ''}`.trim();
  doc.text(salarieNom, xSalarie, ySalarie, { maxWidth: infoColWidth - 16 });
  
  ySalarie += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  if (data.collaborateurs_entreprise.poste) {
    doc.text(data.collaborateurs_entreprise.poste, xSalarie, ySalarie, { maxWidth: infoColWidth - 16 });
    ySalarie += 4.5;
  }
  
  if (data.collaborateurs_entreprise.email) {
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.setFontSize(8);
    doc.text(data.collaborateurs_entreprise.email, xSalarie, ySalarie, { maxWidth: infoColWidth - 16 });
  }

  yPos = infoBlockTop + infoBlockHeight + 12;

  // ═══════════════════════════════════════════════════════════════════════════
  // PÉRIODE DE PAIE
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Format simple : "Décembre 2025"
  const periodeDate = new Date(data.periode_debut);
  const periodeMois = periodeDate.toLocaleDateString('fr-FR', { 
    month: 'long',
    year: 'numeric'
  });
  const periodeFormatee = periodeMois.charAt(0).toUpperCase() + periodeMois.slice(1);
  
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(periodeFormatee, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLEAU UNIQUE (Rémunération + Cotisations) - Structure identique au modèle
  // ═══════════════════════════════════════════════════════════════════════════

  // Type pour les lignes du tableau (structure identique au modèle)
  type LigneTableau = {
    libelle: string;
    base?: number;
    taux?: number;
    aDeduire?: number;
    aPayer?: number;
    chargesPatBase?: number;
    chargesPatTaux?: number;
    chargesPatMontant?: number;
    isSection?: boolean; // Pour les titres de section (Santé, Retraite, etc.)
    isTotal?: boolean; // Pour les lignes de totaux
  };

  // Préparer toutes les lignes du tableau dans l'ordre EXACT du modèle
  let toutesLignes: LigneTableau[] = [];
  
  const heuresNormales = Number(data.heures_normales || 0);
  const heuresSupp25 = Number(data.heures_supp_25 || 0);
  const heuresSupp50 = Number(data.heures_supp_50 || 0);
  
  // Calculer le taux horaire de base
  const tauxHoraireBase = heuresNormales > 0 ? salaireBrut / heuresNormales : 0;
  
  // ========================================
  // SECTION 1 : SALAIRE DE BASE
  // ========================================
  if (heuresNormales > 0) {
    toutesLignes.push({
      libelle: 'Salaire de base',
      base: round2(heuresNormales),
      taux: round2(tauxHoraireBase),
      aPayer: salaireBrut
    });
  }
  
  // ========================================
  // SECTION 2 : SALAIRE BRUT (total)
  // ========================================
  toutesLignes.push({
    libelle: 'Salaire brut',
    aPayer: salaireBrut,
    isTotal: true
  });

  // ========================================
  // SECTION 3 : COTISATIONS (organisées par catégories)
  // ========================================
  let totalSalarialesCalcule = totalCotisationsSalariales || 0;
  let totalPatronalesCalcule = totalCotisationsPatronales || 0;

  // Organiser les cotisations par catégories comme dans le modèle
  const cotisationsParCategorie: Record<string, Array<{
    libelle: string;
    base: number;
    tauxSal?: number;
    montantSal: number;
    tauxPat?: number;
    montantPat: number;
  }>> = {};

  if (data.lignes && data.lignes.length > 0) {
    data.lignes.forEach((ligne) => {
      const base = ligne.base || salaireBrut;
      const montantSal = ligne.montant_salarial ? Math.abs(ligne.montant_salarial) : 0;
      const montantPat = ligne.montant_patronal || 0;
      
      // Déterminer la catégorie selon le libellé
      let categorie = 'Autres';
      const libelleLower = ligne.libelle.toLowerCase();
      
      if (libelleLower.includes('santé') || libelleLower.includes('maladie') || libelleLower.includes('maternité') || libelleLower.includes('invalidité') || libelleLower.includes('accident')) {
        categorie = 'Santé';
      } else if (libelleLower.includes('retraite') || libelleLower.includes('vieillesse') || libelleLower.includes('complémentaire')) {
        categorie = 'Retraite';
      } else if (libelleLower.includes('famille') || libelleLower.includes('allocations familiales')) {
        categorie = 'Famille';
      } else if (libelleLower.includes('chômage') || libelleLower.includes('chomage')) {
        categorie = 'Assurance chômage';
      } else if (libelleLower.includes('csg') || libelleLower.includes('crds')) {
        categorie = 'CSG/CRDS';
      } else if (libelleLower.includes('exonération') || libelleLower.includes('exoneration')) {
        categorie = 'Exonérations';
      }
      
      if (!cotisationsParCategorie[categorie]) {
        cotisationsParCategorie[categorie] = [];
      }
      
      cotisationsParCategorie[categorie].push({
        libelle: ligne.libelle,
        base,
        tauxSal: ligne.taux_salarial || undefined,
        montantSal,
        tauxPat: ligne.taux_patronal || undefined,
        montantPat
      });
    });

    // Ajouter les cotisations dans l'ordre du modèle
    const ordreCategories = ['Santé', 'Retraite', 'Famille', 'Assurance chômage', 'Autres', 'CSG/CRDS', 'Exonérations'];
    
    ordreCategories.forEach((categorie) => {
      if (cotisationsParCategorie[categorie] && cotisationsParCategorie[categorie].length > 0) {
        // Ajouter un titre de section si nécessaire (pour les catégories principales)
        if (['Santé', 'Retraite', 'Famille', 'Assurance chômage'].includes(categorie)) {
          toutesLignes.push({
            libelle: categorie,
            isSection: true
          });
        }
        
        // Ajouter les lignes de cette catégorie
        cotisationsParCategorie[categorie].forEach((cot) => {
          toutesLignes.push({
            libelle: cot.libelle,
            base: cot.base > 0 ? cot.base : undefined,
            taux: cot.tauxSal || cot.tauxPat || undefined,
            aDeduire: cot.montantSal > 0 ? cot.montantSal : undefined,
            // Toujours inclure les charges patronales si elles existent (même si montantPat = 0 ou négatif)
            chargesPatBase: (cot.tauxPat !== undefined || cot.montantPat !== 0) ? cot.base : undefined,
            chargesPatTaux: cot.tauxPat || undefined,
            chargesPatMontant: cot.montantPat !== 0 ? cot.montantPat : undefined,
          });
        });
        
        // Après CSG/CRDS, ajouter les lignes de récapitulatif
        if (categorie === 'CSG/CRDS') {
          // Calculer le net imposable (salaire brut - cotisations déductibles)
          const csgNonDedSal = toutesLignes
            .filter(l => l.libelle.toLowerCase().includes('csg') && l.libelle.toLowerCase().includes('non déductible'))
            .reduce((sum, l) => sum + (l.aDeduire || 0), 0);
          const cotisationsDeductibles = totalSalarialesCalcule - csgNonDedSal;
          
          // Total part salariale
          toutesLignes.push({
            libelle: 'Total part salariale',
            base: salaireBrut,
            aDeduire: totalSalarialesCalcule,
            isTotal: true
          });
          
          // Total part employeur
          toutesLignes.push({
            libelle: 'Total part employeur',
            base: salaireBrut,
            chargesPatMontant: totalPatronalesCalcule,
            isTotal: true
          });
          
          // Net imposable
          toutesLignes.push({
            libelle: 'Net imposable',
            base: salaireBrut,
            isTotal: true
          });
          
          // Net à payer
          toutesLignes.push({
            libelle: 'Net à payer',
            base: salaireBrut,
            isTotal: true
          });
          
          // Coût total employeur
          const coutTotalCalcule = round2(salaireBrut + totalPatronalesCalcule);
          toutesLignes.push({
            libelle: 'Coût total employeur',
            base: salaireBrut,
            chargesPatMontant: coutTotalCalcule,
            isTotal: true
          });
        }
      }
    });

    // Supprimer les lignes de récapitulatif qui apparaissent AVANT CSG/CRDS
    const lignesRecap = ['Total part salariale', 'Total part employeur', 'Net imposable', 'Net à payer', 'Coût total employeur'];
    
    // Trouver l'index de la première ligne CSG/CRDS
    let indexPremiereCSG = -1;
    for (let i = 0; i < toutesLignes.length; i++) {
      const libelleLower = toutesLignes[i].libelle.toLowerCase();
      if (libelleLower.includes('csg') || libelleLower.includes('crds')) {
        indexPremiereCSG = i;
        break;
      }
    }
    
    // Si on a trouvé CSG/CRDS, supprimer les lignes de récapitulatif qui sont avant
    if (indexPremiereCSG > 0) {
      toutesLignes = toutesLignes.filter((ligne, index) => {
        // Si c'est une ligne de récapitulatif ET qu'elle est avant CSG/CRDS, on la supprime
        if (lignesRecap.includes(ligne.libelle) && index < indexPremiereCSG) {
          return false;
        }
        return true;
      });
    }

    // Calculer les totaux si nécessaire
    if (totalSalarialesCalcule === 0) {
      totalSalarialesCalcule = round2(
        toutesLignes.reduce((sum, l) => sum + (l.aDeduire || 0), 0)
      );
    }
    if (totalPatronalesCalcule === 0) {
      totalPatronalesCalcule = round2(
        toutesLignes.reduce((sum, l) => sum + (l.chargesPatMontant || 0), 0)
      );
    }
  }

  // ========================================
  // SECTION 5 : TOTAL DES COTISATIONS
  // ========================================
  toutesLignes.push({
    libelle: 'Total des cotisations et contributions',
    aDeduire: totalSalarialesCalcule,
    chargesPatMontant: totalPatronalesCalcule,
    isTotal: true
  });

  // En-tête du tableau avec colonnes (structure identique au modèle)
  const headerHeight = 10; // Hauteur augmentée de l'en-tête (8 → 10)
  
  // Largeurs des colonnes (resserrées mais lisibles)
  const colLibelleWidth = 55; // "Eléments de paie" (réduit de 65 à 55)
  const colBaseWidth = 20; // Base (réduit de 24 à 20)
  const colTauxWidth = 18; // Taux (réduit de 20 à 18)
  const colDeduireWidth = 20; // "A déduire" (réduit de 24 à 20)
  const colPayerWidth = 20; // "A payer" (réduit de 24 à 20)
  const colChargesPatWidth = 30; // "Charges patronales" (agrandie de 24 à 30)
  
  // Largeur totale du tableau
  const tableWidth = colLibelleWidth + colBaseWidth + colTauxWidth + colDeduireWidth + colPayerWidth + colChargesPatWidth;
  
  // Centrer le tableau au milieu de la page
  const tableStartX = (pageWidth - tableWidth) / 2;
  
  // Positions X des colonnes
  const colLibelleX = tableStartX;
  const colBaseX = colLibelleX + colLibelleWidth;
  const colTauxX = colBaseX + colBaseWidth;
  const colDeduireX = colTauxX + colTauxWidth;
  const colPayerX = colDeduireX + colDeduireWidth;
  const colChargesPatX = colPayerX + colPayerWidth;
  
  // Fond de l'en-tête
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(tableStartX, yPos, tableWidth, headerHeight, 'F');
  
  // Bordures du tableau
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.5);
  doc.rect(tableStartX, yPos, tableWidth, headerHeight, 'S');
  
  // Lignes verticales entre les colonnes principales
  doc.setLineWidth(0.3);
  doc.line(colBaseX, yPos, colBaseX, yPos + headerHeight);
  doc.line(colTauxX, yPos, colTauxX, yPos + headerHeight);
  doc.line(colDeduireX, yPos, colDeduireX, yPos + headerHeight);
  doc.line(colPayerX, yPos, colPayerX, yPos + headerHeight);
  doc.line(colChargesPatX, yPos, colChargesPatX, yPos + headerHeight);
  
  // Texte des en-têtes principaux (ajusté pour la hauteur augmentée)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  // Centrer verticalement dans l'en-tête plus haut (headerHeight = 10, donc centre à 5)
  const headerTextY = yPos + 5;
  
  doc.text('Eléments de paie', colLibelleX + colLibelleWidth / 2, headerTextY, { align: 'center', maxWidth: colLibelleWidth - 2 });
  doc.text('Base', colBaseX + colBaseWidth / 2, headerTextY, { align: 'center' });
  doc.text('Taux', colTauxX + colTauxWidth / 2, headerTextY, { align: 'center' });
  doc.text('A déduire', colDeduireX + colDeduireWidth / 2, headerTextY, { align: 'center', maxWidth: colDeduireWidth - 2 });
  doc.text('A payer', colPayerX + colPayerWidth / 2, headerTextY, { align: 'center' });
  doc.text('Charges patronales', colChargesPatX + colChargesPatWidth / 2, headerTextY, { align: 'center', maxWidth: colChargesPatWidth - 2 });
  
  yPos += headerHeight;

  // Afficher toutes les lignes du tableau (taille de police légèrement réduite pour les colonnes plus fines)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  toutesLignes.forEach((ligne, index) => {
    // Vérifier si on dépasse la page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = marginTop;
    }
    
    const rowHeight = 5;
    
    // Fond pour les lignes de récapitulatif uniquement (bleu clair) - après CSG/CRDS
    const lignesRecap = ['Total part salariale', 'Total part employeur', 'Net imposable', 'Net à payer', 'Coût total employeur'];
    if (lignesRecap.includes(ligne.libelle)) {
      doc.setFillColor(230, 240, 255); // Bleu très clair
      doc.rect(tableStartX, yPos - 2, tableWidth, rowHeight, 'F');
    } else {
      // Fond alterné pour meilleure lisibilité (sans bordures horizontales)
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(tableStartX, yPos - 2, tableWidth, rowHeight, 'F');
      }
    }
    
    // Lignes verticales entre les colonnes uniquement (pas de bordures horizontales)
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.3);
    doc.line(colBaseX, yPos - 2, colBaseX, yPos - 2 + rowHeight);
    doc.line(colTauxX, yPos - 2, colTauxX, yPos - 2 + rowHeight);
    doc.line(colDeduireX, yPos - 2, colDeduireX, yPos - 2 + rowHeight);
    doc.line(colPayerX, yPos - 2, colPayerX, yPos - 2 + rowHeight);
    doc.line(colChargesPatX, yPos - 2, colChargesPatX, yPos - 2 + rowHeight);
    
    // Style pour les lignes de totaux et sections
    if (ligne.isTotal || ligne.isSection) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(ligne.isSection ? 9 : 9);
      if (ligne.isSection) {
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      }
    }
    
    // Libellé (tronqué si trop long)
    const libelleMaxWidth = colLibelleWidth - 4;
    let libelle = ligne.libelle;
    if (doc.getTextWidth(libelle) > libelleMaxWidth) {
      libelle = doc.splitTextToSize(libelle, libelleMaxWidth)[0];
    }
    doc.text(libelle, colLibelleX + 2, yPos + 1);
    
    // Base
    if (ligne.base !== undefined && ligne.base > 0) {
      doc.text(formatCurrency(ligne.base), colBaseX + colBaseWidth / 2, yPos + 1, { align: 'center' });
    }
    
    // Taux (format réduit pour colonne plus fine)
    if (ligne.taux !== undefined && ligne.taux > 0) {
      // Utiliser 3 décimales au lieu de 4 pour économiser l'espace
      doc.text(`${ligne.taux.toFixed(3)}`, colTauxX + colTauxWidth / 2, yPos + 1, { align: 'center' });
    }
    
    // A déduire
    if (ligne.aDeduire !== undefined && ligne.aDeduire > 0) {
      doc.setTextColor(200, 0, 0); // Rouge pour les déductions
      doc.text(formatCurrency(ligne.aDeduire), colDeduireX + colDeduireWidth / 2, yPos + 1, { align: 'center' });
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    }
    
    // A payer
    if (ligne.aPayer !== undefined && ligne.aPayer > 0) {
      doc.text(formatCurrency(ligne.aPayer), colPayerX + colPayerWidth / 2, yPos + 1, { align: 'center' });
    }
    
    // Charges patronales (afficher le montant si présent)
    if (ligne.chargesPatMontant !== undefined && ligne.chargesPatMontant !== 0) {
      doc.text(formatCurrency(ligne.chargesPatMontant), colChargesPatX + colChargesPatWidth / 2, yPos + 1, { align: 'center' });
    }
    
    // Réinitialiser le style
    if (ligne.isTotal || ligne.isSection) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    }
    
    yPos += rowHeight;
  });

  yPos += 3;


  // ═══════════════════════════════════════════════════════════════════════════
  // MENTIONS LÉGALES
  // ═══════════════════════════════════════════════════════════════════════════
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
  
  const mentionsY = pageHeight - 20;
  doc.text(
    'Document conforme à la réglementation française. Les taux de cotisations sont calculés selon les barèmes URSSAF en vigueur.',
    margin,
    mentionsY,
    { maxWidth: pageWidth - 2 * margin, align: 'justify' }
  );
  
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - Crea+Entreprises`,
    margin,
    pageHeight - 12,
    { maxWidth: pageWidth - 2 * margin, align: 'center' }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TÉLÉCHARGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  const fileName = `Fiche_Paie_${data.numero}_${data.collaborateurs_entreprise.nom}_${data.collaborateurs_entreprise.prenom}.pdf`;
  doc.save(fileName);
}
