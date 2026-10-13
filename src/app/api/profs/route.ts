import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { validerPersonne, nomComplet } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { ProfDoc, GroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["last_name", "first_name", "cin", "created_at"];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "last_name", "asc");
    const { profs, groupes } = await getCollections();

    const base: Filter<ProfDoc> = { deleted_at: null };
    const qf = qFilter(["first_name", "last_name", "cin", "phone", "email"], p.q);
    if (qf) Object.assign(base, qf);

    // Filtre « langue enseignée » : professeurs liés à au moins un groupe.
    const langueId = idParam(sp, "langue_id");
    if (langueId) {
      const ids = await groupes.distinct("prof_id", {
        langue_id: langueId,
        deleted_at: null,
      } as Filter<GroupeDoc>);
      base._id = { $in: ids };
    }

    const total = await profs.countDocuments(base);
    const docs = await profs
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    // Groupes actifs par professeur (affichage).
    let actifs: Record<string, number> = {};
    if (docs.length) {
      const liste = await groupes
        .find({
          prof_id: { $in: docs.map((d) => d._id) },
          end_date: null,
          deleted_at: null,
        } as Filter<GroupeDoc>)
        .project({ prof_id: 1 })
        .toArray();
      actifs = liste.reduce<Record<string, number>>((acc, g) => {
        const k = g.prof_id.toString();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
    }

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      first_name: d.first_name,
      last_name: d.last_name,
      cin: d.cin,
      phone: d.phone,
      email: d.email,
      groupes_actifs: actifs[d._id.toString()] || 0,
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
    const valeurs = validerPersonne(body);
    const { profs } = await getCollections();

    const doublon = await profs.findOne({ cin: valeurs.cin, deleted_at: null });
    if (doublon) {
      throw new ApiError(409, `Le CIN ${valeurs.cin} est déjà utilisé par un autre professeur.`);
    }

    const now = new Date();
    const res = await profs.insertOne({
      ...valeurs,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as ProfDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "profs",
      ressource_id: res.insertedId.toString(),
      details: `Création du professeur ${nomComplet(valeurs)} (CIN ${valeurs.cin}).`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString(), ...valeurs },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
