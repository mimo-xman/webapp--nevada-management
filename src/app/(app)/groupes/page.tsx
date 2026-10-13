"use client";

import { useState } from "react";
import {
  Boxes,
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
import { StatusBadge, LangueChip } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { useListQuery } from "@/hooks/use-list-query";
import { useOptions } from "@/hooks/use-options";
import { useRole } from "@/components/role-context";
import { couleurLangue, fmtDate } from "@/lib/format";

interface GroupeRow {
  _id: string;
  prof_id: string;
  langue_id: string;
  niveau_id: string;
  start_date: string;
  end_date: string | null;
  prof_name: string;
  langue_name: string;
  niveau_name: string;
}

const TRIS: TriOption[] = [
  { value: "langue_name", label: "Langue" },
  { value: "niveau_name", label: "Niveau" },
  { value: "prof_name", label: "Professeur" },
  { value: "start_date", label: "Date de début" },
  { value: "end_date", label: "Date de fin" },
];

export default function PageGroupes() {
  const list = useListQuery<GroupeRow>("/api/groupes", {
    defaultSort: "start_date",
    defaultDir: "desc",
  });
  const { peut } = useRole();
  const { options: profs } = useOptions("profs");
  const { options: langues } = useOptions("langues");
  const { options: niveaux } = useOptions("niveaux");

  const [dialog, setDialog] = useState<{ open: boolean; initial: GroupeRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<GroupeRow | null>(null);

  const filtres: FiltreDef[] = [
    { key: "langue_id", placeholder: "Toutes les langues", options: langues },
    { key: "prof_id", placeholder: "Tous les professeurs", options: profs },
    {
      key: "statut",
      placeholder: "Tous les statuts",
      options: [
        { value: "actif", label: "Actifs" },
        { value: "termine", label: "Terminés" },
      ],
    },
  ];

  const champs: ChampSpec[] = [
    {
      kind: "select",
      name: "langue_id",
      label: "Langue",
      required: true,
      options: langues,
      optionnementChargement: true,
    },
    {
      kind: "select",
      name: "niveau_id",
      label: "Niveau",
      required: true,
      options: niveaux,
      optionnementChargement: true,
    },
    {
      kind: "select",
      name: "prof_id",
      label: "Professeur",
      required: true,
      options: profs,
      optionnementChargement: true,
      pleineLargeur: true,
    },
    {
      kind: "date",
      name: "start_date",
      label: "Date de début",
      required: true,
    },
    {
      kind: "date",
      name: "end_date",
      label: "Date de fin",
      hint: "Laisser vide tant que le groupe est en cours.",
    },
  ];

  function construirePayload(v: Record<string, unknown>) {
    return {
      langue_id: v.langue_id || null,
      niveau_id: v.niveau_id || null,
      prof_id: v.prof_id || null,
      start_date: v.start_date || "",
      end_date: v.end_date || null,
    };
  }

  const colonnes: Colonne<GroupeRow>[] = [
    {
      key: "groupe",
      header: "Groupe",
      render: (r) => (
        <div>
          <LangueChip nom={r.langue_name} couleur={couleurLangue(r.langue_name)} />
          <p className="mt-1 font-mono text-[13px] font-semibold">{r.niveau_name}</p>
        </div>
      ),
    },
    {
      key: "prof",
      header: "Professeur",
      render: (r) => <span className="text-sm">{r.prof_name}</span>,
    },
    {
      key: "periode",
      header: "Période",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">
          {fmtDate(r.start_date)}
          <span className="mx-1 text-muted-foreground">→</span>
          {r.end_date ? fmtDate(r.end_date) : "…"}
        </span>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      render: (r) =>
        r.end_date ? (
          <StatusBadge tone="neutre">Terminé</StatusBadge>
        ) : (
          <StatusBadge tone="pin">Actif</StatusBadge>
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
              aria-label={`Modifier le groupe ${r.langue_name} ${r.niveau_name}`}
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
              aria-label={`Supprimer le groupe ${r.langue_name} ${r.niveau_name}`}
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
        title="Groupes"
        description="Sessions d'enseignement : une langue, un niveau, un professeur, une période."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Ajouter un groupe
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher langue, niveau, prof…"
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

      <DataTable<GroupeRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<Boxes />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucun groupe ne correspond à cette recherche"
            : "Aucun groupe pour le moment"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Créez un groupe en choisissant une langue, un niveau et un professeur."
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
        labelPluriel="groupes"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier le groupe" : "Ajouter un groupe"}
        description="Le groupe est identifié par sa langue, son niveau et sa période."
        endpoint="/api/groupes"
        champs={champs}
        submitLabel="Ajouter le groupe"
        onSaved={list.refresh}
        buildPayload={construirePayload}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/groupes"
        description={
          aSupprimer
            ? `Supprimer le groupe ${aSupprimer.langue_name} · ${aSupprimer.niveau_name} (prof. ${aSupprimer.prof_name}) ? Les relations étudiants-groupes associées seront conservées mais orphelines.`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
