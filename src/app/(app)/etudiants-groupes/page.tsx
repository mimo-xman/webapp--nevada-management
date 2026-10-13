"use client";

import { useState } from "react";
import {
  UsersRound,
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

interface RelationRow {
  _id: string;
  etudiant_id: string;
  etudiant_name: string;
  groupe_id: string;
  groupe_label: string;
  start_date: string;
  end_date: string | null;
}

const TRIS: TriOption[] = [
  { value: "etudiant_name", label: "Étudiant" },
  { value: "groupe_label", label: "Groupe" },
  { value: "start_date", label: "Date de début" },
  { value: "end_date", label: "Date de fin" },
];

export default function PageEtudiantsGroupes() {
  const list = useListQuery<RelationRow>("/api/etudiants-groupes", {
    defaultSort: "created_at",
    defaultDir: "desc",
  });
  const { peut } = useRole();
  const { options: etudiants } = useOptions("etudiants");
  const { options: groupes } = useOptions("groupes");
  const { options: langues } = useOptions("langues");

  const [dialog, setDialog] = useState<{ open: boolean; initial: RelationRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<RelationRow | null>(null);

  const filtres: FiltreDef[] = [
    { key: "langue_id", placeholder: "Toutes les langues", options: langues },
    {
      key: "statut",
      placeholder: "Tous les statuts",
      options: [
        { value: "actif", label: "Relations actives" },
        { value: "termine", label: "Relations terminées" },
      ],
    },
  ];

  const champs: ChampSpec[] = [
    {
      kind: "select",
      name: "etudiant_id",
      label: "Étudiant",
      required: true,
      options: etudiants,
      optionnementChargement: true,
      pleineLargeur: true,
    },
    {
      kind: "select",
      name: "groupe_id",
      label: "Groupe",
      required: true,
      options: groupes,
      optionnementChargement: true,
      pleineLargeur: true,
      hint: "Règle du centre : un seul groupe actif par langue pour chaque étudiant.",
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
      hint: "Laisser vide tant que l'étudiant fréquente le groupe.",
    },
  ];

  function construirePayload(v: Record<string, unknown>) {
    return {
      etudiant_id: v.etudiant_id || null,
      groupe_id: v.groupe_id || null,
      start_date: v.start_date || "",
      end_date: v.end_date || null,
    };
  }

  const colonnes: Colonne<RelationRow>[] = [
    {
      key: "etudiant",
      header: "Étudiant",
      render: (r) => <span className="font-medium">{r.etudiant_name}</span>,
    },
    {
      key: "groupe",
      header: "Groupe",
      render: (r) => (
        <span className="font-mono text-[13px] font-semibold">{r.groupe_label}</span>
      ),
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
          <StatusBadge tone="neutre">Terminée</StatusBadge>
        ) : (
          <StatusBadge tone="pin">Active</StatusBadge>
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
              aria-label={`Modifier la relation de ${r.etudiant_name}`}
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
              aria-label={`Supprimer la relation de ${r.etudiant_name}`}
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
        title="Étudiants & groupes"
        description="Affectations des étudiants aux groupes, avec leur période de fréquentation."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Affecter un étudiant
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher par étudiant ou groupe…"
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

      <DataTable<RelationRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<UsersRound />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucune relation ne correspond à cette recherche"
            : "Aucune affectation pour le moment"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Placez un étudiant dans un groupe pour suivre sa présence pédagogique."
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
        labelPluriel="relations"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier la relation" : "Affecter un étudiant à un groupe"}
        endpoint="/api/etudiants-groupes"
        champs={champs}
        buildPayload={construirePayload}
        submitLabel="Affecter l'étudiant"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/etudiants-groupes"
        description={
          aSupprimer
            ? `Supprimer la relation entre ${aSupprimer.etudiant_name} et le groupe ${aSupprimer.groupe_label} ?`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
