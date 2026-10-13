import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, sortStage, paginate } from "@/lib/list";
import { logAudit } from "@/lib/audit";
import { couleurLangue } from "@/lib/format";
import type { LangueDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["name", "created_at"];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "name", "asc");
    const { langues, niveaux, groupes } = await getCollections();

    const base: Filter<LangueDoc> = { deleted_at: null };
    const qf = qFilter(["name"], p.q);
    if (qf) Object.assign(base, qf);

    const total = await langues.countDocuments(base);
    const docs = await langues
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    // Compteurs d'affichage : groupes et inscriptions par langue.
    let nbGroupes: Record<string, number> = {};
    if (docs.length) {
      const g = await groupes
        .aggregate([
          { $match: { deleted_at: null, langue_id: { $in: docs.map((d) => d._id) } } },
          { $group: { _id: "$langue_id", n: { $sum: 1 } } },
        ])
        .toArray();
      nbGroupes = g.reduce<Record<string, number>>((acc, x) => {
        acc[x._id.toString()] = x.n;
        return acc;
      }, {});
    }

    const totalNiveaux = await niveaux.countDocuments({ deleted_at: null });

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      name: d.name,
      couleur: d.couleur || couleurLangue(d.name),
      nb_groupes: nbGroupes[d._id.toString()] || 0,
      nb_niveaux: totalNiveaux,
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
    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "Le nom de la langue est obligatoire.");
    if (name.length > 50)
      throw new ApiError(400, "Le nom ne doit pas dépasser 50 caractères.");

    const { langues } = await getCollections();
    const doublon = await langues.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      deleted_at: null,
    });
    if (doublon) throw new ApiError(409, `La langue « ${name} » existe déjà.`);

    const now = new Date();
    const res = await langues.insertOne({
      name,
      couleur: couleurLangue(name),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as LangueDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "langues",
      ressource_id: res.insertedId.toString(),
      details: `Création de la langue « ${name} ».`,
    });

    return NextResponse.json({ _id: res.insertedId.toString(), name }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
