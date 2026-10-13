import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, sortStage, paginate } from "@/lib/list";
import { logAudit } from "@/lib/audit";
import type { NiveauDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["name", "created_at"];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "name", "asc");
    const { niveaux } = await getCollections();

    const base: Filter<NiveauDoc> = { deleted_at: null };
    const qf = qFilter(["name"], p.q);
    if (qf) Object.assign(base, qf);

    const total = await niveaux.countDocuments(base);
    const docs = await niveaux
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      name: d.name,
      created_at: d.created_at,
    }));

    return NextResponse.json(paginate(data, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim().toUpperCase();
    if (!name) throw new ApiError(400, "Le nom du niveau est obligatoire.");
    if (name.length > 20)
      throw new ApiError(400, "Le nom ne doit pas dépasser 20 caractères.");

    const { niveaux } = await getCollections();
    const doublon = await niveaux.findOne({ name, deleted_at: null });
    if (doublon) throw new ApiError(409, `Le niveau « ${name} » existe déjà.`);

    const now = new Date();
    const res = await niveaux.insertOne({
      name,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as NiveauDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "niveaux",
      ressource_id: res.insertedId.toString(),
      details: `Création du niveau « ${name} ».`,
    });

    return NextResponse.json({ _id: res.insertedId.toString(), name }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
