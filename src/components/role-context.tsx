"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/types";
import { peut, type Capability } from "@/lib/permissions";

interface RoleContextValue {
  user: { username: string; role: Role };
  peut: (cap: Capability) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  username,
  role,
  children,
}: {
  username: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={{ user: { username, role }, peut: (c) => peut(role, c) }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole doit être utilisé sous <RoleProvider>.");
  }
  return ctx;
}
