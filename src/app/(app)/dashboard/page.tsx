"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Boxes,
  Wallet,
  ArrowRight,
  ClipboardList,
  ScrollText,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RubanDesLangues } from "@/components/ruban-des-langues";
import { StatusBadge, LangueChip } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useRole } from "@/components/role-context";
import { ACTION_LABELS } from "@/lib/labels";
import { fmtMontant, fmtDate, fmtDateTime, fmtNombre } from "@/lib/format";
import type { AuditAction } from "@/lib/types";

interface DashboardData {
  aujourdhui: string;
  stats: {
    etudiants_actifs: number;
    inscriptions_actives: number;
    profs: number;
    groupes_actifs: number;
    langues: number;
    encaisse_mois: number;
    en_attente: number;
    paiements_jour: number;
  };
  parMois: { mois: string; label: string; total: number }[];
  dernieresInscriptions: {
    _id: string;
    etudiant_name: string;
    langue_name: string;
    niveaux: string[];
    price: number;
    start_date: string;
    expired_at: string | null;
  }[];
  derniersAudits: {
    _id: string;
    username: string;
    action: AuditAction;
    details: string;
    created_at: string;
  }[];
}

const TONE_AUDIT: Record<AuditAction, "pin" | "ambre" | "argile" | "neutre"> = {
  creer: "pin",
  modifier: "ambre",
  supprimer: "argile",
  connexion: "neutre",
};

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function dateDuJour(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

const abonnementVide = () => () => {};

/**
 * Vrai une fois l'hydratation terminée : permet d'afficher la date et la
 * salutation calculées côté client sans créer d'écart de rendu serveur/client.
 */
function useHydrate(): boolean {
  return useSyncExternalStore(
    abonnementVide,
    () => true,
    () => false
  );
}

export default function PageTableauDeBord() {
  const { user } = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [chargement, setChargement] = useState(true);
  const monte = useHydrate();
  const salut = monte ? salutation() : "Bonjour";
  const labelDate = monte
    ? dateDuJour()
    : "Centre de langues Nevada";

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setChargement(false));
  }, []);

  const maxMois = Math.max(1, ...(data?.parMois.map((m) => m.total) ?? [1]));

  const cartes = [
    {
      label: "Étudiants actifs",
      valeur: data?.stats.etudiants_actifs,
      icone: Users,
      note: `${fmtNombre(data?.stats.inscriptions_actives ?? 0)} inscription(s) active(s)`,
    },
    {
      label: "Professeurs",
      valeur: data?.stats.profs,
      icone: GraduationCap,
      note: `${fmtNombre(data?.stats.langues ?? 0)} langue(s) enseignée(s)`,
    },
    {
      label: "Groupes actifs",
      valeur: data?.stats.groupes_actifs,
      icone: Boxes,
      note: "Sessions en cours",
    },
    {
      label: "Encaissé ce mois",
      valeur: data ? fmtMontant(data.stats.encaisse_mois) : undefined,
      icone: Wallet,
      note: `${fmtMontant(data?.stats.en_attente ?? 0)} en attente`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={labelDate || "Centre de langues Nevada"}
        title={`${salut}, ${user.username}.`}
        description="Voici l'état du centre aujourd'hui : effectifs, pédagogie et finances."
        actions={
          <Button asChild variant="outline" className="bg-card">
            <Link href="/paiements">
              <CalendarClock className="size-4" />
              Paiements du jour
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground">
                {data?.stats.paiements_jour ?? "…"}
              </span>
            </Link>
          </Button>
        }
      />

      <RubanDesLangues teinte="clair" className="mb-6 rounded-lg" />

      {/* Indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartes.map((c) => {
          const Icone = c.icone;
          return (
            <Card key={c.label} className="gap-2 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex w-full flex-row items-center justify-between space-y-0">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {c.label}
                  </span>
                  <Icone className="size-4.5 text-primary" aria-hidden="true" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                {chargement ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <p className="chiffres font-display text-3xl font-bold tracking-tight">
                    {typeof c.valeur === "number" ? fmtNombre(c.valeur) : c.valeur}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Graphique encaissements */}
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex w-full flex-row items-center justify-between space-y-0">
              <span className="font-display text-base font-semibold">
                Encaissements — 6 derniers mois
              </span>
              <Link
                href="/gains"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Page Gains
                <ArrowRight className="size-3.5" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {chargement ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="flex h-40 items-end gap-2">
                {data?.parMois.map((m) => (
                  <div
                    key={m.mois}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${m.label} : ${fmtMontant(m.total)}`}
                  >
                    <span className="chiffres font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {fmtNombre(m.total)}
                    </span>
                    <div
                      className="w-full max-w-9 rounded-t-md bg-primary/85 transition-colors group-hover:bg-primary"
                      style={{
                        height: `${Math.max(2, (m.total / maxMois) * 100)}%`,
                        minHeight: m.total > 0 ? 6 : 3,
                      }}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {m.label.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dernières inscriptions */}
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex w-full flex-row items-center justify-between space-y-0">
              <span className="font-display text-base font-semibold">
                Dernières inscriptions
              </span>
              <Link
                href="/inscriptions"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Tout voir
                <ArrowRight className="size-3.5" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {chargement ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : data && data.dernieresInscriptions.length > 0 ? (
              <ul className="divide-y">
                {data.dernieresInscriptions.map((i) => (
                  <li key={i._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {i.etudiant_name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LangueChip nom={i.langue_name} className="scale-90" />
                        <span className="chiffres font-mono">
                          {i.niveaux.join(" + ")}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="chiffres font-mono text-sm font-semibold">
                        {fmtMontant(i.price)}
                      </p>
                      <StatusBadge
                        tone={i.expired_at ? "neutre" : "pin"}
                        className="mt-1 scale-90"
                      >
                        {i.expired_at ? "Expirée" : "Active"}
                      </StatusBadge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune inscription enregistrée.{" "}
                <Link href="/inscriptions" className="text-primary hover:underline">
                  Créer la première
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Derniers audits (admin) */}
      {user.role === "admin" && (
        <Card className="mt-6 py-5">
          <CardHeader className="px-5">
            <CardTitle className="flex w-full flex-row items-center justify-between space-y-0">
              <span className="flex items-center gap-2 font-display text-base font-semibold">
                <ScrollText className="size-4 text-primary" />
                Dernières activités
              </span>
              <Link
                href="/audits"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Journal complet
                <ArrowRight className="size-3.5" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {chargement ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data && data.derniersAudits.length > 0 ? (
              <ul className="divide-y">
                {data.derniersAudits.map((a) => (
                  <li key={a._id} className="flex items-center gap-3 py-2.5">
                    <StatusBadge tone={TONE_AUDIT[a.action]} className="shrink-0">
                      {ACTION_LABELS[a.action]}
                    </StatusBadge>
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{a.username}</span>{" "}
                      — {a.details}
                    </p>
                    <time className="chiffres shrink-0 font-mono text-xs text-muted-foreground">
                      {fmtDateTime(a.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                <ClipboardList className="mx-auto mb-2 size-5 opacity-50" />
                Aucune activité enregistrée pour le moment.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Note de bas de page pour le contexte */}
      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {fmtDate(data?.aujourdhui)} · Centre de langues Nevada
      </p>
    </div>
  );
}
