import jsPDF from 'jspdf';
import { supabase } from './supabase';

interface CollaborateurData {
  collaborateur: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    role: string;
    poste?: string;
    date_entree?: string;
    salaire?: number;
    numero_securite_sociale?: string;
    code_urssaf?: string;
    emploi?: string;
    statut_professionnel?: string;
    echelon?: string;
    convention_collective_numero?: string;
    convention_collective_nom?: string;
    matricule?: string;
    coefficient?: number;
    nombre_heures_hebdo?: number;
    nombre_heures_mensuelles?: number;
    type_contrat?: string;
    forfait_jours?: number;
    est_cadre: boolean;
    a_mutuelle: boolean;
    mutuelle_nom?: string;
    mutuelle_numero_adherent?: string;
    date_naissance?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    iban?: string;
    bic?: string;
    contact_urgence_nom?: string;
    contact_urgence_prenom?: string;
    contact_urgence_telephone?: string;
    contact_urgence_lien?: string;
    a_permis_conduire: boolean;
    permis_categorie?: string;
    permis_date_obtention?: string;
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
}

export async function generatePDFCollaborateur(data: CollaborateurData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Couleurs
  const primaryColor = [59, 130, 246]; // Blue-500
  const textColor = [30, 30, 30];
  const lightGray = [200, 200, 200];

  // En-tête
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FICHE COLLABORATEUR', pageWidth / 2, 25, { align: 'center' });

  yPos = 50;

  // Fonction pour ajouter une section
  const addSection = (title: string, items: Array<{ label: string; value: string | number | boolean | undefined }>) => {
    // Vérifier si on a besoin d'une nouvelle page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(title.toUpperCase(), margin, yPos);
    
    yPos += 8;
    doc.setDrawColor(...lightGray);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    items.forEach((item) => {
      if (item.value !== undefined && item.value !== null && item.value !== '') {
        const value = typeof item.value === 'boolean' 
          ? (item.value ? 'Oui' : 'Non')
          : item.value.toString();
        
        // Vérifier si on dépasse la page
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        doc.text(`${item.label}: ${value}`, margin + 5, yPos);
        yPos += 6;
      }
    });

    yPos += 5;
  };

  // Informations personnelles
  addSection('Informations personnelles', [
    { label: 'Nom', value: data.collaborateur.nom },
    { label: 'Prénom', value: data.collaborateur.prenom },
    { label: 'Email', value: data.collaborateur.email },
    { label: 'Téléphone', value: data.collaborateur.telephone },
    { label: 'Date de naissance', value: data.collaborateur.date_naissance ? new Date(data.collaborateur.date_naissance).toLocaleDateString('fr-FR') : undefined },
    { label: 'Adresse', value: data.collaborateur.adresse },
    { label: 'Code postal', value: data.collaborateur.code_postal },
    { label: 'Ville', value: data.collaborateur.ville },
  ]);

  // Informations professionnelles
  addSection('Informations professionnelles', [
    { label: 'Poste', value: data.collaborateur.poste },
    { label: 'Rôle', value: data.collaborateur.role },
    { label: 'Type de contrat', value: data.collaborateur.type_contrat },
    { label: 'Statut professionnel', value: data.collaborateur.statut_professionnel },
    { label: 'Date d\'entrée', value: data.collaborateur.date_entree ? new Date(data.collaborateur.date_entree).toLocaleDateString('fr-FR') : undefined },
    { label: 'Salaire brut', value: data.collaborateur.salaire ? `${data.collaborateur.salaire.toFixed(2)} €` : undefined },
    { label: 'Cadre', value: data.collaborateur.est_cadre },
    { label: 'N° Sécurité Sociale', value: data.collaborateur.numero_securite_sociale },
    { label: 'Code URSSAF', value: data.collaborateur.code_urssaf },
    { label: 'Emploi', value: data.collaborateur.emploi },
    { label: 'Échelon', value: data.collaborateur.echelon },
    { label: 'Matricule', value: data.collaborateur.matricule },
    { label: 'Coefficient', value: data.collaborateur.coefficient },
  ]);

  // Convention collective
  if (data.collaborateur.convention_collective_numero || data.collaborateur.convention_collective_nom) {
    addSection('Convention collective', [
      { label: 'Numéro', value: data.collaborateur.convention_collective_numero },
      { label: 'Nom', value: data.collaborateur.convention_collective_nom },
    ]);
  }

  // Durée du travail
  addSection('Durée du travail', [
    { label: 'Heures hebdomadaires', value: data.collaborateur.nombre_heures_hebdo ? `${data.collaborateur.nombre_heures_hebdo} h` : undefined },
    { label: 'Heures mensuelles', value: data.collaborateur.nombre_heures_mensuelles ? `${data.collaborateur.nombre_heures_mensuelles} h` : undefined },
    { label: 'Forfait jours', value: data.collaborateur.forfait_jours ? `${data.collaborateur.forfait_jours} jours/an` : undefined },
  ]);

  // Mutuelle
  addSection('Mutuelle', [
    { label: 'A une mutuelle', value: data.collaborateur.a_mutuelle },
    { label: 'Nom de la mutuelle', value: data.collaborateur.mutuelle_nom },
    { label: 'N° adhérent', value: data.collaborateur.mutuelle_numero_adherent },
  ]);

  // Coordonnées bancaires
  addSection('Coordonnées bancaires', [
    { label: 'IBAN', value: data.collaborateur.iban },
    { label: 'BIC', value: data.collaborateur.bic },
  ]);

  // Contact d'urgence
  if (data.collaborateur.contact_urgence_nom || data.collaborateur.contact_urgence_prenom) {
    addSection('Contact d\'urgence', [
      { label: 'Prénom', value: data.collaborateur.contact_urgence_prenom },
      { label: 'Nom', value: data.collaborateur.contact_urgence_nom },
      { label: 'Téléphone', value: data.collaborateur.contact_urgence_telephone },
      { label: 'Lien', value: data.collaborateur.contact_urgence_lien },
    ]);
  }

  // Permis de conduire
  addSection('Permis de conduire', [
    { label: 'A le permis', value: data.collaborateur.a_permis_conduire },
    { label: 'Catégorie', value: data.collaborateur.permis_categorie },
    { label: 'Date d\'obtention', value: data.collaborateur.permis_date_obtention ? new Date(data.collaborateur.permis_date_obtention).toLocaleDateString('fr-FR') : undefined },
  ]);

  // Informations entreprise
  addSection('Entreprise', [
    { label: 'Nom', value: data.entreprise.nom },
    { label: 'Adresse', value: data.entreprise.adresse },
    { label: 'Code postal', value: data.entreprise.code_postal },
    { label: 'Ville', value: data.entreprise.ville },
    { label: 'SIRET', value: data.entreprise.siret },
    { label: 'Email', value: data.entreprise.email },
    { label: 'Téléphone', value: data.entreprise.telephone },
  ]);

  // Pied de page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} / ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Nom du fichier
  const fileName = `Fiche_Collaborateur_${data.collaborateur.nom}_${data.collaborateur.prenom}_${new Date().getFullYear()}.pdf`;
  
  // Télécharger le PDF
  doc.save(fileName);
}

