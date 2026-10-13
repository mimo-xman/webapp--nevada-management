"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Languages,
  Layers,
  Boxes,
  ClipboardList,
  UsersRound,
  ReceiptText,
  Wallet,
  ScrollText,
  UserCog,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleProvider, useRole } from "@/components/role-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: "Pilotage",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    ],
  },
  {
    section: "Pédagogie",
    items: [
      { href: "/etudiants", label: "Étudiants", icon: Users },
      { href: "/profs", label: "Professeurs", icon: GraduationCap },
      { href: "/langues", label: "Langues", icon: Languages },
      { href: "/niveaux", label: "Niveaux", icon: Layers },
      { href: "/groupes", label: "Groupes", icon: Boxes },
      { href: "/etudiants-groupes", label: "Étudiants & groupes", icon: UsersRound },
      { href: "/inscriptions", label: "Inscriptions", icon: ClipboardList },
    ],
  },
  {
    section: "Finances",
    items: [
      { href: "/paiements", label: "Paiements", icon: ReceiptText },
      {
        href: "/gains",
        label: "Gains",
        icon: Wallet,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    section: "Système",
    items: [
      { href: "/utilisateurs", label: "Utilisateurs", icon: UserCog, roles: ["admin"] },
      { href: "/audits", label: "Audits", icon: ScrollText, roles: ["admin"] },
    ],
  },
];

function Marque({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary font-display text-lg font-extrabold text-sidebar-primary-foreground shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
        aria-hidden="true"
      >
        N
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[17px] font-bold tracking-tight text-sidebar-foreground">
            Nevada
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-ardoise-texte-doux">
            Centre de langues
          </span>
        </span>
      )}
    </div>
  );
}

function LiensNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useRole();
  return (
    <nav className="flex-1 overflow-y-auto defile-doux px-3 pb-4" aria-label="Navigation principale">
      {NAV.map((bloc) => {
        const items = bloc.items.filter(
          (it) => !it.roles || it.roles.includes(user.role)
        );
        if (items.length === 0) return null;
        return (
          <div key={bloc.section} className="mb-5">
            <p className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ardoise-texte-doux">
              {bloc.section}
            </p>
            <ul className="space-y-1">
              {items.map((it) => {
                const actif =
                  pathname === it.href || pathname.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      aria-current={actif ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors outline-offset-2",
                        actif
                          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                          : "text-ardoise-texte/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4.5 shrink-0",
                          actif
                            ? "text-sidebar-primary-foreground"
                            : "text-ardoise-texte-doux group-hover:text-sidebar-foreground"
                        )}
                      />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function CarteUtilisateur() {
  const { user } = useRole();
  const router = useRouter();
  const [deconnexion, setDeconnexion] = useState(false);

  async function seDeconnecter() {
    setDeconnexion(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/25 font-mono text-xs font-semibold text-sidebar-primary uppercase">
          {user.username.slice(0, 2)}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">
            {user.username}
          </span>
          <span className="block text-xs text-ardoise-texte-doux">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={seDeconnecter}
        disabled={deconnexion}
        className="w-full justify-start gap-3 text-ardoise-texte/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <LogOut className="size-4" />
        {deconnexion ? "Déconnexion…" : "Se déconnecter"}
      </Button>
    </div>
  );
}

function ContenuSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <Marque />
      </div>
      <div className="mx-5 mb-3 h-px bg-sidebar-border" aria-hidden="true" />
      <LiensNavigation onNavigate={onNavigate} />
      <CarteUtilisateur />
    </div>
  );
}

export function AppShell({
  username,
  role,
  children,
}: {
  username: string;
  role: Role;
  children: React.ReactNode;
}) {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <RoleProvider username={username} role={role}>
      <div className="flex min-h-screen">
        {/* Sidebar fixe desktop */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <ContenuSidebar />
        </aside>

        {/* Barre mobile */}
        <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 lg:hidden">
          <Marque compact />
          <Sheet open={menuOuvert} onOpenChange={setMenuOuvert}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ouvrir le menu"
                className="text-ardoise-texte hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-sidebar-border bg-sidebar p-0 [&>button]:text-ardoise-texte"
            >
              <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
              <ContenuSidebar onNavigate={() => setMenuOuvert(false)} />
            </SheetContent>
          </Sheet>
        </header>

        {/* Contenu principal */}
        <main className="min-w-0 flex-1 px-4 pb-10 pt-16 sm:px-6 lg:ml-64 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
