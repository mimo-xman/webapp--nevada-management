"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  SquarePen,
  Trash2,
  Plus,
  Hourglass,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type FiltreDef, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { EntityDialog, type ChampSpec } from "@/components/entity-dialog";
import { ConfirmSuppression } from "@/components/confirm-suppression";
import { StatusBadge, LangueChip } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useListQuery } from "@/hooks/use-list-query";
import { useOptions } from "@/hooks/use-options";
import { useRole } from "@/components/role-context";
import { api } from "@/lib/api-client";
import { couleurLangue, fmtDate, fmtMontant } from "@/lib/format";

interface InscriptionRow {
  _id: string;
  etudiant_id: string;
  etudiant_name: string;
  langue_id: string;
  langue_name: string;
  niveaux: { id: string; name: string }[];
  price: number;
  start_date: string;
  expired_at: string | null;
}

interface AnalyseExpiration {
  inscription: { etudiant_name: string; langue_name: string };
  groupes_lies: { _id: string; groupe_label: string; start_date: string }[];
}

const TRIS: TriOption[] = [
  { value: "etudiant_name", label: "Étudiant" },
  { value: "langue_name", label: "Langue" },
  { value: "price", label: "Prix" },
  { value: "start_date", label: "Date de début" },
  { value: "created_at", label: "Date d'ajout" },
];

