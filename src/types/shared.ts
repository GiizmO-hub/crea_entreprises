/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FICHIER TAMPON - VARIABLES PARTAGÉES ENTRE MODULES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️ CRITIQUE : Ce fichier sert de TAMPON entre tous les modules pour éviter
 * les conflits de variables et garantir la cohérence des données.
 * 
 * RÈGLES D'UTILISATION :
 * 1. ✅ TOUS les modules DOIVENT utiliser les types/interfaces définis ici
 * 2. ✅ Si un module a besoin d'un nouveau champ partagé, l'ajouter ICI
 * 3. ✅ Ne JAMAIS créer de types dupliqués dans d'autres fichiers
 * 4. ✅ Si un module modifie un type, mettre à jour ICI et vérifier l'impact
 * 
 * EXEMPLE :
 * - Module Comptabilité ajoute code_ape, code_naf → Ajouter dans Entreprise
 * - Module Facturation ajoute source → Ajouter dans Facture
 * - Module CRM ajoute tags → Ajouter dans Client
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// FACTURES
// ============================================================================

export interface Facture {
  id: string;
  numero: string;
  type?: 'facture' | 'proforma' | 'devis';
  client_id: string;
  entreprise_id: string;
  date_facturation?: string;
  date_emission?: string;
  date_echeance?: string;
  montant_ht: number;
  montant_tva?: number;
  tva?: number; // Alias pour montant_tva (compatibilité)
  taux_tva?: number;
  montant_ttc: number;
  statut: 'brouillon' | 'envoyee' | 'en_attente' | 'payee' | 'annulee' | 'valide' | 'envoye' | 'accepte' | 'refuse' | 'expire';
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  source?: 'plateforme' | 'client' | 'externe'; // Source de création/édition
  
  // Champs enrichis (non stockés en DB)
  client_nom?: string;
  entreprise_nom?: string;
  facture_id?: string; // Pour les avoirs liés
}

export interface FactureLigne {
  id?: string;
  facture_id?: string; // Optionnel car peut être défini lors de la sauvegarde
  description: string;
  quantite: number | string; // Permettre string pour éviter que le curseur bouge
  prix_unitaire_ht: number | string;
  taux_tva: number | string;
  montant_ht: number;
  montant_tva: number;
  tva?: number; // Alias pour montant_tva (compatibilité)
  montant_ttc: number;
  ordre: number;
}

// ============================================================================
// AVOIRS
// ============================================================================

export interface Avoir {
  id: string;
  numero: string;
  entreprise_id: string;
  client_id: string;
  facture_id?: string;
  date_emission: string;
  montant_ht: number;
  tva: number;
  montant_ttc: number;
  motif?: string;
  statut: 'valide' | 'annule';
  created_at: string;
  
  // Champs enrichis (non stockés en DB)
  client_nom?: string;
  type?: 'avoir';
  date_facturation?: string; // Alias pour date_emission
  taux_tva?: number; // Calculé depuis tva/montant_ht
}

// ============================================================================
// CLIENTS
// ============================================================================

