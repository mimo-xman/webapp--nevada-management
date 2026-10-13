"use client";

import { Search, ArrowDownUp, RotateCcw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Dir } from "@/hooks/use-list-query";

export interface TriOption {
  value: string;
  label: string;
}

export interface FiltreDef {
  key: string;
  placeholder: string;
  options: { value: string; label: string }[];
}

interface ToolbarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  triOptions: TriOption[];
  sort: string;
  onSortChange: (v: string) => void;
  dir: Dir;
  onToggleDir: () => void;
  filtres?: FiltreDef[];
  filtreValues?: Record<string, string>;
  onFiltreChange?: (key: string, value: string) => void;
  filtresActifs: number;
  onReset: () => void;
}

/**
 * Barre d'outils standard de toutes les pages de données :
 * recherche texte, filtres à options, tri + bascule de direction
 * (ASC ⇄ DESC) et remise à zéro. Tout est reflété dans l'URL.
 */
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  triOptions,
  sort,
  onSortChange,
  dir,
  onToggleDir,
  filtres = [],
  filtreValues = {},
  onFiltreChange,
  filtresActifs,
  onReset,
}: ToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      {/* Recherche */}
      <div className="relative flex-1 md:min-w-56 md:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="bg-card pl-9 pr-8"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Filtres */}
      {filtres.map((f) => (
        <Select
          key={f.key}
          value={filtreValues[f.key] || "all"}
          onValueChange={(v) => onFiltreChange?.(f.key, v === "all" ? "" : v)}
        >
          <SelectTrigger
            aria-label={f.placeholder}
            className="w-full bg-card md:w-44"
          >
            <span className="truncate">
              {filtreValues[f.key]
                ? f.options.find((o) => o.value === filtreValues[f.key])?.label
                : f.placeholder}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.placeholder}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Tri + direction */}
      <div className="flex items-center gap-2">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger
            aria-label="Trier par"
            className="w-full bg-card md:w-48"
          >
            <span className="text-muted-foreground">Trier :&nbsp;</span>
            <span className="truncate">
              {triOptions.find((o) => o.value === sort)?.label ?? sort}
            </span>
          </SelectTrigger>
          <SelectContent>
            {triOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onToggleDir}
          aria-label={
            dir === "asc"
              ? "Direction actuelle : croissant. Passer en décroissant"
              : "Direction actuelle : décroissant. Passer en croissant"
          }
          title={dir === "asc" ? "Croissant (A → Z)" : "Décroissant (Z → A)"}
          className="bg-card shrink-0"
        >
          <ArrowDownUp
            className={cn(
              "size-4 transition-transform",
              dir === "desc" && "rotate-180"
            )}
            aria-hidden="true"
          />
        </Button>
      </div>

      {/* Remise à zéro */}
      {filtresActifs > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Réinitialiser ({filtresActifs})
        </Button>
      )}
    </div>
  );
}