export default function PageInscriptions() {
  const list = useListQuery<InscriptionRow>("/api/inscriptions", {
    defaultSort: "created_at",
    defaultDir: "desc",
  });
  const { peut } = useRole();
  const { options: etudiants } = useOptions("etudiants");
  const { options: langues } = useOptions("langues");
  const { options: niveaux } = useOptions("niveaux");

  const [dialog, setDialog] = useState<{ open: boolean; initial: InscriptionRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<InscriptionRow | null>(null);

  // Flux d'expiration : analyse → confirmation → exécution
  const [expiration, setExpiration] = useState<InscriptionRow | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseExpiration | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [terminerGroupes, setTerminerGroupes] = useState(true);
  const [expirationEnCours, setExpirationEnCours] = useState(false);

  function fermerExpiration() {
    setAnalyse(null);
    setTerminerGroupes(true);
    setExpiration(null);
  }

  useEffect(() => {
    if (!expiration) return;
    setAnalyseEnCours(true);
    api<AnalyseExpiration>(`/api/inscriptions/${expiration._id}/expirer`)
      .then(setAnalyse)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
        fermerExpiration();
      })
      .finally(() => setAnalyseEnCours(false));
  }, [expiration]);

  async function confirmerExpiration() {
    if (!expiration) return;
    setExpirationEnCours(true);
    try {
      const res = await api<{ groupes_termines: number }>(
        `/api/inscriptions/${expiration._id}/expirer`,
        { method: "POST", body: JSON.stringify({ terminer_groupes: terminerGroupes }) }
      );
      toast.success(
        res.groupes_termines > 0
          ? "Inscription expirée. Les relations de groupe ont été terminées."
          : "Inscription marquée comme expirée."
      );
      fermerExpiration();
      list.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setExpirationEnCours(false);
    }
  }

  const filtres: FiltreDef[] = [
    { key: "langue_id", placeholder: "Toutes les langues", options: langues },
    {
      key: "statut",
      placeholder: "Tous les statuts",
      options: [
        { value: "actif", label: "Actives" },
        { value: "expire", label: "Expirées" },
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
      name: "langue_id",
      label: "Langue",
      required: true,
      options: langues,
      optionnementChargement: true,
    },
    {
      kind: "multiselect",
      name: "niveau_ids",
      label: "Niveaux couverts",
      required: true,
      options: niveaux,
      hint: "Règle du centre : une seule inscription active par langue et par niveau.",
    },
    {
      kind: "number",
      name: "price",
      label: "Prix total (DH)",
      required: true,
      min: 1,
      step: 50,
      placeholder: "ex. 1200",
    },
    {
      kind: "date",
      name: "start_date",
      label: "Date de début",
      required: true,
    },
  ];

  function construirePayload(v: Record<string, unknown>) {
    return {
      etudiant_id: v.etudiant_id || null,
      langue_id: v.langue_id || null,
      niveau_ids: v.niveau_ids || [],
      price: v.price || null,
      start_date: v.start_date || "",
    };
  }

  const colonnes: Colonne<InscriptionRow>[] = [
    {
      key: "etudiant",
      header: "Étudiant",
      render: (r) => <span className="font-medium">{r.etudiant_name}</span>,
    },
    {
      key: "langue",
      header: "Langue · Niveaux",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <LangueChip nom={r.langue_name} couleur={couleurLangue(r.langue_name)} />
          <span className="chiffres font-mono text-[13px] font-semibold">
            {r.niveaux.map((n) => n.name).join(" + ")}
          </span>
        </div>
      ),
    },
    {
      key: "price",
      header: "Prix",
      render: (r) => (
        <span className="chiffres font-mono text-[13px] font-semibold">
          {fmtMontant(r.price)}
        </span>
      ),
    },
    {
      key: "debut",
      header: "Début",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{fmtDate(r.start_date)}</span>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      render: (r) =>
        r.expired_at ? (
          <StatusBadge tone="neutre">
            Expirée le {fmtDate(r.expired_at)}
          </StatusBadge>
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
          {!r.expired_at && peut("modifier") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-[var(--ambre-fonce)]"
              aria-label={`Marquer l'inscription de ${r.etudiant_name} comme expirée`}
              title="Marquer expirée"
              onClick={() => setExpiration(r)}
            >
              <Hourglass className="size-4" />
            </Button>
          )}
          {peut("modifier") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={`Modifier l'inscription de ${r.etudiant_name}`}
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
              aria-label={`Supprimer l'inscription de ${r.etudiant_name}`}
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
        title="Inscriptions"
        description="Chaque inscription relie un étudiant à une langue et à ses niveaux, avec son prix de départ."
        actions={
          <Button onClick={() => setDialog({ open: true, initial: null })}>
            <Plus className="size-4" />
            Ajouter une inscription
          </Button>
        }
      />

      <ListToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Rechercher par étudiant ou langue…"
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

      <DataTable<InscriptionRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<ClipboardList />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucune inscription ne correspond à cette recherche"
            : "Aucune inscription pour le moment"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Inscrivez un étudiant dans une langue pour ouvrir son parcours."
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
        labelPluriel="inscriptions"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier l'inscription" : "Ajouter une inscription"}
        description="Le système vérifie qu'aucune inscription active n'existe déjà pour cette langue et ces niveaux."
        endpoint="/api/inscriptions"
        champs={champs}
        buildPayload={construirePayload}
        submitLabel="Ajouter l'inscription"
        onSaved={list.refresh}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/inscriptions"
        description={
          aSupprimer
            ? `Supprimer l'inscription de ${aSupprimer.etudiant_name} en ${aSupprimer.langue_name} ? Les paiements déjà enregistrés seront conservés.`
            : ""
        }
        onDeleted={list.refresh}
      />

      {/* Dialogue d'expiration avec analyse des groupes liés */}
      <AlertDialog
        open={expiration !== null}
        onOpenChange={(open) => !open && fermerExpiration()}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto defile-doux sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Marquer l'inscription comme expirée
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {analyse
                    ? `Inscription de ${analyse.inscription.etudiant_name} en ${analyse.inscription.langue_name}.`
                    : "Analyse en cours…"}
                </p>

                {analyseEnCours && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Recherche des groupes concernés…
                  </p>
                )}

                {analyse && analyse.groupes_lies.length > 0 && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="mb-2 text-sm font-medium text-foreground">
                      {analyse.groupes_lies.length} groupe(s) actif(s) de la même
                      langue :
                    </p>
                    <ul className="space-y-1">
                      {analyse.groupes_lies.map((g) => (
                        <li
                          key={g._id}
                          className="chiffres flex items-center justify-between font-mono text-xs text-muted-foreground"
                        >
                          <span>{g.groupe_label}</span>
                          <span>début {fmtDate(g.start_date)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-start gap-2.5 border-t pt-3">
                      <Checkbox
                        id="terminer-groupes"
                        checked={terminerGroupes}
                        onCheckedChange={(v) => setTerminerGroupes(v === true)}
                      />
                      <Label
                        htmlFor="terminer-groupes"
                        className="cursor-pointer text-sm font-normal leading-snug text-foreground"
                      >
                        Terminer aussi ces relations de groupe (l'étudiant ne
                        restera pas dans ce(s) groupe(s))
                      </Label>
                    </div>
                  </div>
                )}

                {analyse && analyse.groupes_lies.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucun groupe actif de la même langue n'est concerné.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  L'inscription ne pourra plus être réactivée depuis cette
                  interface.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={expirationEnCours}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmerExpiration();
              }}
              disabled={expirationEnCours || analyseEnCours || !analyse}
              className="bg-[var(--ambre-fonce)] text-white hover:bg-[#6e4e0e]"
            >
              {expirationEnCours && <Loader2 className="size-4 animate-spin" />}
              Confirmer l'expiration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