export interface Client {
  id: string;
  entreprise_id: string;
  nom?: string | null;
  prenom?: string | null;
  entreprise_nom?: string | null;
  email: string;
  telephone?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  siret?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ClientContact {
  id: string;
  client_id: string; // ID du client propriétaire (dans clients table)
  entreprise_id: string; // ID de l'entreprise du client propriétaire
  nom?: string | null;
  prenom?: string | null;
  entreprise_nom?: string | null;
  email: string;
  telephone?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// ENTREPRISES
// ============================================================================

export interface Entreprise {
  id: string;
  user_id: string; // Propriétaire de l'entreprise
  nom: string;
  forme_juridique?: string | null;
  siret?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  site_web?: string | null;
  // ✅ CHAMPS PARTAGÉS AVEC MODULE COMPTABILITÉ (via fichier tampon)
  code_ape?: string | null;
  code_naf?: string | null;
  convention_collective?: string | null;
  statut_paiement?: 'en_attente' | 'paye' | 'non_requis' | null;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'invoice' | 'client' | 'payment' | 'subscription' | 'system';
  link_url?: string | null;
  link_text?: string | null;
  read: boolean;
  read_at?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  expires_at?: string | null;
}

// ============================================================================
// PARAMÈTRES DOCUMENTS
// ============================================================================

export interface ParametresDocuments {
  id: string;
  entreprise_id: string;
  logo_url?: string | null;
  logo_base64?: string | null;
  logo_position: 'left' | 'right' | 'center' | 'none';
  logo_size: number;
  text_header?: string | null;
  show_entreprise_nom: boolean;
  show_entreprise_adresse: boolean;
  show_entreprise_contact: boolean;
  show_entreprise_siret: boolean;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  header_font: 'helvetica' | 'times' | 'courier';
  header_font_size: number;
  body_font: 'helvetica' | 'times' | 'courier';
  body_font_size: number;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  show_generation_date: boolean;
  show_status: boolean;
  footer_text?: string | null;
  capital_social?: string | null;
  rcs?: string | null;
  tva_intracommunautaire?: string | null;
  config_facture: Record<string, any>;
  config_devis: Record<string, any>;
  config_avoir: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CONSTANTES PARTAGÉES
// ============================================================================

export const FACTURE_STATUTS = ['brouillon', 'envoyee', 'en_attente', 'payee', 'annulee'] as const;
export const DEVIS_STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse', 'expire'] as const;
export const AVOIR_STATUTS = ['valide', 'annule'] as const;
export const FACTURE_SOURCES = ['plateforme', 'client', 'externe'] as const;
export const FACTURE_TYPES = ['facture', 'proforma', 'devis'] as const;
export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error', 'invoice', 'client', 'payment', 'subscription', 'system'] as const;

// ============================================================================
// FONCTIONS UTILITAIRES DE VALIDATION
// ============================================================================

export function validateFacture(facture: Partial<Facture>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!facture.numero || facture.numero.trim() === '') {
    errors.push('Le numéro de facture est requis');
  }
  
  if (!facture.client_id) {
    errors.push('Le client_id est requis');
  }
  
  if (!facture.entreprise_id) {
    errors.push('L\'entreprise_id est requis');
  }
  
  if (facture.montant_ht === undefined || facture.montant_ht < 0) {
    errors.push('Le montant HT doit être un nombre positif');
  }
  
  if (facture.montant_ttc === undefined || facture.montant_ttc < 0) {
    errors.push('Le montant TTC doit être un nombre positif');
  }
  
  if (facture.source && !FACTURE_SOURCES.includes(facture.source)) {
    errors.push(`La source doit être l'une des valeurs suivantes: ${FACTURE_SOURCES.join(', ')}`);
  }
  
  if (facture.type && !FACTURE_TYPES.includes(facture.type)) {
    errors.push(`Le type doit être l'une des valeurs suivantes: ${FACTURE_TYPES.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeFacture(facture: any): Facture {
  return {
    id: facture.id,
    numero: facture.numero || '',
    type: facture.type || 'facture',
    client_id: facture.client_id,
    entreprise_id: facture.entreprise_id,
    date_facturation: facture.date_facturation || facture.date_emission || facture.created_at,
    date_emission: facture.date_emission || facture.date_facturation || facture.created_at,
    date_echeance: facture.date_echeance || undefined,
    montant_ht: Number(facture.montant_ht) || 0,
    montant_tva: Number(facture.montant_tva || facture.tva) || 0,
    tva: Number(facture.tva || facture.montant_tva) || 0,
    taux_tva: Number(facture.taux_tva) || 20,
    montant_ttc: Number(facture.montant_ttc) || 0,
    statut: facture.statut || 'brouillon',
    notes: facture.notes || null,
    created_at: facture.created_at || new Date().toISOString(),
    updated_at: facture.updated_at,
    source: facture.source || 'plateforme', // Par défaut 'plateforme' pour les factures existantes
    client_nom: facture.client_nom,
    entreprise_nom: facture.entreprise_nom,
    facture_id: facture.facture_id,
  };
}


