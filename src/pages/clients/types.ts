/**
 * Types partagés pour les composants Clients
 */

export interface Client {
  id: string;
  nom?: string;
  prenom?: string;
  entreprise_nom?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  statut: string;
  created_at: string;
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

