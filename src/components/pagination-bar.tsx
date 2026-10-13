"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtNombre } from "@/lib/format";

function pagesVisibles(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [1];
  const debut = Math.max(2, page - 1);
  const fin = Math.min(totalPages - 1, page + 1);
  if (debut > 2) out.push("…");
  for (let p = debut; p <= fin; p++) out.push(p);
  if (fin < totalPages - 1) out.push("…");
  out.push(totalPages);
  return out;
}

/**
 * Pagination standard : X résultats, taille de page (10 / 25 / 50),
 * navigation numérotée avec ellipses. L'état « page » et « limit »
 * vit dans l'URL.
 */
export function PaginationBar({
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  onLimitChange,
  labelPluriel = "résultats",
  loading,
}: {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onLimitChange: (l: number) => void;
  labelPluriel?: string;
  loading?: boolean;
}) {
  const plageDebut = total === 0 ? 0 : (page - 1) * limit + 1;
  const plageFin = Math.min(page * limit, total);

  return (
    <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <p className="chiffres whitespace-nowrap">
          {fmtNombre(plageDebut)}–{fmtNombre(plageFin)} sur{" "}
          <span className="font-semibold text-foreground">
            {fmtNombre(total)}
          </span>{" "}
          {labelPluriel}
        </p>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Par page</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => onLimitChange(Number(v))}
          >
            <SelectTrigger
              aria-label="Résultats par page"
              size="sm"
              className="h-8 w-[72px] bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <nav
        aria-label="Pagination"
        className="flex items-center justify-end gap-1"
      >
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(1)}
          aria-label="Première page"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <ul className="mx-1 flex items-center gap-1">
          {pagesVisibles(page, totalPages).map((p, i) =>
            p === "…" ? (
              <li
                key={`ell-${i}`}
                className="px-1 font-mono text-xs text-muted-foreground"
                aria-hidden="true"
              >
                …
              </li>
            ) : (
              <li key={p}>
                <Button
                  variant={p === page ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "chiffres size-8",
                    p === page
                      ? "pointer-events-none font-semibold"
                      : "bg-card"
                  )}
                  aria-current={p === page ? "page" : undefined}
                  disabled={loading}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              </li>
            )
          )}
        </ul>
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 bg-card"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(totalPages)}
          aria-label="Dernière page"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}
