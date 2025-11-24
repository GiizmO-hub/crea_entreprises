import jsPDF from 'jspdf';

interface PDFData {
  type: 'facture' | 'proforma' | 'avoir';
  numero: string;
  date_emission: string;
  date_echeance?: string;
  client: {
    nom?: string;
    prenom?: string;
    entreprise_nom?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    email?: string;
  };
  entreprise: {
    nom: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    siret?: string;
    email?: string;
    telephone?: string;
  };
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  taux_tva: number;
  lignes?: Array<{
    description: string;
    quantite: number;
    prix_unitaire_ht: number;
    taux_tva: number;
    montant_ht: number;
    montant_tva: number;
    montant_ttc: number;
  }>;
  motif?: string;
  notes?: string;
  statut?: string;
}

export function generatePDF(data: PDFData): void {
  const doc = new jsPDF();
  
  // Couleurs professionnelles
  const primaryColor = [59, 130, 246]; // Blue-500
  const darkColor = [31, 41, 55]; // Gray-800
  const lightGray = [243, 244, 246]; // Gray-100
  
  let yPosition = 20;

  // En-tête avec logo et informations entreprise
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.entreprise.nom || 'Entreprise', 20, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.entreprise.adresse) {
    doc.text(`${data.entreprise.adresse}`, 20, 26);
    yPosition = 32;
  }
  if (data.entreprise.code_postal && data.entreprise.ville) {
    doc.text(`${data.entreprise.code_postal} ${data.entreprise.ville}`, 20, yPosition);
    yPosition += 6;
  }
  if (data.entreprise.siret) {
    doc.text(`SIRET: ${data.entreprise.siret}`, 20, yPosition);
    yPosition += 6;
  }
  if (data.entreprise.email) {
    doc.text(`Email: ${data.entreprise.email}`, 20, yPosition);
    yPosition += 6;
  }
  if (data.entreprise.telephone) {
    doc.text(`Tél: ${data.entreprise.telephone}`, 20, yPosition);
  }

  // Type de document (Facture, Proforma, Avoir) - en haut à droite
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const typeTextValue = data.type === 'avoir' ? 'AVOIR' : data.type === 'proforma' ? 'FACTURE PROFORMA' : 'FACTURE';
  const typeTextWidth = doc.getTextWidth(typeTextValue);
  doc.text(typeTextValue, 210 - typeTextWidth - 20, 20);

  yPosition = 50;

  // Informations client
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', 20, yPosition);
  
  doc.setFont('helvetica', 'normal');
  yPosition += 7;
  const clientName = data.client.entreprise_nom || 
    `${data.client.prenom || ''} ${data.client.nom || ''}`.trim() || 
    'Client';
  doc.text(clientName, 20, yPosition);
  yPosition += 5;
  
  if (data.client.adresse) {
    doc.text(data.client.adresse, 20, yPosition);
    yPosition += 5;
  }
  if (data.client.code_postal && data.client.ville) {
    doc.text(`${data.client.code_postal} ${data.client.ville}`, 20, yPosition);
    yPosition += 5;
  }
  if (data.client.email) {
    doc.text(`Email: ${data.client.email}`, 20, yPosition);
    yPosition += 5;
  }

  // Informations document (à droite)
  doc.setFont('helvetica', 'bold');
  const docInfoY = 50;
  const docInfoX = 140;
  doc.text('N°:', docInfoX, docInfoY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.numero, docInfoX + 15, docInfoY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', docInfoX, docInfoY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.date_emission).toLocaleDateString('fr-FR'), docInfoX + 15, docInfoY + 7);
  
  if (data.date_echeance) {
    doc.setFont('helvetica', 'bold');
    doc.text('Échéance:', docInfoX, docInfoY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(data.date_echeance).toLocaleDateString('fr-FR'), docInfoX + 15, docInfoY + 14);
  }

  yPosition = Math.max(yPosition, docInfoY + 30);

  // Ligne de séparation
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 10;

  // Tableau des lignes (si lignes détaillées)
  if (data.lignes && data.lignes.length > 0) {
    // En-tête du tableau
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(20, yPosition, 170, 8, 'F');
    
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 22, yPosition + 5.5);
    doc.text('Qté', 130, yPosition + 5.5);
    doc.text('P.U. HT', 145, yPosition + 5.5);
    doc.text('TVA %', 160, yPosition + 5.5);
    doc.text('Montant HT', 175, yPosition + 5.5);
    
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    data.lignes.forEach((ligne) => {
      doc.text(ligne.description.substring(0, 40), 22, yPosition + 4);
      doc.text(ligne.quantite.toString(), 130, yPosition + 4);
      doc.text(`${ligne.prix_unitaire_ht.toFixed(2)}€`, 145, yPosition + 4);
      doc.text(`${ligne.taux_tva}%`, 160, yPosition + 4);
      doc.text(`${ligne.montant_ht.toFixed(2)}€`, 175, yPosition + 4);
      yPosition += 6;
      
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
    });
  } else {
    // Si pas de lignes détaillées, afficher juste les montants
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Montant HT:', 140, yPosition);
    doc.text(`${data.montant_ht.toFixed(2)}€`, 175, yPosition);
    yPosition += 6;
    
    doc.text(`TVA (${data.taux_tva}%):`, 140, yPosition);
    doc.text(`${data.montant_tva.toFixed(2)}€`, 175, yPosition);
    yPosition += 6;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Montant TTC:', 140, yPosition);
    doc.text(`${data.montant_ttc.toFixed(2)}€`, 175, yPosition);
    yPosition += 10;
  }

  // Totaux (si lignes détaillées)
  if (data.lignes && data.lignes.length > 0) {
    yPosition += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(140, yPosition, 190, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Total HT:', 140, yPosition);
    doc.text(`${data.montant_ht.toFixed(2)}€`, 175, yPosition);
    yPosition += 6;
    
    doc.text(`TVA (${data.taux_tva}%):`, 140, yPosition);
    doc.text(`${data.montant_tva.toFixed(2)}€`, 175, yPosition);
    yPosition += 6;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(138, yPosition - 6, 52, 8, 2, 2, 'F');
    doc.text('Total TTC:', 140, yPosition);
    doc.text(`${data.montant_ttc.toFixed(2)}€`, 175, yPosition);
    yPosition += 10;
  }

  // Motif pour avoir
  if (data.type === 'avoir' && data.motif) {
    yPosition += 5;
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Motif de l\'avoir:', 20, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    doc.text(data.motif, 20, yPosition);
    yPosition += 10;
  }

  // Notes
  if (data.notes) {
    yPosition += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Notes:', 20, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 5;
    const notesLines = doc.splitTextToSize(data.notes, 170);
    doc.text(notesLines, 20, yPosition);
    yPosition += notesLines.length * 5;
  }

  // Pied de page
  const pageHeight = doc.internal.pageSize.height;
  yPosition = pageHeight - 30;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPosition, 190, yPosition);
  yPosition += 5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    20,
    yPosition
  );
  
  if (data.statut) {
    const statutText = `Statut: ${data.statut}`;
    const statutWidth = doc.getTextWidth(statutText);
    doc.text(statutText, 190 - statutWidth, yPosition);
  }

  // Télécharger le PDF
  const fileName = `${data.numero}_${data.type}_${new Date(data.date_emission).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

