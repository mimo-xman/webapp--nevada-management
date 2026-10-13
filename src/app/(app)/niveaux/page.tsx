"use client";

import { useState } from "react";
import {
  Layers,
  SquarePen,
  Trash2,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { EntityDialog, type ChampSpec } from "@/components/entity-dialog";
import { ConfirmSuppression } from "@/components/confirm-suppression";
import { Button } from "@/components/ui/button";
import { useListQuery } from "@/hooks/use-list-query";
import { useRole } from "@/components/role-context";
import { fmtDate } from "@/lib/format";

interface NiveauRow {
  _id: string;
  name: string;
  created_at: string;
}

const TRIS: TriOption[] = [
  { value: "name", label: "Nom" },
  { value: "created_at", label: "Date d'ajout" },
];

export default function PageNiveaux() {
  const list = useListQuery<NiveauRow>("/api/niveaux", { defaultSort: "name" });
  const { peut } = useRole();

  const [dialog, setDialog] = useState<{ open: boolean; initial: NiveauRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<NiveauRow | null>(null);

  const champs: ChampSpec[] = [
    {
      kind: "text",
      name: "name",
      label: "Nom du niveau",
      required: true,
      placeholder: "ex. B2",
      pleineLargeur: true,
      hint: "Les niveaux forment un catalogue commun à toutes les langues (CECRL).",
    },
  ];

  const colonnes: Colonne<NiveauRow>[] = [
    {
      key: "name",
      header: "Niveau",
      render: (r) => (
        <span className="font-mono text-[13px] font-semibold uppercase">{r.name}</span>
      ),
    },
    {
      key: "created_at",
      header: "Ajouté le",
      render: (r) => (
        <span className="chiffres font-mono text-[13px] text-muted-foreground">
          {fmtDate(r.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headClassName: "text-right w-px",
      className: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {peut("modifier") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={`Modifier le niveau ${r.name}`}
              onClick={() => setDialog({ open: true, initial: r })}
            >
              <SquarePen className="size-4" />
            </Button>
          )}
          {peut("supprimer") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-[var(--argile)]"
              aria-label={`Supprimer le niveau ${r.name}`}
              onClick={() => setASupprimer(r)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          {!peut("modifier") && !peut("supprimer") && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Pédagogie"
        title="Niveaux"
        description="Échelle des niveaux du centre (A1 → C1) : commune à toutes les langues."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Ajouter un niveau
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher un niveau…"
        triOptions={TRIS}
        sort={list.sort}
        onSortChange={list.setSort}
        dir={list.dir}
        onToggleDir={list.toggleDir}
        filtresActifs={list.filtresActifs}
        onReset={list.reset}
      />

      <DataTable<NiveauRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<Layers />}
        emptyTitle="Aucun niveau trouvé"
        emptyDescription="Ajoutez les niveaux pédagogiques (A1, A2, B1…) pour structurer les groupes."
      />

      <PaginationBar
        total={list.total}
        page={list.page}
        limit={list.limit}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        labelPluriel="niveaux"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier le niveau" : "Ajouter un niveau"}
        endpoint="/api/niveaux"
        champs={champs}
        submitLabel="Ajouter le niveau"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/niveaux"
        description={
          aSupprimer
            ? `Supprimer le niveau « ${aSupprimer.name} » ?`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
