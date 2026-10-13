import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { exigerObjectId, exigerDate } from "@/lib/entities";
import { verifierUniciteInscription } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import type { InscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = [
  "etudiant_name",
  "langue_name",
  "price",
  "start_date",
  "expired_at",
  "created_at",
];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "created_at", "desc");
    const { inscriptions } = await getCollections();

    const base: Filter<InscriptionDoc> = { deleted_at: null };
    const qf = qFilter(["etudiant_name", "langue_name"], p.q);
    if (qf) Object.assign(base, qf);

    const langueId = idParam(sp, "langue_id");
    if (langueId) base.langue_id = langueId;

    const etudiantId = idParam(sp, "etudiant_id");
    if (etudiantId) base.etudiant_id = etudiantId;

    const niveauId = idParam(sp, "niveau_id");
    if (niveauId) base.niveau_ids = niveauId;

    const statut = sp.get("statut");
    if (statut === "actif") base.expired_at = null;
    if (statut === "expire") base.expired_at = { $ne: null };

    const total = await inscriptions.countDocuments(base);
    const docs = await inscriptions
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      etudiant_id: d.etudiant_id.toString(),
      etudiant_name: d.etudiant_name,
      langue_id: d.langue_id.toString(),
      langue_name: d.langue_name,
      niveau_ids: d.niveau_ids.map((n) => n.toString()),
      niveaux: d.niveaux.map((n) => ({ id: n.id, name: n.name })),
      price: d.price,
      start_date: d.start_date,
      expired_at: d.expired_at,
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
    const { inscriptions, etudiants, langues, niveaux } = await getCollections();

    const etudiant_id = exigerObjectId(body.etudiant_id, "L'étudiant");
    const langue_id = exigerObjectId(body.langue_id, "La langue");
    const start_date = exigerDate(body.start_date, "La date de début");

    const prixBrut = Number(body.price);
    if (!Number.isFinite(prixBrut) || prixBrut <= 0) {
      throw new ApiError(400, "Le prix doit être un nombre positif.");
    }
    const price = Math.round(prixBrut * 100) / 100;

    const niveauIdsBruts = Array.isArray(body.niveau_ids) ? body.niveau_ids : [];
    if (niveauIdsBruts.length === 0) {
      throw new ApiError(400, "Sélectionnez au moins un niveau.");
    }
    if (niveauIdsBruts.length > 8) {
      throw new ApiError(400, "Une inscription ne peut pas couvrir plus de 8 niveaux.");
    }
    const niveau_ids = niveauIdsBruts.map((v) =>
      exigerObjectId(v, "Chaque niveau doit être valide")
    );
    const niveauIdsUniques = [...new Set(niveau_ids.map((n) => n.toString()))].map(
      (s) => new ObjectId(s)
    );

    const [etudiant, langue] = await Promise.all([
      etudiants.findOne({ _id: etudiant_id, deleted_at: null }),
      langues.findOne({ _id: langue_id, deleted_at: null }),
    ]);
    if (!etudiant) throw new ApiError(400, "Étudiant introuvable.");
    if (!langue) throw new ApiError(400, "Langue introuvable.");

    const nivDocs = await niveaux
      .find({ _id: { $in: niveauIdsUniques }, deleted_at: null })
      .toArray();
    if (nivDocs.length !== niveauIdsUniques.length) {
      throw new ApiError(400, "Un ou plusieurs niveaux sont introuvables.");
    }

    await verifierUniciteInscription({ etudiant_id, langue_id, niveau_ids: niveauIdsUniques });

    const now = new Date();
    const etudiant_name = `${etudiant.first_name} ${etudiant.last_name}`;
    const res = await inscriptions.insertOne({
      etudiant_id,
      langue_id,
      niveau_ids: niveauIdsUniques,
      niveaux: nivDocs
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => ({ id: n._id.toString(), name: n.name })),
      price,
      start_date,
      expired_at: null,
      etudiant_name,
      langue_name: langue.name,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as InscriptionDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "inscriptions",
      ressource_id: res.insertedId.toString(),
      details: `Inscription de ${etudiant_name} en ${langue.name} (${nivDocs
        .map((n) => n.name)
        .join(", ")}) — ${price} DH, début ${start_date}.`,
    });

    return NextResponse.json(
      { _id: res.insertedId.toString() },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
