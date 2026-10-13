"use client";

import { useState } from "react";
import {
  GraduationCap,
  SquarePen,
  Trash2,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type FiltreDef, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { EntityDialog, type ChampSpec } from "@/components/entity-dialog";
import { ConfirmSuppression } from "@/components/confirm-suppression";
import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { useListQuery } from "@/hooks/use-list-query";
import { useOptions } from "@/hooks/use-options";
import { useRole } from "@/components/role-context";
import { fmtDate } from "@/lib/format";

interface ProfRow {
  _id: string;
  first_name: string;
  last_name: string;
  cin: string;
  phone: string;
  email: string;
  groupes_actifs: number;
  created_at: string;
}

const TRIS: TriOption[] = [
  { value: "last_name", label: "Nom" },
  { value: "first_name", label: "Prénom" },
  { value: "cin", label: "CIN" },
  { value: "created_at", label: "Date d'ajout" },
];

export default function PageProfs() {
  const list = useListQuery<ProfRow>("/api/profs", { defaultSort: "last_name" });
  const { peut } = useRole();
  const { options: langues } = useOptions("langues");

  const [dialog, setDialog] = useState<{ open: boolean; initial: ProfRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<ProfRow | null>(null);

  const filtres: FiltreDef[] = [
    {
      key: "langue_id",
      placeholder: "Toutes les langues",
      options: langues,
    },
  ];

  const champs: ChampSpec[] = [
    { kind: "text", name: "first_name", label: "Prénom", required: true, placeholder: "ex. Karim" },
    { kind: "text", name: "last_name", label: "Nom", required: true, placeholder: "ex. Idrissi" },
    {
      kind: "text",
      name: "cin",
      label: "CIN",
      required: true,
      placeholder: "ex. AB784512",
      hint: "Numéro de carte d'identité nationale (unique).",
    },
    { kind: "tel", name: "phone", label: "Téléphone", required: true, placeholder: "ex. 06 62 34 56 78" },
    {
      kind: "email",
      name: "email",
      label: "Adresse mail",
      placeholder: "ex. karim@example.com",
      pleineLargeur: true,
    },
  ];

  const colonnes: Colonne<ProfRow>[] = [
    {
      key: "nom",
      header: "Professeur",
      render: (r) => (
        <div>
          <p className="font-medium">
            {r.last_name} {r.first_name}
          </p>
          {r.email && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "cin",
      header: "CIN",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{r.cin}</span>
      ),
    },
    {
      key: "phone",
      header: "Téléphone",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{r.phone}</span>
      ),
    },
    {
      key: "groupes",
      header: "Groupes actifs",
      render: (r) =>
        r.groupes_actifs > 0 ? (
          <StatusBadge tone="pin">
            {r.groupes_actifs} groupe{r.groupes_actifs > 1 ? "s" : ""}
          </StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground">Aucun</span>
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
              aria-label={`Modifier ${r.last_name} ${r.first_name}`}
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
              aria-label={`Supprimer ${r.last_name} ${r.first_name}`}
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
        title="Professeurs"
        description="Équipe enseignante du centre : coordonnées et groupes pris en charge."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Ajouter un professeur
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher par nom, CIN, téléphone…"
        triOptions={TRIS}
        sort={list.sort}
        onSortChange={list.setSort}
        dir={list.dir}
        onToggleDir={list.toggleDir}
        filtres={filtres}
        filtreValues={list.filters}
        onFiltreChange={list.setFilter}
        filtresActifs={list.filtresActifs}
        onReset={list.reset}
      />

      <DataTable<ProfRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<GraduationCap />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucun professeur ne correspond à cette recherche"
            : "Aucun professeur pour le moment"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Ajoutez le premier professeur pour ouvrir des groupes."
        }
        emptyAction={
          <Button variant="outline" onClick={list.reset} className="bg-card">
            Réinitialiser les filtres
          </Button>
        }
      />

      <PaginationBar
        total={list.total}
        page={list.page}
        limit={list.limit}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        labelPluriel="professeurs"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier le professeur" : "Ajouter un professeur"}
        endpoint="/api/profs"
        champs={champs}
        submitLabel="Ajouter le professeur"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/profs"
        description={
          aSupprimer
            ? `Supprimer le professeur ${aSupprimer.last_name} ${aSupprimer.first_name} (CIN ${aSupprimer.cin}) ?`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
