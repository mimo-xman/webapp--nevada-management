import { ApiError } from "./auth";
import { ObjectId } from "mongodb";

export interface PersonnePayload {
  first_name: string;
  last_name: string;
  cin: string;
  phone: string;
  email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide et normalise les champs d'une personne (étudiant ou professeur). */
export function validerPersonne(body: Record<string, unknown>): PersonnePayload {
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const cin = String(body.cin ?? "").trim().toUpperCase();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!first_name) throw new ApiError(400, "Le prénom est obligatoire.");
  if (first_name.length > 60)
    throw new ApiError(400, "Le prénom ne doit pas dépasser 60 caractères.");
  if (!last_name) throw new ApiError(400, "Le nom est obligatoire.");
  if (last_name.length > 60)
    throw new ApiError(400, "Le nom ne doit pas dépasser 60 caractères.");
  if (!cin) throw new ApiError(400, "Le CIN est obligatoire.");
  if (!/^[A-Z]{0,2}\d{4,8}$|^[A-Z]{1,3}\d{4,8}$|^[A-Z0-9]{5,12}$/.test(cin)) {
    throw new ApiError(
      400,
      "Le CIN doit contenir entre 5 et 12 caractères alphanumériques."
    );
  }
  if (!phone) throw new ApiError(400, "Le numéro de téléphone est obligatoire.");
  if (!/^\+?[\d\s.-]{8,16}$/.test(phone)) {
    throw new ApiError(400, "Le numéro de téléphone est invalide (8 à 16 chiffres).");
  }
  if (email && !EMAIL_RE.test(email)) {
    throw new ApiError(400, "L'adresse mail est invalide.");
  }

  return { first_name, last_name, cin, phone, email };
}

export function nomComplet(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

/** Vérifie qu'une chaîne est un ObjectId valide, sinon erreur 400. */
export function exigerObjectId(value: unknown, label: string): ObjectId {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value)) {
    throw new ApiError(400, `${label} est invalide ou manquant.`);
  }
  return new ObjectId(value);
}

/** Date civile YYYY-MM-DD obligatoire. */
export function exigerDate(value: unknown, label: string): string {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new ApiError(400, `${label} doit être une date valide.`);
  }
  return s;
}

/** Date civile YYYY-MM-DD optionnelle (null si vide). */
export function dateOptionnelle(value: unknown, label: string): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new ApiError(400, `${label} doit être une date valide.`);
  }
  return s;
}
