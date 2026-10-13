import { ObjectId } from "mongodb";
import { ApiError } from "./auth";

export type Dir = "asc" | "desc";

export interface ListParams {
  page: number;
  limit: number;
  skip: number;
  q: string;
  sort: string;
  dir: Dir;
}

/**
 * Parse les paramètres de liste standard :
 * ?page=1&limit=10&q=texte&sort=champ&dir=asc|desc
 */
export function parseListParams(
  searchParams: URLSearchParams,
  allowedSorts: string[],
  defaultSort: string,
  defaultDir: Dir = "asc"
): ListParams {
  const pageRaw = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const limitRaw = parseInt(searchParams.get("limit") || "10", 10);
  const limit = [10, 25, 50].includes(limitRaw) ? limitRaw : 10;

  const q = (searchParams.get("q") || "").trim().slice(0, 120);

  const sortRaw = searchParams.get("sort") || defaultSort;
  const sort = allowedSorts.includes(sortRaw) ? sortRaw : defaultSort;

  const dirRaw = searchParams.get("dir");
  const dir: Dir =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir;

  return { page, limit, skip: (page - 1) * limit, q, sort, dir };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Filtre $or insensible à la casse sur plusieurs champs texte. */
export function qFilter(
  fields: string[],
  q: string
): Record<string, unknown> | null {
  if (!q) return null;
  return {
    $or: fields.map((f) => ({
      [f]: { $regex: escapeRegex(q), $options: "i" },
    })),
  };
}

/**
 * Convertit un paramètre d'URL en ObjectId.
 * - absent / vide → null (filtre non appliqué)
 * - présent mais invalide → erreur 400 explicite
 */
export function idParam(
  searchParams: URLSearchParams,
  key: string
): ObjectId | null {
  const raw = searchParams.get(key);
  if (!raw) return null;
  if (!/^[0-9a-fA-F]{24}$/.test(raw)) {
    throw new ApiError(400, `Le paramètre « ${key} » n'est pas un identifiant valide.`);
  }
  return new ObjectId(raw);
}

/** Trie multi-champs Mongo : { champ: 1 | -1 }. */
export function sortStage(sort: string, dir: Dir): Record<string, 1 | -1> {
  return { [sort]: dir === "desc" ? -1 : 1 };
}

export function paginate<T>(data: T[], total: number, p: ListParams) {
  return {
    data,
    total,
    page: p.page,
    limit: p.limit,
    totalPages: Math.max(1, Math.ceil(total / p.limit)),
  };
}
