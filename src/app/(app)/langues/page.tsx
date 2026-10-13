"use client";

import { useState } from "react";
import {
  Languages,
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
import { LangueChip } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { useListQuery } from "@/hooks/use-list-query";
import { useRole } from "@/components/role-context";
import { fmtDate, fmtNombre } from "@/lib/format";

interface LangueRow {
  _id: string;
  name: string;
  couleur: string;
  nb_groupes: number;
  nb_niveaux: number;
  created_at: string;
}

const TRIS: TriOption[] = [
  { value: "name", label: "Nom" },
  { value: "created_at", label: "Date d'ajout" },
];

export default function PageLangues() {
  const list = useListQuery<LangueRow>("/api/langues", { defaultSort: "name" });
  const { peut } = useRole();

  const [dialog, setDialog] = useState<{ open: boolean; initial: LangueRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<LangueRow | null>(null);

  const champs: ChampSpec[] = [
    {
      kind: "text",
      name: "name",
      label: "Nom de la langue",
      required: true,
      placeholder: "ex. Espagnol",
      pleineLargeur: true,
      hint: "La couleur de la puce est attribuée automatiquement.",
    },
  ];

  const colonnes: Colonne<LangueRow>[] = [
    {
      key: "name",
      header: "Langue",
      render: (r) => <LangueChip nom={r.name} couleur={r.couleur} />,
    },
    {
      key: "groupes",
      header: "Groupes",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{fmtNombre(r.nb_groupes)}</span>
      ),
    },
    {
      key: "niveaux",
      header: "Niveaux disponibles",
      render: () => (
        <span className="text-[13px] text-muted-foreground">
          Catalogue commun aux langues
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Ajoutée le",
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
              aria-label={`Modifier ${r.name}`}
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
              aria-label={`Supprimer ${r.name}`}
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
        title="Langues"
        description="Catalogue des langues enseignées au centre. Chaque langue porte sa couleur d'identification."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Ajouter une langue
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher une langue…"
        triOptions={TRIS}
        sort={list.sort}
        onSortChange={list.setSort}
        dir={list.dir}
        onToggleDir={list.toggleDir}
        filtresActifs={list.filtresActifs}
        onReset={list.reset}
      />

      <DataTable<LangueRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<Languages />}
        emptyTitle="Aucune langue trouvée"
        emptyDescription="Ajoutez les langues enseignées au centre pour ouvrir des groupes."
      />

      <PaginationBar
        total={list.total}
        page={list.page}
        limit={list.limit}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        labelPluriel="langues"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier la langue" : "Ajouter une langue"}
        endpoint="/api/langues"
        champs={champs}
        submitLabel="Ajouter la langue"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/langues"
        description={
          aSupprimer
            ? `Supprimer la langue « ${aSupprimer.name} » ? Les groupes et inscriptions liés resteront dans l'historique avec leur libellé.`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
