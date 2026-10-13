import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireRole, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, sortStage, paginate } from "@/lib/list";
import { logAudit } from "@/lib/audit";
import type { UserDoc, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["username", "role", "created_at"];
const ROLES: Role[] = ["admin", "manager", "assistant"];

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "username", "asc");
    const { users } = await getCollections();

    const base: Filter<UserDoc> = { deleted_at: null };
    const qf = qFilter(["username"], p.q);
    if (qf) Object.assign(base, qf);

    const role = sp.get("role");
    if (role && ROLES.includes(role as Role)) base.role = role as Role;

    const total = await users.countDocuments(base);
    const docs = await users
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      username: d.username,
      role: d.role,
      created_at: d.created_at,
    }));

    return NextResponse.json(paginate(data, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole("admin");
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
    if (password.length < 6) {
      throw new ApiError(400, "Le mot de passe doit contenir au moins 6 caractères.");
    }
    if (!ROLES.includes(role)) throw new ApiError(400, "Rôle invalide.");

    const doublon = await users.findOne({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      deleted_at: null,
    });
    if (doublon) throw new ApiError(409, `L'identifiant « ${username} » est déjà pris.`);

    const now = new Date();
    const hash = await bcrypt.hash(password, 10);
    const res = await users.insertOne({
      username,
      password: hash,
      role,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as UserDoc);

    await logAudit({
      user: admin,
      action: "creer",
      ressource: "utilisateurs",
      ressource_id: res.insertedId.toString(),
      details: `Création du compte ${username} (rôle ${role}).`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString(), username, role },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
