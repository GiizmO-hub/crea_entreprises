/**
 * Types partagés pour les composants Clients
 */

export interface Client {
  id: string;
  entreprise_id?: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  siret?: string;
  statut: string;
  created_at: string;
}

// Type pour les contacts des clients (client_contacts)
export interface ClientContact {
  id: string;
  client_id: string;
  entreprise_id: string;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  pays?: string;
  entreprise_nom?: string;
  siret?: string;
  notes?: string;
  statut: 'actif' | 'inactif' | 'archive';
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface Entreprise {
  id: string;
  nom: string;
}

export interface Plan {
  id: string;
  nom: string;
  prix_mensuel: number;
}

export interface Option {
  id: string;
  nom: string;
  prix_mensuel: number;
}

export interface ClientFormData {
  entreprise_id: string;
  nom: string;
  prenom: string;
  entreprise_nom: string;
  email: string;
  telephone: string;
  adresse: string;
  code_postal: string;
  ville: string;
  siret: string;
}

export interface EspaceMembreData {
  password: string;
  plan_id: string;
  options_ids: string[];
}

export interface ClientCredentials {
  email: string;
  password: string;
}

