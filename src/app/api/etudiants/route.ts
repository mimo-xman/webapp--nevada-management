import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { validerPersonne, nomComplet } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { EtudiantDoc, InscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["last_name", "first_name", "cin", "created_at"];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "last_name", "asc");
    const { etudiants, inscriptions } = await getCollections();

    const base: Filter<EtudiantDoc> = { deleted_at: null };
    const qf = qFilter(["first_name", "last_name", "cin", "phone", "email"], p.q);
    if (qf) Object.assign(base, qf);

    // Filtre « langue suivie » : étudiants avec une inscription active dans la langue.
    const langueId = idParam(sp, "langue_id");
    if (langueId) {
      const ids = await inscriptions
        .distinct("etudiant_id", {
          langue_id: langueId,
          expired_at: null,
          deleted_at: null,
        } as Filter<InscriptionDoc>);
      base._id = { $in: ids };
    }

    const total = await etudiants.countDocuments(base);
    const docs = await etudiants
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    // Nombre d'inscriptions actives par étudiant (affichage).
    let actifs: Record<string, number> = {};
    if (docs.length) {
      const liste = await inscriptions
        .find({
          etudiant_id: { $in: docs.map((d) => d._id) },
          expired_at: null,
          deleted_at: null,
        } as Filter<InscriptionDoc>)
        .project({ etudiant_id: 1 })
        .toArray();
      actifs = liste.reduce<Record<string, number>>((acc, i) => {
        const k = i.etudiant_id.toString();
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
      inscriptions_actives: actifs[d._id.toString()] || 0,
      created_at: d.created_at,
    }));

    return NextResponse.json(paginate(data, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(); // tous les rôles peuvent ajouter
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const valeurs = validerPersonne(body);
    const { etudiants } = await getCollections();

    const doublon = await etudiants.findOne({
      cin: valeurs.cin,
      deleted_at: null,
    });
    if (doublon) {
      throw new ApiError(409, `Le CIN ${valeurs.cin} est déjà utilisé par un autre étudiant.`);
    }

    const now = new Date();
    const doc: Omit<EtudiantDoc, "_id"> = {
      ...valeurs,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const res = await etudiants.insertOne(doc as EtudiantDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "etudiants",
      ressource_id: res.insertedId.toString(),
      details: `Création de l'étudiant ${nomComplet(valeurs)} (CIN ${valeurs.cin}).`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString(), ...valeurs },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
