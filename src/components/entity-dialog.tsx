"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Spécification des champs                                            */
/* ------------------------------------------------------------------ */

export interface OptionItem {
  value: string;
  label: string;
}

interface ChampBase {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  pleineLargeur?: boolean;
}

export type ChampSpec =
  | (ChampBase & {
      kind: "text" | "email" | "tel" | "password";
    })
  | (ChampBase & { kind: "number"; min?: number; step?: number })
  | (ChampBase & { kind: "date" })
  | (ChampBase & { kind: "textarea"; rows?: number })
  | (ChampBase & {
      kind: "select";
      options: OptionItem[];
      optionnementChargement?: boolean;
    })
  | (ChampBase & { kind: "multiselect"; options: OptionItem[] });

export type Valeurs = Record<string, string | number | string[]>;

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = création ; objet = modification */
  initial: Record<string, unknown> | null;
  title: string;
  description?: string;
  submitLabel?: string;
  champs: ChampSpec[];
  /** Endpoint de création : POST */
  endpoint: string;
  /** Construit le corps de la requête depuis les valeurs du formulaire. */
  buildPayload?: (valeurs: Valeurs) => unknown;
  /** Valeurs par défaut à la création (ex. date du jour). */
  valeursParDefaut?: Record<string, string>;
  onSaved: () => void;
}

