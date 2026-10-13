import type { AuditAction } from "./types";

/** Libellés français des actions d'audit (client + serveur). */
export const ACTION_LABELS: Record<AuditAction, string> = {
  creer: "Création",
  modifier: "Modification",
  supprimer: "Suppression",
  connexion: "Connexion",
};

export const RESSOURCE_LABELS: Record<string, string> = {
  etudiants: "Étudiants",
  profs: "Professeurs",
  langues: "Langues",
  niveaux: "Niveaux",
  groupes: "Groupes",
  etudiants_groupes: "Étudiants & groupes",
  inscriptions: "Inscriptions",
  paiements: "Paiements",
  utilisateurs: "Utilisateurs",
  auth: "Connexion",
  paiements_generation: "Génération de paiements",
};
