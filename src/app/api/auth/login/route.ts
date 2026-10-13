import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollections } from "@/lib/mongo";
import {
  createSessionToken,
  setSessionCookie,
  ApiError,
  handleApiError,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      throw new ApiError(400, "Identifiant et mot de passe requis.");
    }

    const { users } = await getCollections();
    const user = await users.findOne({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      deleted_at: null,
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new ApiError(401, "Identifiant ou mot de passe incorrect.");
    }

    const session = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    const token = await createSessionToken(session);
    await setSessionCookie(token);
    await logAudit({
      user: session,
      action: "connexion",
      ressource: "auth",
      details: `Connexion de ${user.username} (${user.role}).`,
    });

    return NextResponse.json({ ok: true, user: session });
  } catch (e) {
    return handleApiError(e);
  }
}
