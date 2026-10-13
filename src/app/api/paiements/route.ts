import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { parseListParams, qFilter, idParam, sortStage, paginate } from "@/lib/list";
import { exigerObjectId, exigerDate } from "@/lib/entities";
import { verifierPaiementUnique } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import type { PaiementDoc, InscriptionDoc, StatutPaiement } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = [
  "etudiant_name",
  "langue_name",
  "date",
  "montant",
  "status",
  "created_at",
];

const STATUTS: StatutPaiement[] = ["en_attente", "payer", "annuler"];

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "date", "desc");
    const { paiements } = await getCollections();

    const base: Filter<PaiementDoc> = { deleted_at: null };
    const qf = qFilter(["etudiant_name", "langue_name"], p.q);
    if (qf) Object.assign(base, qf);

    const langueId = idParam(sp, "langue_id");
    if (langueId) base.langue_id = langueId;

    const inscriptionId = idParam(sp, "inscription_id");
    if (inscriptionId) base.inscription_id = inscriptionId;

    const statut = sp.get("status");
    if (statut && STATUTS.includes(statut as StatutPaiement)) {
      base.status = statut as StatutPaiement;
    }

    const mois = sp.get("mois"); // YYYY-MM
    if (mois && /^\d{4}-\d{2}$/.test(mois)) {
      base.date = { $regex: `^${mois}` };
    }

    const total = await paiements.countDocuments(base);
    const docs = await paiements
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      inscription_id: d.inscription_id.toString(),
      etudiant_id: d.etudiant_id.toString(),
      etudiant_name: d.etudiant_name,
      langue_id: d.langue_id.toString(),
      langue_name: d.langue_name,
      date: d.date,
      status: d.status,
      montant: d.montant,
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
    const { paiements, inscriptions } = await getCollections();

    const inscription_id = exigerObjectId(body.inscription_id, "L'inscription");
    const date = exigerDate(body.date, "La date du paiement");

    const statutBrut = String(body.status ?? "en_attente");
    if (!STATUTS.includes(statutBrut as StatutPaiement)) {
      throw new ApiError(400, "Statut de paiement invalide.");
    }
    const status = statutBrut as StatutPaiement;

    const inscription = await inscriptions.findOne({
      _id: inscription_id,
      deleted_at: null,
    } as Filter<InscriptionDoc>);
    if (!inscription) throw new ApiError(400, "Inscription introuvable.");

    // Montant : valeur saisie, sinon le prix de l'inscription.
    let montant = inscription.price;
    if (body.montant !== undefined && body.montant !== null && body.montant !== "") {
      const brut = Number(body.montant);
      if (!Number.isFinite(brut) || brut <= 0) {
        throw new ApiError(400, "Le montant doit être un nombre positif.");
      }
      montant = Math.round(brut * 100) / 100;
    }

    await verifierPaiementUnique({ inscription_id, date });

    const now = new Date();
    const res = await paiements.insertOne({
      inscription_id,
      date,
      status,
      montant,
      etudiant_id: inscription.etudiant_id,
      etudiant_name: inscription.etudiant_name,
      langue_id: inscription.langue_id,
      langue_name: inscription.langue_name,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as PaiementDoc);

    await logAudit({
      user,
      action: "creer",
      ressource: "paiements",
      ressource_id: res.insertedId.toString(),
      details: `Paiement ${status === "payer" ? "payé" : status === "annuler" ? "annulé" : "en attente"} de ${montant} DH pour ${inscription.etudiant_name} (${inscription.langue_name}), date ${date}.`,
    });

    return NextResponse.json({ _id: res.insertedId.toString() }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
