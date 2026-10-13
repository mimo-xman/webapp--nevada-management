"use client";

import { cn } from "@/lib/utils";

const GLYPHES = [
  "Aa", "Àà", "Ââ", "Çç", "Éé", "Èè", "Ññ", "Œœ", "Ùù",
  "Бб", "Яя", "Жж", "Фф",
  "ع", "ح", "خ", "ش",
  "中", "文", "你好",
  "Ωω", "Δδ", "Ψψ", "Λλ",
  "ẞß", "Üü", "Öö", "Ää",
  "ã", "õ", "ç",
  "؛", "؟",
  "Ёё", "Йй", "Цц", "Щщ",
  "Ḑḑ", "Łł", "Øø", "Ææ",
  "«»", "„”", "¡!", "¿?",
];

/**
 * Signature visuelle du centre : un ruban de glyphes issus des
 * alphabets du monde, qui défile lentement (marquee). Respecte
 * prefers-reduced-motion (défilement figé).
 */
export function RubanDesLangues({
  className,
  teinte = "sombre",
}: {
  className?: string;
  teinte?: "sombre" | "clair";
}) {
  const texte = teinte === "sombre" ? "text-ardoise-texte-doux" : "text-muted-foreground";
  const bordure = teinte === "sombre" ? "border-ardoise-bord" : "border-border";

  const demiPiste = GLYPHES.map((g, i) => (
    <span key={i} className={cn("ruban-glyphe px-3 text-sm tracking-[0.2em]", texte)}>
      {g}
    </span>
  ));

  return (
    <div
      className={cn("relative overflow-hidden border-y py-2 select-none", bordure)}
      role="presentation"
    >
      <div className="ruban-piste">
        {demiPiste}
        {demiPiste}
      </div>
    </div>
  );
}
