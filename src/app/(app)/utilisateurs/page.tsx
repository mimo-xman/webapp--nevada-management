"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCog,
  SquarePen,
  Trash2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type FiltreDef, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { EntityDialog, type ChampSpec } from "@/components/entity-dialog";
import { ConfirmSuppression } from "@/components/confirm-suppression";
import { StatusBadge, type BadgeTone } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { useListQuery } from "@/hooks/use-list-query";
import { useRole } from "@/components/role-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import type { Role } from "@/lib/types";

interface UserRow {
  _id: string;
  username: string;
  role: Role;
  created_at: string;
}

const TONE_ROLE: Record<Role, BadgeTone> = {
  admin: "pin",
  manager: "ambre",
  assistant: "neutre",
};

const TRIS: TriOption[] = [
  { value: "username", label: "Identifiant" },
  { value: "role", label: "Rôle" },
  { value: "created_at", label: "Date de création" },
];

export default function PageUtilisateurs() {
  const { user, peut } = useRole();
  const router = useRouter();
  const list = useListQuery<UserRow>("/api/utilisateurs", {
    defaultSort: "username",
  });

  const [dialog, setDialog] = useState<{ open: boolean; initial: UserRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<UserRow | null>(null);

  // Garde côté client : page réservée à l'administrateur.
  useEffect(() => {
    if (user.role !== "admin") router.replace("/dashboard");
  }, [user.role, router]);

  const filtres: FiltreDef[] = [
    {
      key: "role",
      placeholder: "Tous les rôles",
      options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
        value: r,
        label: ROLE_LABELS[r],
      })),
    },
  ];

  const champs: ChampSpec[] = [
    {
      kind: "text",
      name: "username",
      label: "Identifiant",
      required: true,
      placeholder: "ex. f.elamrani",
      hint: "3 à 30 caractères : lettres, chiffres, . _ -",
    },
    {
      kind: "password",
      name: "password",
      label: "Mot de passe",
      required: !dialog.initial,
      placeholder: dialog.initial ? "Laisser vide pour conserver" : "6 caractères minimum",
      pleineLargeur: true,
    },
    {
      kind: "select",
      name: "role",
      label: "Rôle",
      required: true,
      options: (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
        value: r,
        label: ROLE_LABELS[r],
      })),
      pleineLargeur: true,
    },
  ];

  const colonnes: Colonne<UserRow>[] = [
    {
      key: "username",
      header: "Identifiant",
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-accent-foreground uppercase">
            {r.username.slice(0, 2)}
          </span>
          <span className="font-medium">
            {r.username}
            {r.username === user.username && (
              <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rôle",
      render: (r) => (
        <StatusBadge tone={TONE_ROLE[r.role]}>{ROLE_LABELS[r.role]}</StatusBadge>
      ),
    },
    {
      key: "created_at",
      header: "Créé le",
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Modifier le compte ${r.username}`}
            onClick={() => setDialog({ open: true, initial: r })}
          >
            <SquarePen className="size-4" />
          </Button>
          {r.username !== user.username && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-[var(--argile)]"
              aria-label={`Supprimer le compte ${r.username}`}
              onClick={() => setASupprimer(r)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Système"
        title="Utilisateurs"
        description="Comptes d'accès à la gestion du centre et leurs rôles (admin, gestionnaire, assistant)."
        actions={
          peut("creer") && (
            <Button onClick={() => setDialog({ open: true, initial: null })}>
              <Plus className="size-4" />
              Ajouter un utilisateur
            </Button>
          )
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher un identifiant…"
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

      <DataTable<UserRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={user.role === "admin" ? <ShieldCheck /> : <UserCog />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucun utilisateur ne correspond à cette recherche"
            : "Aucun utilisateur"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Créez les comptes du personnel avec leur rôle."
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
        labelPluriel="utilisateurs"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
        description={
          dialog.initial?.username === user.username
            ? "Vous modifiez votre propre compte : conservez le rôle administrateur."
            : undefined
        }
        endpoint="/api/utilisateurs"
        champs={champs}
        submitLabel="Ajouter l'utilisateur"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/utilisateurs"
        description={
          aSupprimer
            ? `Supprimer le compte ${aSupprimer.username} (rôle ${ROLE_LABELS[aSupprimer.role]}) ? Cette personne ne pourra plus se connecter.`
            : ""
        }
        onDeleted={list.refresh}
      />
    </div>
  );
}
