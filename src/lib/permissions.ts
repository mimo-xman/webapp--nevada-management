import type { Role, StatutPaiement } from "./types";

export type Capability = "creer" | "modifier" | "supprimer";

/**
 * Matrice des permissions, conforme à la conception :
 * - Assistant : ajouter + consulter uniquement
 * - Manager   : ajouter + modifier + consulter + page Gains
 * - Admin     : tout (+ suppression, Utilisateurs, Audits)
 */
export function peut(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false;
  switch (cap) {
    case "creer":
      return true;
    case "modifier":
      return role === "admin" || role === "manager";
    case "supprimer":
      return role === "admin";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  assistant: "Assistant",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Ajouter, modifier, supprimer, consulter + Gains + Audits",
  manager: "Ajouter, modifier, consulter + page Gains",
  assistant: "Ajouter et consulter les données",
};

export const STATUT_PAIEMENT_LABELS: Record<StatutPaiement, string> = {
  en_attente: "En attente",
  payer: "Payé",
  annuler: "Annulé",
};
