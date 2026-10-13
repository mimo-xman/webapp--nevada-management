import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { exigerObjectId, exigerDate, dateOptionnelle } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { GroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = [
  "langue_name",
  "niveau_name",
  "prof_name",
  "start_date",
  "end_date",
  "created_at",
];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "start_date", "desc");
    const { groupes } = await getCollections();

    const base: Filter<GroupeDoc> = { deleted_at: null };
    const qf = qFilter(["langue_name", "niveau_name", "prof_name"], p.q);
    if (qf) Object.assign(base, qf);

    const langueId = idParam(sp, "langue_id");
    if (langueId) base.langue_id = langueId;
    const profId = idParam(sp, "prof_id");
    if (profId) base.prof_id = profId;
    const niveauId = idParam(sp, "niveau_id");
    if (niveauId) base.niveau_id = niveauId;

    const statut = sp.get("statut");
    if (statut === "actif") base.end_date = null;
    if (statut === "termine") base.end_date = { $ne: null };

    const total = await groupes.countDocuments(base);
    const docs = await groupes
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      prof_id: d.prof_id.toString(),
      langue_id: d.langue_id.toString(),
      niveau_id: d.niveau_id.toString(),
      start_date: d.start_date,
      end_date: d.end_date,
      prof_name: d.prof_name,
      langue_name: d.langue_name,
      niveau_name: d.niveau_name,
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
    const { groupes, profs, langues, niveaux } = await getCollections();

    const prof_id = exigerObjectId(body.prof_id, "Le professeur");
    const langue_id = exigerObjectId(body.langue_id, "La langue");
    const niveau_id = exigerObjectId(body.niveau_id, "Le niveau");
    const start_date = exigerDate(body.start_date, "La date de début");
    const end_date = dateOptionnelle(body.end_date, "La date de fin");

    if (end_date && end_date < start_date) {
      throw new ApiError(400, "La date de fin doit être postérieure à la date de début.");
    }

    const [prof, langue, niveau] = await Promise.all([
      profs.findOne({ _id: prof_id, deleted_at: null }),
      langues.findOne({ _id: langue_id, deleted_at: null }),
      niveaux.findOne({ _id: niveau_id, deleted_at: null }),
    ]);
    if (!prof) throw new ApiError(400, "Professeur introuvable.");
    if (!langue) throw new ApiError(400, "Langue introuvable.");
    if (!niveau) throw new ApiError(400, "Niveau introuvable.");

    const label = `${langue.name} · ${niveau.name}`;
    const now = new Date();
    const res = await groupes.insertOne({
      prof_id,
      langue_id,
      niveau_id,
      start_date,
      end_date,
      prof_name: nom(prof),
      langue_name: langue.name,
      niveau_name: niveau.name,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as GroupeDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "groupes",
      ressource_id: res.insertedId.toString(),
      details: `Création du groupe ${label} (prof. ${nom(prof)}, début ${start_date}).`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString(), label },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}

function nom(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`;
}