function valeurInitiale(
  champ: ChampSpec,
  initial: Record<string, unknown> | null,
  defaut?: Record<string, string>
): string | string[] {
  if (!initial) {
    const d = defaut?.[champ.name];
    if (d !== undefined) return d;
    if (champ.kind === "multiselect") return [];
    return "";
  }
  const v = initial[champ.name];
  if (champ.kind === "multiselect") {
    if (Array.isArray(v)) {
      return v.map((x) =>
        typeof x === "object" && x !== null && "id" in (x as Record<string, unknown>)
          ? String((x as Record<string, unknown>).id)
          : String(x)
      );
    }
    return [];
  }
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Dialogue générique de création / modification, utilisé par toutes
 * les entités. Les règles métier complexes sont validées côté serveur
 * (messages d'erreur affichés en toast).
 */
export function EntityDialog({
  open,
  onOpenChange,
  initial,
  title,
  description,
  submitLabel,
  champs,
  endpoint,
  buildPayload,
  valeursParDefaut,
  onSaved,
}: EntityDialogProps) {
  const construire = buildPayload ?? ((v: Valeurs) => v);
  const [valeurs, setValeurs] = useState<Valeurs>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const estModification = initial !== null;

  useEffect(() => {
    if (!open) return;
    setErreur(null);
    const v: Valeurs = {};
    for (const c of champs) {
      v[c.name] = valeurInitiale(c, initial, valeursParDefaut);
    }
    setValeurs(v);
  }, [open, initial]);

  const champsCharges = useMemo(
    () =>
      champs.every(
        (c) =>
          !(c.kind === "select" || c.kind === "multiselect") ||
          !c.optionnementChargement ||
          c.options.length > 0
      ),
    [champs]
  );

  function setValeur(name: string, value: string | number | string[]) {
    setValeurs((v) => ({ ...v, [name]: value }));
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    // Validation minimale côté client (le serveur refait tout).
    for (const c of champs) {
      if (!c.required) continue;
      const v = valeurs[c.name];
      if (
        v === "" ||
        v === undefined ||
        (Array.isArray(v) && v.length === 0)
      ) {
        setErreur(`Le champ « ${c.label} » est obligatoire.`);
        return;
      }
    }

    setEnvoi(true);
    try {
      if (estModification) {
        await api(`${endpoint}/${String(initial!._id)}`, {
          method: "PATCH",
          body: JSON.stringify(construire(valeurs)),
        });
        toast.success("Modifications enregistrées.");
      } else {
        await api(endpoint, {
          method: "POST",
          body: JSON.stringify(construire(valeurs)),
        });
        toast.success(
          submitLabel ? `${submitLabel.replace(/^Ajouter /, "")} ajouté` : "Élément créé."
        );
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setErreur(message);
      toast.error(message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto defile-doux sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={soumettre} className="grid gap-4" noValidate>
          {!champsCharges && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement des options…
            </div>
          )}

          {champsCharges && (
            <div className="grid gap-4 sm:grid-cols-2">
              {champs.map((c) => {
                const valeur = valeurs[c.name];
                const id = `champ-${c.name}`;
                return (
                  <div
                    key={c.name}
                    className={cn(
                      "grid gap-1.5",
                      (c.pleineLargeur ||
                        c.kind === "textarea" ||
                        c.kind === "multiselect") &&
                        "sm:col-span-2"
                    )}
                  >
                    <Label htmlFor={id} className="text-[13px]">
                      {c.label}
                      {c.required && (
                        <span className="text-argile" aria-hidden="true">
                          {" "}
                          *
                        </span>
                      )}
                    </Label>

                    {(c.kind === "text" ||
                      c.kind === "email" ||
                      c.kind === "tel") && (
                      <Input
                        id={id}
                        type={c.kind === "text" ? "text" : c.kind}
                        value={String(valeur ?? "")}
                        onChange={(e) => setValeur(c.name, e.target.value)}
                        placeholder={c.placeholder}
                        autoComplete="off"
                        className={c.name === "cin" || c.name === "phone" ? "font-mono" : ""}
                      />
                    )}

                    {c.kind === "password" && (
                      <Input
                        id={id}
                        type="password"
                        value={String(valeur ?? "")}
                        onChange={(e) => setValeur(c.name, e.target.value)}
                        placeholder={c.placeholder}
                        autoComplete="new-password"
                      />
                    )}

                    {c.kind === "number" && (
                      <Input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={c.min}
                        step={c.step}
                        value={String(valeur ?? "")}
                        onChange={(e) => setValeur(c.name, e.target.value)}
                        placeholder={c.placeholder}
                        className="font-mono"
                      />
                    )}

                    {c.kind === "date" && (
                      <Input
                        id={id}
                        type="date"
                        value={String(valeur ?? "")}
                        onChange={(e) => setValeur(c.name, e.target.value)}
                        className="font-mono"
                      />
                    )}

                    {c.kind === "textarea" && (
                      <Textarea
                        id={id}
                        rows={c.rows ?? 3}
                        value={String(valeur ?? "")}
                        onChange={(e) => setValeur(c.name, e.target.value)}
                        placeholder={c.placeholder}
                      />
                    )}

                    {c.kind === "select" && (
                      <Select
                        value={String(valeur ?? "")}
                        onValueChange={(v) => setValeur(c.name, v)}
                      >
                        <SelectTrigger id={id} className="w-full">
                          <SelectValue placeholder={c.placeholder || "Sélectionner…"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {c.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {c.kind === "multiselect" && (
                      <div
                        className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3"
                        role="group"
                        aria-label={c.label}
                      >
                        {c.options.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            Aucune option disponible.
                          </span>
                        )}
                        {c.options.map((o) => {
                          const actif = Array.isArray(valeur) && valeur.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              aria-pressed={actif}
                              onClick={() => {
                                const arr = Array.isArray(valeur) ? [...valeur] : [];
                                if (actif) {
                                  setValeur(
                                    c.name,
                                    arr.filter((x) => x !== o.value)
                                  );
                                } else {
                                  arr.push(o.value);
                                  setValeur(c.name, arr);
                                }
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                actif
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-foreground hover:bg-accent"
                              )}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {c.hint && (
                      <p className="text-xs text-muted-foreground">{c.hint}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {erreur && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--argile)]/40 bg-[var(--argile-doux)] px-3 py-2 text-sm text-[#8a3c1e]"
            >
              {erreur}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={envoi}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={envoi || !champsCharges}>
              {envoi && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {estModification ? "Enregistrer" : submitLabel || "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
