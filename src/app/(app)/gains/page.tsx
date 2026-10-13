"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, TrendingUp, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LangueChip } from "@/components/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Colonne } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useRole } from "@/components/role-context";
import { useRouter } from "next/navigation";
import { fmtMontant, fmtNombre } from "@/lib/format";

interface GainsData {
  annee: number;
  totaux: {
    payer: number;
    en_attente: number;
    annuler: number;
    nb_payes: number;
  };
  parMois: { mois: string; paye: number; attente: number; annule: number }[];
  parLangue: {
    langue_id: string;
    langue_name: string;
    payer: number;
    en_attente: number;
    annuler: number;
    nb_payes: number;
  }[];
  langues: { _id: string; name: string }[];
}

interface GainsRow {
  langue_id: string;
  langue_name: string;
  payer: number;
  en_attente: number;
  annuler: number;
  nb_payes: number;
}

const ANNEES = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i);

export default function PageGains() {
  const { user } = useRole();
  const router = useRouter();

  // Garde côté client : la page est réservée au manager et à l'admin.
  useEffect(() => {
    if (user.role === "assistant") router.replace("/dashboard");
  }, [user.role, router]);

  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [langueId, setLangueId] = useState("");
  const [data, setData] = useState<GainsData | null>(null);
  const [cleCharge, setCleCharge] = useState<string | null>(null);

  const cle = `${annee}|${langueId}`;

  useEffect(() => {
    let annule = false;
    const params = new URLSearchParams({ annee: String(annee) });
    if (langueId) params.set("langue_id", langueId);
    api<GainsData>(`/api/gains?${params.toString()}`)
      .then((res) => {
        if (!annule) {
          setData(res);
          setCleCharge(cle);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        if (!annule) {
          setData(null);
          setCleCharge(cle);
        }
      });
    return () => {
      annule = true;
    };
  }, [annee, langueId, cle]);

  const chargement = cleCharge !== cle;

  const maxMois = useMemo(
    () => Math.max(1, ...(data?.parMois.map((m) => m.paye) ?? [1])),
    [data]
  );

  const colonnes: Colonne<GainsRow>[] = [
    {
      key: "langue",
      header: "Langue",
      render: (r) => <LangueChip nom={r.langue_name} />,
    },
    {
      key: "payer",
      header: "Encaissé",
      render: (r) => (
        <span className="chiffres font-mono text-[13px] font-semibold text-primary">
          {fmtMontant(r.payer)}
        </span>
      ),
    },
    {
      key: "attente",
      header: "En attente",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">
          {fmtMontant(r.en_attente)}
        </span>
      ),
    },
    {
      key: "annuler",
      header: "Annulé",
      render: (r) => (
        <span className="chiffres font-mono text-[13px] text-muted-foreground">
          {fmtMontant(r.annuler)}
        </span>
      ),
    },
    {
      key: "nb",
      header: "Paiements payés",
      render: (r) => (
        <span className="chiffres font-mono text-[13px]">{fmtNombre(r.nb_payes)}</span>
      ),
    },
  ];

  const cartes = [
    {
      label: "Encaissé",
      valeur: data ? fmtMontant(data.totaux.payer) : undefined,
      note: `${fmtNombre(data?.totaux.nb_payes ?? 0)} paiement(s) payé(s)`,
      icone: TrendingUp,
      couleur: "text-primary",
    },
    {
      label: "En attente",
      valeur: data ? fmtMontant(data.totaux.en_attente) : undefined,
      note: "Paiements à recouvrer",
      icone: Clock,
      couleur: "text-[var(--ambre-fonce)]",
    },
    {
      label: "Annulé",
      valeur: data ? fmtMontant(data.totaux.annuler) : undefined,
      note: "Paiements annulés",
      icone: XCircle,
      couleur: "text-muted-foreground",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Finances"
        title="Gains"
        description="Synthèse des encaissements de l'année : montants payés, en attente et annulés."
        actions={
          <>
            <Select
              value={langueId || "all"}
              onValueChange={(v) => setLangueId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-44 bg-card" aria-label="Filtrer par langue">
                <SelectValue placeholder="Toutes les langues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les langues</SelectItem>
                {data?.langues.map((l) => (
                  <SelectItem key={l._id} value={l._id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(annee)}
              onValueChange={(v) => setAnnee(Number(v))}
            >
              <SelectTrigger className="w-28 bg-card" aria-label="Choisir l'année">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNEES.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Cartes de synthèse */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cartes.map((c) => {
          const Icone = c.icone;
          return (
            <Card key={c.label} className="gap-2 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex w-full flex-row items-center justify-between space-y-0">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {c.label} · {annee}
                  </span>
                  <Icone className={`size-4.5 ${c.couleur}`} aria-hidden="true" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                {chargement ? (
                  <Skeleton className="h-9 w-32" />
                ) : (
                  <p className="chiffres font-display text-3xl font-bold tracking-tight">
                    {c.valeur}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Graphique mensuel */}
      <Card className="mt-6 py-5">
        <CardHeader className="px-5">
          <CardTitle className="flex w-full items-center justify-between space-y-0">
            <span className="flex items-center gap-2 font-display text-base font-semibold">
              <Wallet className="size-4 text-primary" />
              Encaissements mois par mois
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Statut « Payé » uniquement
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          {chargement ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <div className="flex h-44 items-end gap-1.5 sm:gap-2">
              {data?.parMois.map((m) => (
                <div
                  key={m.mois}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${m.mois} : ${fmtMontant(m.paye)} encaissé, ${fmtMontant(m.attente)} en attente`}
                >
                  <span className="chiffres font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {m.paye > 0 ? fmtNombre(m.paye) : ""}
                  </span>
                  <div
                    className="w-full max-w-10 rounded-t-md bg-primary/85 transition-colors group-hover:bg-primary"
                    style={{
                      height: `${Math.max(1.5, (m.paye / maxMois) * 100)}%`,
                      minHeight: m.paye > 0 ? 6 : 3,
                    }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {m.mois.slice(5, 7)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Répartition par langue */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">
          Répartition par langue
        </h2>
        <DataTable<GainsRow>
          columns={colonnes}
          rows={data?.parLangue ?? []}
          loading={chargement}
          rowKey={(r) => r.langue_id}
          emptyIcon={<Wallet />}
          emptyTitle="Aucun paiement cette année"
          emptyDescription="Les paiements enregistrés apparaîtront ici, regroupés par langue."
        />
      </div>
    </div>
  );
}
