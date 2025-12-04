import jsPDF from 'jspdf';
import { supabase } from './supabase';

interface PDFData {
  type: 'facture' | 'proforma' | 'devis' | 'avoir';
  numero: string;
  date_emission: string;
  date_echeance?: string;
  date_validite?: string; // Pour les devis
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
  entreprise_id?: string; // Pour charger les paramètres de documents
}

// Fonction utilitaire pour convertir hex en RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [59, 130, 246]; // Blue-500 par défaut
}

// Fonction pour charger le logo depuis URL ou base64
async function loadLogoImage(logoUrl?: string, logoBase64?: string): Promise<string | null> {
  if (logoBase64) {
    // Si c'est déjà en base64, vérifier le format
    if (logoBase64.startsWith('data:image')) {
      return logoBase64;
    }
    // Sinon, ajouter le préfixe
    return `data:image/png;base64,${logoBase64}`;
  }
  
  if (logoUrl) {
    try {
      // Pour les URLs externes, on ne peut pas les charger directement dans jsPDF
      // Il faudrait utiliser une bibliothèque comme html2canvas ou convertir en base64 côté serveur
      // Pour l'instant, on retourne null et on utilisera juste l'URL comme référence
      return null;
    } catch (error) {
      console.error('Erreur chargement logo:', error);
      return null;
    }
  }
  
  return null;
}

