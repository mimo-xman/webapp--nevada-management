"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import type { ListResponse } from "@/lib/types";

export type Dir = "asc" | "desc";

export interface UseListQueryOptions {
  /** Champ de tri par défaut (doit être autorisé côté API). */
  defaultSort: string;
  defaultDir?: Dir;
  defaultLimit?: number;
  /** Désactiver la synchronisation d'URL (ex. widget intégré). */
  syncUrl?: boolean;
}

interface ListState {
  q: string;
  sort: string;
  dir: Dir;
  page: number;
  limit: number;
  filters: Record<string, string>;
}

const CLES_RESERVEES = ["q", "sort", "dir", "page", "limit"];
const LIMITS_VALIDES = [10, 25, 50];

function etatInitial(
  defaultSort: string,
  defaultDir: Dir,
  defaultLimit: number
): ListState {
  const defaut: ListState = {
    q: "",
    sort: defaultSort,
    dir: defaultDir,
    page: 1,
    limit: defaultLimit,
    filters: {},
  };
  if (typeof window === "undefined") return defaut;
  const sp = new URLSearchParams(window.location.search);
  const filters: Record<string, string> = {};
  sp.forEach((v, k) => {
    if (!CLES_RESERVEES.includes(k) && v) filters[k] = v;
  });
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = parseInt(sp.get("limit") || "0", 10);
  const dir = sp.get("dir");
  return {
    q: sp.get("q") || "",
    sort: sp.get("sort") || defaut.sort,
    dir: dir === "asc" || dir === "desc" ? dir : defaut.dir,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: LIMITS_VALIDES.includes(limit) ? limit : defaut.limit,
    filters,
  };
}

/**
 * Hook central de toutes les pages de données :
 * - pagination, recherche, filtres, tri + direction
 * - état reflété dans l'URL (?q=&sort=&dir=&page=&filtres=) → survit au
 *   refresh, partageable, copiable.
 */
export function useListQuery<T>(
  endpoint: string,
  options: UseListQueryOptions
) {
  const { defaultSort, defaultDir = "asc", defaultLimit = 10, syncUrl = true } =
    options;

  const [state, setState] = useState<ListState>(() =>
    etatInitial(defaultSort, defaultDir, defaultLimit)
  );
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: defaultLimit,
    totalPages: 1,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [searchInput, setSearchInput] = useState(state.q);

  // Texte de recherche local (debounce côté hook).

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (state.q) sp.set("q", state.q);
    sp.set("sort", state.sort);
    sp.set("dir", state.dir);
    if (state.page > 1) sp.set("page", String(state.page));
    if (state.limit !== 10) sp.set("limit", String(state.limit));
    for (const [k, v] of Object.entries(state.filters)) {
      if (v) sp.set(k, v);
    }
    return sp.toString();
  }, [state]);

  // Chargement : la requête correspondant à queryString a-t-elle abouti ?
  const [queryCharge, setQueryCharge] = useState<string | null>(null);
  const loading = queryCharge !== queryString;

  // Synchronisation de l'URL (sans navigation RSC) : refresh / copie de lien OK.
  useEffect(() => {
    if (!syncUrl) return;
    const url = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(window.history.state, "", url);
  }, [queryString, syncUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const url = `${endpoint}${queryString ? `?${queryString}` : ""}`;
    api<ListResponse<T>>(url, { signal: controller.signal })
      .then((res) => {
        setRows(res.data);
        setMeta({
          total: res.total,
          page: res.page,
          limit: res.limit,
          totalPages: res.totalPages,
        });
        setErreur(null);
        setQueryCharge(queryString);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error(e);
        setRows([]);
        setMeta({ total: 0, page: 1, limit: defaultLimit, totalPages: 1 });
        setErreur(e instanceof Error ? e.message : "Erreur de chargement.");
        setQueryCharge(queryString);
      });
    return () => controller.abort();
  }, [endpoint, queryString, reloadTick, defaultLimit]);

  // Debounce de la recherche : 350 ms après la dernière frappe.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((s) =>
        s.q === searchInput ? s : { ...s, q: searchInput, page: 1 }
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setFilter = useCallback((key: string, value: string) => {
    setState((s) => ({
      ...s,
      page: 1,
      filters: { ...s.filters, [key]: value },
    }));
  }, []);

  const setSort = useCallback((sort: string) => {
    setState((s) => (s.sort === sort ? s : { ...s, sort, page: 1 }));
  }, []);

  const setDir = useCallback((dir: Dir) => {
    setState((s) => (s.dir === dir ? s : { ...s, dir, page: 1 }));
  }, []);

  const toggleDir = useCallback(() => {
    setState((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((s) => (s.page === page ? s : { ...s, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState((s) => ({ ...s, limit, page: 1 }));
  }, []);

  const reset = useCallback(() => {
    setSearchInput("");
    setState({
      q: "",
      sort: defaultSort,
      dir: defaultDir,
      page: 1,
      limit: defaultLimit,
      filters: {},
    });
  }, [defaultSort, defaultDir, defaultLimit]);

  const refresh = useCallback(() => setReloadTick((t) => t + 1), []);

  const filtresActifs = useMemo(() => {
    let n = Object.values(state.filters).filter(Boolean).length;
    if (state.q) n += 1;
    return n;
  }, [state]);

  return {
    // données
    rows,
    loading,
    erreur,
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    // état
    q: state.q,
    sort: state.sort,
    dir: state.dir,
    filters: state.filters,
    filtresActifs,
    searchInput,
    // actions
    setSearchInput,
    setFilter,
    setSort,
    setDir,
    toggleDir,
    setPage,
    setLimit,
    reset,
    refresh,
    queryString,
  };
}
