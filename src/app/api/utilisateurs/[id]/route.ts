import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollections, oid } from "@/lib/mongo";
import { requireRole, handleApiError, ApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { UserDoc, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ROLES: Role[] = ["admin", "manager", "assistant"];

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Utilisateur introuvable.");
  const { users } = await getCollections();
  const doc = await users.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Utilisateur introuvable.");
  return doc;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireRole("admin");
    const { id } = await params;
    const doc = await charger(id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { users } = await getCollections();

    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "") as Role;

    if (!username) throw new ApiError(400, "L'identifiant est obligatoire.");
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      throw new ApiError(
        400,
        "L'identifiant doit contenir 3 à 30 caractères (lettres, chiffres, . _ -)."
      );
    }
    if (password && password.length < 6) {
      throw new ApiError(400, "Le mot de passe doit contenir au moins 6 caractères.");
    }
    if (!ROLES.includes(role)) throw new ApiError(400, "Rôle invalide.");

    // Sécurité : un admin ne peut pas retirer son propre rôle admin.
    if (doc._id.toString() === admin.id && role !== "admin") {
      throw new ApiError(400, "Vous ne pouvez pas retirer votre propre rôle administrateur.");
    }

    const doublon = await users.findOne({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      deleted_at: null,
      _id: { $ne: doc._id },
    });
    if (doublon) throw new ApiError(409, `L'identifiant « ${username} » est déjà pris.`);

    const $set: Record<string, unknown> = {
      username,
      role,
      updated_at: new Date(),
    };
    if (password) $set.password = await bcrypt.hash(password, 10);

    await users.updateOne({ _id: doc._id }, { $set });

    await logAudit({
      user: admin,
      action: "modifier",
      ressource: "utilisateurs",
      ressource_id: id,
      details: `Modification du compte ${doc.username} → ${username} (rôle ${role})${password ? ", mot de passe réinitialisé" : ""}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const admin = await requireRole("admin");
    const { id } = await params;
    const doc = await charger(id);

    if (doc._id.toString() === admin.id) {
      throw new ApiError(400, "Vous ne pouvez pas supprimer votre propre compte.");
    }

    const { users } = await getCollections();
    await users.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user: admin,
      action: "supprimer",
      ressource: "utilisateurs",
      ressource_id: id,
      details: `Suppression (logique) du compte ${doc.username} (rôle ${doc.role}).`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