export async function generatePDF(data: PDFData): Promise<void> {
  // Charger les paramètres de documents depuis la base de données
  let docParams: any = null;
  if (data.entreprise_id) {
    try {
      const { data: params, error } = await supabase
        .from('parametres_documents')
        .select('*')
        .eq('entreprise_id', data.entreprise_id)
        .maybeSingle();
      
      if (!error && params) {
        docParams = params;
      }
    } catch (error) {
      console.warn('⚠️ Impossible de charger les paramètres de documents:', error);
    }
  }
  
  const doc = new jsPDF();
  
  // Utiliser les paramètres configurés ou les valeurs par défaut
  const primaryColor = docParams?.primary_color 
    ? hexToRgb(docParams.primary_color) 
    : [59, 130, 246]; // Blue-500
  const darkColor = docParams?.secondary_color 
    ? hexToRgb(docParams.secondary_color) 
    : [31, 41, 55]; // Gray-800
  const textColor = docParams?.text_color 
    ? hexToRgb(docParams.text_color) 
    : [255, 255, 255]; // Blanc
  const lightGray = [243, 244, 246]; // Gray-100
  
  // Les marges ne sont pas dans la migration actuelle, on utilise des valeurs par défaut
  const margeHaut = 20;
  const margeBas = 30;
  const margeGauche = 20;
  const margeDroite = 20;
  
  const policeTitre = docParams?.header_font || 'helvetica';
  const tailleTitre = docParams?.header_font_size || 24;
  const policeTexte = docParams?.body_font || 'helvetica';
  const tailleTexte = docParams?.body_font_size || 10;
  
  let yPosition = margeHaut;
  const pageWidth = 210;
  const contentWidth = pageWidth - margeGauche - margeDroite;
  
  // ==================== EN-TÊTE ====================
  const headerHeight = 50;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Logo (si configuré)
  const logoPosition = docParams?.logo_position || 'left';
  const logoSize = docParams?.logo_size || 60;
  let logoX = 0;
  let logoY = 0;
  
      if (logoPosition !== 'none' && docParams?.logo_url) {
        try {
          const logoData = await loadLogoImage(docParams.logo_url);
          if (logoData) {
            // Calculer la position du logo
            if (logoPosition === 'left') {
              logoX = margeGauche;
              logoY = margeHaut;
            } else if (logoPosition === 'right') {
              logoX = pageWidth - margeDroite - logoSize;
              logoY = margeHaut;
            } else if (logoPosition === 'center') {
              logoX = (pageWidth - logoSize) / 2;
              logoY = margeHaut;
            }
            
            // Ajouter le logo (jsPDF supporte les images base64)
            doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize * 0.75);
          }
        } catch (error) {
          console.warn('⚠️ Impossible d\'ajouter le logo:', error);
        }
      }
  
  // Nom de l'entreprise (si configuré pour être affiché)
  if (docParams?.show_entreprise_nom !== false) {
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(tailleTitre);
    doc.setFont(policeTitre, 'bold');
    
    // Position du nom selon le logo
    let nomX = margeGauche;
    if (logoPosition === 'left' && docParams?.logo_url) {
      nomX = margeGauche + logoSize + 10;
    }
    
    doc.text(data.entreprise.nom || 'Entreprise', nomX, margeHaut + 10);
  }
  
  // Informations entreprise (si configurées pour être affichées)
  doc.setFontSize(tailleTexte);
  doc.setFont(policeTexte, 'normal');
  let infoY = margeHaut + 16;
  
  if (docParams?.show_entreprise_adresse !== false) {
    if (data.entreprise.adresse) {
      doc.text(`${data.entreprise.adresse}`, margeGauche, infoY);
      infoY += 6;
    }
    if (data.entreprise.code_postal && data.entreprise.ville) {
      doc.text(`${data.entreprise.code_postal} ${data.entreprise.ville}`, margeGauche, infoY);
      infoY += 6;
    }
  }
  
  if (docParams?.show_entreprise_contact !== false) {
    if (data.entreprise.email) {
      doc.text(`Email: ${data.entreprise.email}`, margeGauche, infoY);
      infoY += 6;
    }
    if (data.entreprise.telephone) {
      doc.text(`Tél: ${data.entreprise.telephone}`, margeGauche, infoY);
      infoY += 6;
    }
  }
  
  if (docParams?.show_entreprise_siret !== false && data.entreprise.siret) {
    doc.text(`SIRET: ${data.entreprise.siret}`, margeGauche, infoY);
    infoY += 6;
  }
  
  // Type de document (Facture, Proforma, Avoir) - en haut à droite
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(16);
  doc.setFont(policeTitre, 'bold');
  const typeTextValue = data.type === 'avoir' ? 'AVOIR' : data.type === 'proforma' ? 'FACTURE PROFORMA' : data.type === 'devis' ? 'DEVIS' : 'FACTURE';
  const typeTextWidth = doc.getTextWidth(typeTextValue);
  doc.text(typeTextValue, pageWidth - typeTextWidth - margeDroite, margeHaut + 10);
  
  yPosition = headerHeight + 10;
  
  // ==================== INFORMATIONS CLIENT ====================
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFontSize(11);
  doc.setFont(policeTexte, 'bold');
  doc.text('Client:', margeGauche, yPosition);
  
  doc.setFont(policeTexte, 'normal');
  yPosition += 7;
  const clientName = data.client.entreprise_nom || 
    `${data.client.prenom || ''} ${data.client.nom || ''}`.trim() || 
    'Client';
  doc.text(clientName, margeGauche, yPosition);
  yPosition += 5;
  
  if (data.client.adresse) {
    doc.text(data.client.adresse, margeGauche, yPosition);
    yPosition += 5;
  }
  if (data.client.code_postal && data.client.ville) {
    doc.text(`${data.client.code_postal} ${data.client.ville}`, margeGauche, yPosition);
    yPosition += 5;
  }
  if (data.client.email) {
    doc.text(`Email: ${data.client.email}`, margeGauche, yPosition);
    yPosition += 5;
  }
  
  // ==================== INFORMATIONS DOCUMENT (à droite) ====================
  doc.setFont(policeTexte, 'bold');
  const docInfoY = headerHeight + 10;
  const docInfoX = pageWidth - margeDroite - 70;
  doc.text('N°:', docInfoX, docInfoY);
  doc.setFont(policeTexte, 'normal');
  doc.text(data.numero, docInfoX + 15, docInfoY);
  
  doc.setFont(policeTexte, 'bold');
  doc.text('Date:', docInfoX, docInfoY + 7);
  doc.setFont(policeTexte, 'normal');
  doc.text(new Date(data.date_emission).toLocaleDateString('fr-FR'), docInfoX + 15, docInfoY + 7);
  
  if (data.type === 'devis' && data.date_validite) {
    doc.setFont(policeTexte, 'bold');
    doc.text('Validité:', docInfoX, docInfoY + 14);
    doc.setFont(policeTexte, 'normal');
    doc.text(new Date(data.date_validite).toLocaleDateString('fr-FR'), docInfoX + 15, docInfoY + 14);
  } else if (data.date_echeance) {
    doc.setFont(policeTexte, 'bold');
    doc.text('Échéance:', docInfoX, docInfoY + 14);
    doc.setFont(policeTexte, 'normal');
    doc.text(new Date(data.date_echeance).toLocaleDateString('fr-FR'), docInfoX + 15, docInfoY + 14);
  }
  
  yPosition = Math.max(yPosition, docInfoY + 25);
  
  // ==================== LIGNE DE SÉPARATION ====================
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(margeGauche, yPosition, pageWidth - margeDroite, yPosition);
  yPosition += 10;
  
  // ==================== TABLEAU DES LIGNES ====================
  if (data.lignes && data.lignes.length > 0) {
    // En-tête du tableau (amélioré)
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    const tableHeaderHeight = 10;
    doc.rect(margeGauche, yPosition, contentWidth, tableHeaderHeight, 'F');
    
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(9);
    doc.setFont(policeTexte, 'bold');
    
    // Colonnes améliorées
    const colDesc = margeGauche + 2;
    const colQte = margeGauche + 90;
    const colPU = margeGauche + 110;
    const colTVA = margeGauche + 130;
    const colHT = margeGauche + 150;
    const colTTC = margeGauche + 170;
    
    doc.text('Description', colDesc, yPosition + 6.5);
    doc.text('Qté', colQte, yPosition + 6.5);
    doc.text('P.U. HT', colPU, yPosition + 6.5);
    doc.text('TVA %', colTVA, yPosition + 6.5);
    doc.text('HT', colHT, yPosition + 6.5);
    doc.text('TTC', colTTC, yPosition + 6.5);
    
    yPosition += tableHeaderHeight;
    
    // Lignes du tableau (améliorées)
    doc.setFont(policeTexte, 'normal');
    doc.setFontSize(9);
    
    data.lignes.forEach((ligne, index) => {
      // Alternance de couleurs pour les lignes
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margeGauche, yPosition - 2, contentWidth, 8, 'F');
      }
      
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      
      // Description (avec gestion du texte long)
      const description = ligne.description.substring(0, 50);
      doc.text(description, colDesc, yPosition + 4);
      
      // Quantité
      doc.text(ligne.quantite.toString(), colQte, yPosition + 4);
      
      // Prix unitaire HT
      doc.text(`${ligne.prix_unitaire_ht.toFixed(2)}€`, colPU, yPosition + 4);
      
      // TVA %
      doc.text(`${ligne.taux_tva}%`, colTVA, yPosition + 4);
      
      // Montant HT
      doc.text(`${ligne.montant_ht.toFixed(2)}€`, colHT, yPosition + 4);
      
      // Montant TTC
      doc.text(`${ligne.montant_ttc.toFixed(2)}€`, colTTC, yPosition + 4);
      
      yPosition += 8;
      
      // Nouvelle page si nécessaire
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margeHaut;
      }
    });
  } else {
    // Si pas de lignes détaillées, afficher juste les montants
    doc.setFontSize(tailleTexte);
    doc.setFont(policeTexte, 'normal');
    const montantX = pageWidth - margeDroite - 70;
    doc.text('Montant HT:', montantX, yPosition);
    doc.text(`${data.montant_ht.toFixed(2)}€`, pageWidth - margeDroite - 20, yPosition);
    yPosition += 6;
    
    doc.text(`TVA (${data.taux_tva}%):`, montantX, yPosition);
    doc.text(`${data.montant_tva.toFixed(2)}€`, pageWidth - margeDroite - 20, yPosition);
    yPosition += 6;
    
    doc.setFontSize(12);
    doc.setFont(policeTexte, 'bold');
    doc.text('Montant TTC:', montantX, yPosition);
    doc.text(`${data.montant_ttc.toFixed(2)}€`, pageWidth - margeDroite - 20, yPosition);
    yPosition += 10;
  }
  
  // ==================== TOTAUX (si lignes détaillées) ====================
  if (data.lignes && data.lignes.length > 0) {
    yPosition += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(pageWidth - margeDroite - 70, yPosition, pageWidth - margeDroite, yPosition);
    yPosition += 8;
    
    const totalX = pageWidth - margeDroite - 70;
    const totalValueX = pageWidth - margeDroite - 20;
    
    doc.setFontSize(tailleTexte);
    doc.setFont(policeTexte, 'normal');
    doc.text('Total HT:', totalX, yPosition);
    doc.text(`${data.montant_ht.toFixed(2)}€`, totalValueX, yPosition);
    yPosition += 6;
    
    doc.text(`TVA (${data.taux_tva}%):`, totalX, yPosition);
    doc.text(`${data.montant_tva.toFixed(2)}€`, totalValueX, yPosition);
    yPosition += 6;
    
    // Total TTC en évidence
    doc.setFontSize(14);
    doc.setFont(policeTexte, 'bold');
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.roundedRect(totalX - 2, yPosition - 8, 72, 10, 2, 2, 'F');
    doc.text('Total TTC:', totalX, yPosition);
    doc.text(`${data.montant_ttc.toFixed(2)}€`, totalValueX, yPosition);
    yPosition += 12;
  }
  
  // ==================== MOTIF POUR AVOIR ====================
  if (data.type === 'avoir' && data.motif) {
    yPosition += 5;
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(tailleTexte);
    doc.setFont(policeTexte, 'bold');
    doc.text('Motif de l\'avoir:', margeGauche, yPosition);
    doc.setFont(policeTexte, 'normal');
    yPosition += 6;
    const motifLines = doc.splitTextToSize(data.motif, contentWidth);
    doc.text(motifLines, margeGauche, yPosition);
    yPosition += motifLines.length * 5 + 5;
  }
  
  // ==================== NOTES ====================
  if (data.notes) {
    yPosition += 5;
    doc.setFontSize(9);
    doc.setFont(policeTexte, 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Notes:', margeGauche, yPosition);
    doc.setFont(policeTexte, 'normal');
    yPosition += 5;
    const notesLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(notesLines, margeGauche, yPosition);
    yPosition += notesLines.length * 5;
  }
  
  // ==================== MENTIONS LÉGALES ====================
  if (docParams?.footer_text || docParams?.capital_social || docParams?.rcs || docParams?.tva_intracommunautaire) {
    yPosition += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margeGauche, yPosition, pageWidth - margeDroite, yPosition);
    yPosition += 8;
    
    doc.setFontSize(8);
    doc.setFont(policeTexte, 'normal');
    doc.setTextColor(100, 100, 100);
    
    if (docParams.capital_social) {
      doc.text(`Capital social: ${docParams.capital_social}`, margeGauche, yPosition);
      yPosition += 5;
    }
    
    if (docParams.rcs) {
      doc.text(`RCS: ${docParams.rcs}`, margeGauche, yPosition);
      yPosition += 5;
    }
    
    if (docParams.tva_intracommunautaire) {
      doc.text(`TVA Intracommunautaire: ${docParams.tva_intracommunautaire}`, margeGauche, yPosition);
      yPosition += 5;
    }
    
    if (docParams.footer_text) {
      const mentionsLines = doc.splitTextToSize(docParams.footer_text, contentWidth);
      doc.text(mentionsLines, margeGauche, yPosition);
      yPosition += mentionsLines.length * 4;
    }
  }
  
  // ==================== PIED DE PAGE ====================
  const pageHeight = doc.internal.pageSize.height;
  yPosition = pageHeight - margeBas;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(margeGauche, yPosition, pageWidth - margeDroite, yPosition);
  yPosition += 5;
  
  doc.setFontSize(8);
  doc.setFont(policeTexte, 'normal');
  doc.setTextColor(128, 128, 128);
  
  // Toujours afficher la date de génération (pas de paramètre pour ça dans la migration)
  doc.text(
    `Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    margeGauche,
    yPosition
  );
  
  if (data.statut) {
    const statutText = `Statut: ${data.statut}`;
    const statutWidth = doc.getTextWidth(statutText);
    doc.text(statutText, pageWidth - statutWidth - margeDroite, yPosition);
  }
  
  // ==================== TÉLÉCHARGER LE PDF ====================
  const fileName = `${data.numero}_${data.type}_${new Date(data.date_emission).toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
