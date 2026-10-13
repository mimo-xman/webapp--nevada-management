import { cn } from "@/lib/utils";
import { couleurLangue } from "@/lib/format";

export type BadgeTone =
  | "pin"
  | "ambre"
  | "argile"
  | "neutre"
  | "prune";

const TONES: Record<BadgeTone, { bg: string; txt: string; dot: string }> = {
  pin: { bg: "bg-accent", txt: "text-accent-foreground", dot: "bg-primary" },
  ambre: {
    bg: "bg-[var(--ambre-doux)]",
    txt: "text-[var(--ambre-fonce)]",
    dot: "bg-[#b98a1f]",
  },
  argile: {
    bg: "bg-[var(--argile-doux)]",
    txt: "text-[#8a3c1e]",
    dot: "bg-[var(--argile)]",
  },
  neutre: { bg: "bg-muted", txt: "text-muted-foreground", dot: "bg-muted-foreground/60" },
  prune: { bg: "bg-[#efe7f8]", txt: "text-[#5f3d99]", dot: "bg-[#7c5cb0]" },
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        t.bg,
        t.txt,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Puce colorée d'une langue (couleur déterministe par nom). */
export function LangueChip({
  nom,
  couleur,
  className,
}: {
  nom: string;
  couleur?: string | null;
  className?: string;
}) {
  const c = couleur || couleurLangue(nom);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      style={{ borderColor: `${c}55`, color: c, backgroundColor: `${c}14` }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: c }}
        aria-hidden="true"
      />
      {nom}
    </span>
  );
}
