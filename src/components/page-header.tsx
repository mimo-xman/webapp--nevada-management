"use client";

import { cn } from "@/lib/utils";

/**
 * En-tête de page standard : souris mono (section du système),
 * titre Bricolage, description et actions à droite.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
