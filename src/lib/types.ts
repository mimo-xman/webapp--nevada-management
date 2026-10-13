import type { ObjectId } from "mongodb";

export type Role = "admin" | "manager" | "assistant";

export type StatutPaiement = "en_attente" | "payer" | "annuler";

export type AuditAction = "creer" | "modifier" | "supprimer" | "connexion";

/** Champs communs à toutes les collections (soft delete inclus). */
export interface BaseDoc {
  _id: ObjectId;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserDoc extends BaseDoc {
  username: string;
  password: string;
  role: Role;
}

export interface PersonneDoc extends BaseDoc {
  first_name: string;
  last_name: string;
  cin: string;
  phone: string;
  email: string;
}

export type EtudiantDoc = PersonneDoc;
export type ProfDoc = PersonneDoc;

export interface LangueDoc extends BaseDoc {
  name: string;
  couleur: string;
}

export interface NiveauDoc extends BaseDoc {
  name: string;
}

export interface GroupeDoc extends BaseDoc {
  prof_id: ObjectId;
  langue_id: ObjectId;
  niveau_id: ObjectId;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  // Instantanés pour l'affichage / recherche
  prof_name: string;
  langue_name: string;
  niveau_name: string;
}

export interface InscriptionNiveau {
  id: string;
  name: string;
}

export interface InscriptionDoc extends BaseDoc {
  etudiant_id: ObjectId;
  langue_id: ObjectId;
  niveau_ids: ObjectId[];
  niveaux: InscriptionNiveau[];
  price: number;
  start_date: string; // YYYY-MM-DD
  expired_at: string | null;
  // Instantanés
  etudiant_name: string;
  langue_name: string;
}

export interface EtudiantGroupeDoc extends BaseDoc {
  groupe_id: ObjectId;
  etudiant_id: ObjectId;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  // Instantanés
  etudiant_name: string;
  langue_id: ObjectId;
  groupe_label: string;
}

export interface PaiementDoc extends BaseDoc {
  inscription_id: ObjectId;
  date: string; // YYYY-MM-DD
  status: StatutPaiement;
  montant: number;
  // Instantanés
  etudiant_id: ObjectId;
  etudiant_name: string;
  langue_id: ObjectId;
  langue_name: string;
}

export interface AuditDoc extends BaseDoc {
  user_id: ObjectId;
  username: string;
  action: AuditAction;
  ressource: string;
  ressource_id: string | null;
  details: string;
}

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
}

/** Réponse standard des endpoints de liste (pagination). */
export interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
