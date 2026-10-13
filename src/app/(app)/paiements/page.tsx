"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ReceiptText,
  SquarePen,
  Trash2,
  Plus,
  Loader2,
  CalendarPlus,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable, type Colonne } from "@/components/data-table";
import { ListToolbar, type FiltreDef, type TriOption } from "@/components/list-toolbar";
import { PaginationBar } from "@/components/pagination-bar";
import { EntityDialog, type ChampSpec } from "@/components/entity-dialog";
import { ConfirmSuppression } from "@/components/confirm-suppression";
import { StatusBadge, LangueChip } from "@/components/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useListQuery } from "@/hooks/use-list-query";
import { useOptions } from "@/hooks/use-options";
import { useRole } from "@/components/role-context";
import { api } from "@/lib/api-client";
import { couleurLangue, fmtDate, fmtMontant, todayStr } from "@/lib/format";
import { STATUT_PAIEMENT_LABELS } from "@/lib/permissions";
import type { StatutPaiement } from "@/lib/types";

interface PaiementRow {
  _id: string;
  inscription_id: string;
  etudiant_name: string;
  langue_name: string;
  date: string;
  status: StatutPaiement;
  montant: number;
}

interface AnalysePaiements {
  date: string;
  total: number;
  candidats: {
    inscription_id: string;
    etudiant_name: string;
    langue_name: string;
    montant: number;
  }[];
}

const TRIS: TriOption[] = [
  { value: "etudiant_name", label: "Étudiant" },
  { value: "langue_name", label: "Langue" },
  { value: "date", label: "Date" },
  { value: "montant", label: "Montant" },
  { value: "status", label: "Statut" },
];

const TONE: Record<StatutPaiement, "ambre" | "pin" | "argile"> = {
  en_attente: "ambre",
  payer: "pin",
  annuler: "argile",
};

