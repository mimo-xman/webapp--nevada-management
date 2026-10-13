"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { RubanDesLangues } from "@/components/ruban-des-langues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { Role } from "@/lib/types";

const COMPTES_DEMO: { role: Role; identifiant: string; motDePasse: string }[] = [
  { role: "admin", identifiant: "admin", motDePasse: "admin123" },
  { role: "manager", identifiant: "manager", motDePasse: "manager123" },
  { role: "assistant", identifiant: "assistant", motDePasse: "assistant123" },
];

export function FormulaireConnexion() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: identifiant, password: motDePasse }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur inconnue.");
      setEnvoi(false);
    }
  }

  function remplir(role: Role) {
    const compte = COMPTES_DEMO.find((c) => c.role === role);
    if (compte) {
      setIdentifiant(compte.identifiant);
      setMotDePasse(compte.motDePasse);
      setErreur(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau identitaire : ardoise + ruban des langues */}
      <section className="relative hidden min-w-0 flex-col justify-between overflow-hidden bg-ardoise p-10 text-ardoise-texte lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 items-center justify-center rounded-xl bg-sidebar-primary font-display text-xl font-extrabold text-sidebar-primary-foreground"
              aria-hidden="true"
            >
              N
            </span>
            <div className="leading-tight">
              <p className="font-display text-xl font-bold">Nevada</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ardoise-texte-doux">
                Centre de langues
              </p>
            </div>
          </div>

          <h1 className="mt-16 max-w-lg font-display text-[42px] font-bold leading-[1.08] tracking-tight">
            Toute la vie du centre,
            <br />
            <span className="text-[#5cb894]">dans un seul cahier.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ardoise-texte/75">
            Étudiants, professeurs, groupes, inscriptions et paiements :
            suivez chaque inscription de sa première classe à son dernier
            paiement, sans perdre le fil.
          </p>
        </div>

        <div>
          <RubanDesLangues teinte="sombre" />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ardoise-texte-doux">
            5 langues enseignées · Suivi pédagogique & financier
          </p>
        </div>
      </section>

      {/* Formulaire */}
      <section className="flex min-w-0 items-center justify-center bg-background px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span
              className="flex size-10 items-center justify-center rounded-xl bg-ardoise font-display text-lg font-extrabold text-[#5cb894]"
              aria-hidden="true"
            >
              N
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-bold">Nevada</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Centre de langues
              </p>
            </div>
          </div>

          <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
            Espace personnel
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Connexion
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Accédez à la gestion du centre avec votre compte.
          </p>

          <form onSubmit={seConnecter} className="mt-7 grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="identifiant">Identifiant</Label>
              <Input
                id="identifiant"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="ex. admin"
                autoComplete="username"
                autoFocus
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="motdepasse">Mot de passe</Label>
              <Input
                id="motdepasse"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            {erreur && (
              <p
                role="alert"
                className="rounded-lg border border-[var(--argile)]/40 bg-[var(--argile-doux)] px-3 py-2 text-sm text-[#8a3c1e]"
              >
                {erreur}
              </p>
            )}

            <Button type="submit" size="lg" disabled={envoi} className="mt-1">
              {envoi ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {envoi ? "Connexion en cours…" : "Se connecter"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Comptes de démonstration
            </p>
            <ul className="grid gap-2">
              {COMPTES_DEMO.map((c) => (
                <li key={c.role}>
                  <button
                    type="button"
                    onClick={() => remplir(c.role)}
                    className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {ROLE_LABELS[c.role]}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.identifiant} / {c.motDePasse}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[c.role]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
