"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { type ReactNode } from "react";

export interface Colonne<T> {
  key: string;
  header: string;
  className?: string;
  headClassName?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Colonne<T>[];
  rows: T[];
  loading: boolean;
  rowKey: (row: T) => string;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

const LARGUEURS_SQUELETTE = ["62%", "48%", "70%", "40%", "55%", "66%"];

/**
 * Tableau de données générique : en-têtes mono, lignes hover,
 * squelettes de chargement et état vide orienté action.
 */
export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(27,42,37,0.05)]">
      <div className="overflow-x-auto defile-doux">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                    c.headClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b last:border-0">
                  {columns.map((c, j) => (
                    <td key={c.key} className="px-4 py-3.5">
                      <Skeleton
                        className="h-4"
                        style={{
                          width: LARGUEURS_SQUELETTE[
                            (i + j) % LARGUEURS_SQUELETTE.length
                          ],
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b transition-colors last:border-0 hover:bg-accent/40"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          {emptyIcon && (
            <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
              {emptyIcon}
            </div>
          )}
          <p className="font-display text-base font-semibold">{emptyTitle}</p>
          {emptyDescription && (
            <p className="max-w-sm text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          )}
          {emptyAction && <div className="mt-2">{emptyAction}</div>}
        </div>
      )}
    </div>
  );
}