export default function PagePaiements() {
  const list = useListQuery<PaiementRow>("/api/paiements", {
    defaultSort: "date",
    defaultDir: "desc",
  });
  const { peut } = useRole();
  const { options: langues } = useOptions("langues");
  const { options: inscriptions, chargement: inscriptionsChargement } =
    useOptions("inscriptions_actives");

  const [dialog, setDialog] = useState<{ open: boolean; initial: PaiementRow | null }>({
    open: false,
    initial: null,
  });
  const [aSupprimer, setASupprimer] = useState<PaiementRow | null>(null);

  // Analyse des paiements du jour
  const [analyseOuverte, setAnalyseOuverte] = useState(false);
  const [analyse, setAnalyse] = useState<AnalysePaiements | null>(null);
  const [analyseChargement, setAnalyseChargement] = useState(false);
  const [generation, setGeneration] = useState(false);

  // Le dialog d'ajout propose la date du jour par défaut.
  const [dateParDefaut] = useState(() => todayStr());

  async function ouvrirAnalyse() {
    setAnalyseOuverte(true);
    setAnalyseChargement(true);
    try {
      setAnalyse(await api<AnalysePaiements>("/api/paiements/generer"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
      setAnalyseOuverte(false);
    } finally {
      setAnalyseChargement(false);
    }
  }

  async function generer() {
    setGeneration(true);
    try {
      const res = await api<{ creees: number }>("/api/paiements/generer", {
        method: "POST",
      });
      if (res.creees === 0) {
        toast.info("Aucun paiement à créer aujourd'hui.");
      } else {
        toast.success(
          `${res.creees} paiement${res.creees > 1 ? "s" : ""} créé${res.creees > 1 ? "s" : ""} avec le statut « En attente ».`
        );
      }
      setAnalyseOuverte(false);
      list.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setGeneration(false);
    }
  }

  async function marquerPaye(r: PaiementRow) {
    try {
      await api(`/api/paiements/${r._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "payer", date: r.date }),
      });
      toast.success(`Paiement de ${r.etudiant_name} marqué payé.`);
      list.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  const filtres: FiltreDef[] = [
    {
      key: "status",
      placeholder: "Tous les statuts",
      options: [
        { value: "en_attente", label: "En attente" },
        { value: "payer", label: "Payés" },
        { value: "annuler", label: "Annulés" },
      ],
    },
    { key: "langue_id", placeholder: "Toutes les langues", options: langues },
  ];

  const champs: ChampSpec[] = [
    {
      kind: "select",
      name: "inscription_id",
      label: "Inscription",
      required: true,
      options: inscriptions,
      optionnementChargement: true,
      pleineLargeur: true,
      hint:
        dialog.initial || inscriptionsChargement
          ? undefined
          : "Seules les inscriptions actives commencées sont proposées.",
    },
    {
      kind: "date",
      name: "date",
      label: "Date du paiement",
      required: true,
      hint: "Règle du centre : un seul paiement par inscription et par date.",
    },
    {
      kind: "select",
      name: "status",
      label: "Statut",
      required: true,
      options: [
        { value: "en_attente", label: "En attente" },
        { value: "payer", label: "Payé" },
        { value: "annuler", label: "Annulé" },
      ],
    },
    {
      kind: "number",
      name: "montant",
      label: "Montant (DH)",
      min: 1,
      step: 50,
      hint: "Vide = le prix de l'inscription est repris.",
    },
  ];

  function construirePayload(v: Record<string, unknown>) {
    return {
      inscription_id: v.inscription_id || null,
      date: v.date || "",
      status: v.status || "en_attente",
      montant: v.montant === "" || v.montant === undefined ? null : v.montant,
    };
  }

  const colonnes: Colonne<PaiementRow>[] = [
    {
      key: "etudiant",
      header: "Étudiant",
      render: (r) => <span className="font-medium">{r.etudiant_name}</span>,
    },
    {
      key: "langue",
      header: "Langue",
      render: (r) => (
        <LangueChip nom={r.langue_name} couleur={couleurLangue(r.langue_name)} />
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{fmtDate(r.date)}</span>
      ),
    },
    {
      key: "montant",
      header: "Montant",
      render: (r) => (
        <span className="chiffres font-mono text-[13px] font-semibold">
          {fmtMontant(r.montant)}
        </span>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      render: (r) => (
        <StatusBadge tone={TONE[r.status]}>
          {STATUT_PAIEMENT_LABELS[r.status]}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      headClassName: "text-right w-px",
      className: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === "en_attente" && peut("modifier") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary"
              aria-label={`Marquer le paiement de ${r.etudiant_name} comme payé`}
              title="Marquer payé"
              onClick={() => marquerPaye(r)}
            >
              <Check className="size-4" />
            </Button>
          )}
          {peut("modifier") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={`Modifier le paiement de ${r.etudiant_name}`}
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
              aria-label={`Supprimer le paiement de ${r.etudiant_name}`}
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
        eyebrow="Finances"
        title="Paiements"
        description="Suivi des encaissements inscription par inscription, jour par jour."
        actions={
          <>
            <Button variant="outline" className="bg-card" onClick={() => setDialog({ open: true, initial: null })}>
              <Plus className="size-4" />
              Ajouter un paiement
            </Button>
            <Button onClick={ouvrirAnalyse}>
              <CalendarPlus className="size-4" />
              Générer les paiements du jour
            </Button>
          </>
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

      <DataTable<PaiementRow>
        columns={colonnes}
        rows={list.rows}
        loading={list.loading}
        rowKey={(r) => r._id}
        emptyIcon={<ReceiptText />}
        emptyTitle={
          list.q || list.filtresActifs > 0
            ? "Aucun paiement ne correspond à cette recherche"
            : "Aucun paiement pour le moment"
        }
        emptyDescription={
          list.q || list.filtresActifs > 0
            ? "Ajustez la recherche ou réinitialisez les filtres."
            : "Générez les paiements du jour ou ajoutez-les manuellement."
        }
        emptyAction={
          <div className="flex gap-2">
            <Button variant="outline" onClick={list.reset} className="bg-card">
              Réinitialiser les filtres
            </Button>
            <Button onClick={ouvrirAnalyse}>
              <CalendarPlus className="size-4" />
              Générer les paiements du jour
            </Button>
          </div>
        }
      />

      <PaginationBar
        total={list.total}
        page={list.page}
        limit={list.limit}
        totalPages={list.totalPages}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
        labelPluriel="paiements"
        loading={list.loading}
      />

      <EntityDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, initial: null })}
        initial={dialog.initial}
        title={dialog.initial ? "Modifier le paiement" : "Ajouter un paiement"}
        endpoint="/api/paiements"
        champs={champs}
        buildPayload={construirePayload}
        submitLabel="Ajouter le paiement"
        valeursParDefaut={{ date: dateParDefaut, status: "en_attente" }}
        onSaved={list.refresh}
        key={`${dialog.open}-${dialog.initial?._id ?? "nouveau"}`}
      />

      <ConfirmSuppression
        element={aSupprimer}
        onOpenChange={(open) => !open && setASupprimer(null)}
        endpoint="/api/paiements"
        description={
          aSupprimer
            ? `Supprimer le paiement de ${aSupprimer.etudiant_name} (${fmtMontant(aSupprimer.montant)}, le ${fmtDate(aSupprimer.date)}) ?`
            : ""
        }
        onDeleted={list.refresh}
      />

      {/* Dialogue d'analyse des paiements du jour */}
      <Dialog open={analyseOuverte} onOpenChange={setAnalyseOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Paiements du jour — analyse
            </DialogTitle>
            <DialogDescription>
              Le système recherche les inscriptions actives commencées
              aujourd'hui qui n'ont pas encore de paiement à cette date.
            </DialogDescription>
          </DialogHeader>

          {analyseChargement ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Analyse en cours…
            </div>
          ) : analyse && analyse.candidats.length > 0 ? (
            <div className="max-h-64 overflow-y-auto defile-doux rounded-lg border">
              <ul className="divide-y">
                {analyse.candidats.map((c) => (
                  <li
                    key={c.inscription_id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.etudiant_name}</p>
                      <p className="text-xs text-muted-foreground">{c.langue_name}</p>
                    </div>
                    <span className="chiffres font-mono text-sm font-semibold">
                      {fmtMontant(c.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 px-4 py-6 text-center">
              <p className="text-sm font-medium">
                Aucun paiement à générer aujourd'hui.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Toutes les inscriptions commencées le {fmtDate(analyse?.date ?? todayStr())} ont
                déjà leur paiement.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyseOuverte(false)}>
              Fermer
            </Button>
            {analyse && analyse.candidats.length > 0 && (
              <Button onClick={generer} disabled={generation}>
                {generation && <Loader2 className="size-4 animate-spin" />}
                Créer {analyse.candidats.length} paiement
                {analyse.candidats.length > 1 ? "s" : ""} en attente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
