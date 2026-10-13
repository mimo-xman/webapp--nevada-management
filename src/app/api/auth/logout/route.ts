import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (user) {
      await logAudit({
        user,
        action: "connexion",
        ressource: "auth",
        details: `Déconnexion de ${user.username}.`,
      });
    }
  } finally {
    await clearSessionCookie();
  }
  return NextResponse.json({ ok: true });
}
