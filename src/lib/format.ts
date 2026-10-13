/** Helpers de formatage partagés (client + serveur). */

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const nombreFmt = new Intl.NumberFormat("fr-FR");

export function fmtNombre(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nombreFmt.format(n);
}

export function fmtMontant(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${nombreFmt.format(n)} DH`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return typeof d === "string" ? d : "—";
  // Les dates « YYYY-MM-DD » sont déjà des dates civiles : format direct.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }
  return dateFmt.format(date);
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFmt.format(date);
}

/** Date du jour au format YYYY-MM-DD (fuseau du centre). */
export function todayStr(tz = "Africa/Casablanca"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** « 2026-03 » → « mars 2026 » */
export function fmtMois(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MOIS_COURTS[idx] ?? m} ${y}`;
}

export function fmtMoisCourt(ym: string): string {
  const [, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return MOIS_COURTS[idx] ?? m;
}

/** Palette dédiée aux langues (chips colorées). */
export const LANGUE_COULEURS = [
  "#1E6B52",
  "#C4572E",
  "#B98A1F",
  "#7C5CB0",
  "#2E7C8A",
  "#8A5A44",
  "#A83E62",
  "#5B7553",
];

export function couleurLangue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return LANGUE_COULEURS[h % LANGUE_COULEURS.length];
}

export function initiales(prenom?: string, nom?: string): string {
  const a = prenom?.trim()?.[0] ?? "";
  const b = nom?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}
