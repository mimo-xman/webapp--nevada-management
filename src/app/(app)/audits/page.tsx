"use client";

import { useEffect } from "react";
import { ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type FiltreDef, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { StatusBadge, type BadgeTone } from "@/components/badges";
import { useListQuery } from "@/hooks/use-list-query";
import { useRole } from "@/components/role-context";
import { ACTION_LABELS, RESSOURCE_LABELS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import type { AuditAction } from "@/lib/types";

interface AuditRow {
  _id: string;
  username: string;
  action: AuditAction;
  ressource: string;
  details: string;
  created_at: string;
}

const TONE_AUDIT: Record<AuditAction, BadgeTone> = {
  creer: "pin",
  modifier: "ambre",
  supprimer: "argile",
  connexion: "neutre",
};

const TRIS: TriOption[] = [
  { value: "created_at", label: "Date" },
  { value: "username", label: "Utilisateur" },
  { value: "action", label: "Action" },
  { value: "ressource", label: "Ressource" },
];

export default function PageAudits() {
  const { user } = useRole();
  const router = useRouter();
  const list = useListQuery<AuditRow>("/api/audits", {
    defaultSort: "created_at",
    defaultDir: "desc",
  });

  // Garde côté client : journal réservé à l'administrateur.
  useEffect(() => {
    if (user.role !== "admin") router.replace("/dashboard");
  }, [user.role, router]);

  const filtres: FiltreDef[] = [
    {
      key: "action",
      placeholder: "Toutes les actions",
      options: (Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => ({
        value: a,
        label: ACTION_LABELS[a],
      })),
    },
    {
      key: "ressource",
      placeholder: "Toutes les ressources",
      options: Object.entries(RESSOURCE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ];

  const colonnes: Colonne<AuditRow>[] = [
    {
      key: "date",
      header: "Date & heure",
      render: (r) => (
        <time className="chiffres whitespace-nowrap font-mono text-[13px]">
          {fmtDateTime(r.created_at)}
        </time>
      ),
    },
    {
      key: "user",
      header: "Utilisateur",
      render: (r) => (
        <span className="font-medium">{r.username}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <StatusBadge tone={TONE_AUDIT[r.action]}>
          {ACTION_LABELS[r.action]}
        </StatusBadge>
      ),
    },
    {
      key: "ressource",
      header: "Ressource",
      render: (r) => (
        <span className="font-mono text-[13px]">
          {RESSOURCE_LABELS[r.ressource] ?? r.ressource}
        </span>
      ),
    },
    {
      key: "details",
      header: "Détail",
      render: (r) => (
        <span className="text-[13px] text-muted-foreground">{r.details}</span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Système"
        title="Audits"
        description="Journal complet des activités : créations, modifications, suppressions et connexions."
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher par utilisateur ou détail…"
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

      <DataTable<AuditRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<ScrollText />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucune activité ne correspond à cette recherche"
            : "Journal vide"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Les actions des utilisateurs seront enregistrées ici."
        }
        emptyAction={
          <button
            onClick={list.reset}
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Réinitialiser les filtres
          </button>
        }
      />

      <PaginationBar
        total={list.total}
        page={list.page}
        limit={list.limit}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        labelPluriel="entrées"
        loading={list.loading}
      />
    </div>
  );
}
