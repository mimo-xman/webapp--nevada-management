import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { exigerObjectId, exigerDate, dateOptionnelle } from "@/lib/entities";
import { verifierUniciteGroupeLangue } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import type { EtudiantGroupeDoc, EtudiantDoc, GroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = [
  "etudiant_name",
  "groupe_label",
  "start_date",
  "end_date",
  "created_at",
];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "created_at", "desc");
    const { etudiants_groupes } = await getCollections();

    const base: Filter<EtudiantGroupeDoc> = { deleted_at: null };
    const qf = qFilter(["etudiant_name", "groupe_label"], p.q);
    if (qf) Object.assign(base, qf);

    const langueId = idParam(sp, "langue_id");
    if (langueId) base.langue_id = langueId;

    const groupeId = idParam(sp, "groupe_id");
    if (groupeId) base.groupe_id = groupeId;

    const statut = sp.get("statut");
    if (statut === "actif") base.end_date = null;
    if (statut === "termine") base.end_date = { $ne: null };

    const total = await etudiants_groupes.countDocuments(base);
    const docs = await etudiants_groupes
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      groupe_id: d.groupe_id.toString(),
      etudiant_id: d.etudiant_id.toString(),
      etudiant_name: d.etudiant_name,
      groupe_label: d.groupe_label,
      langue_id: d.langue_id.toString(),
      start_date: d.start_date,
      end_date: d.end_date,
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
    const { etudiants_groupes, etudiants, groupes } = await getCollections();

    const etudiant_id = exigerObjectId(body.etudiant_id, "L'étudiant");
    const groupe_id = exigerObjectId(body.groupe_id, "Le groupe");
    const start_date = exigerDate(body.start_date, "La date de début");
    const end_date = dateOptionnelle(body.end_date, "La date de fin");

    if (end_date && end_date < start_date) {
      throw new ApiError(400, "La date de fin doit être postérieure à la date de début.");
    }

    const [etudiant, groupe] = await Promise.all([
      etudiants.findOne({ _id: etudiant_id, deleted_at: null }),
      groupes.findOne({ _id: groupe_id, deleted_at: null }),
    ]);
    if (!etudiant) throw new ApiError(400, "Étudiant introuvable.");
    if (!groupe) throw new ApiError(400, "Groupe introuvable.");

    // Règle : un seul groupe actif par langue.
    if (!end_date) {
      await verifierUniciteGroupeLangue({ etudiant_id, langue_id: groupe.langue_id });
    }

    const etudiant_name = nomEtudiant(etudiant as EtudiantDoc);
    const now = new Date();
    const res = await etudiants_groupes.insertOne({
      groupe_id,
      etudiant_id,
      start_date,
      end_date,
      etudiant_name,
      langue_id: groupe.langue_id,
      groupe_label: `${groupe.langue_name} · ${groupe.niveau_name}`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as EtudiantGroupeDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "etudiants_groupes",
      ressource_id: res.insertedId.toString(),
      details: `Affectation de ${etudiant_name} au groupe ${groupe.langue_name} · ${groupe.niveau_name} (début ${start_date}).`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString() },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}

function nomEtudiant(e: EtudiantDoc): string {
  return `${e.first_name} ${e.last_name}`;
}
