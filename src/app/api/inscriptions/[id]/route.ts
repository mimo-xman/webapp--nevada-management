import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { exigerObjectId, exigerDate } from "@/lib/entities";
import { verifierUniciteInscription } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import type { InscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Inscription introuvable.");
  const { inscriptions } = await getCollections();
  const doc = await inscriptions.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Inscription introuvable.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const doc = await charger(id);
    return NextResponse.json({
      _id: doc._id.toString(),
      etudiant_id: doc.etudiant_id.toString(),
      etudiant_name: doc.etudiant_name,
      langue_id: doc.langue_id.toString(),
      langue_name: doc.langue_name,
      niveau_ids: doc.niveau_ids.map((n) => n.toString()),
      niveaux: doc.niveaux,
      price: doc.price,
      start_date: doc.start_date,
      expired_at: doc.expired_at,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin", "manager");
    const { id } = await params;
    const doc = await charger(id);
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
    const niveau_ids = [
      ...new Set(
        niveauIdsBruts
          .map((v) => exigerObjectId(v, "Chaque niveau doit être valide").toString())
          .filter((v, i, arr) => arr.indexOf(v) === i)
      ),
    ].map((s) => new ObjectId(s));

    const [etudiant, langue] = await Promise.all([
      etudiants.findOne({ _id: etudiant_id, deleted_at: null }),
      langues.findOne({ _id: langue_id, deleted_at: null }),
    ]);
    if (!etudiant) throw new ApiError(400, "Étudiant introuvable.");
    if (!langue) throw new ApiError(400, "Langue introuvable.");

    const nivDocs = await niveaux
      .find({ _id: { $in: niveau_ids }, deleted_at: null })
      .toArray();
    if (nivDocs.length !== niveau_ids.length) {
      throw new ApiError(400, "Un ou plusieurs niveaux sont introuvables.");
    }

    await verifierUniciteInscription({
      etudiant_id,
      langue_id,
      niveau_ids: niveau_ids,
      exclureId: doc._id,
    });

    const etudiant_name = `${etudiant.first_name} ${etudiant.last_name}`;
    const nouveauxNiveaux = nivDocs
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({ id: n._id.toString(), name: n.name }));

    await inscriptions.updateOne(
      { _id: doc._id },
      {
        $set: {
          etudiant_id,
          langue_id,
          niveau_ids,
          niveaux: nouveauxNiveaux,
          price,
          start_date,
          etudiant_name,
          langue_name: langue.name,
          updated_at: new Date(),
        },
      }
    );

    await logAudit({
      user,
      action: "modifier",
      ressource: "inscriptions",
      ressource_id: id,
      details: `Modification de l'inscription de ${etudiant_name} en ${langue.name} — ${price} DH.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin");
    const { id } = await params;
    const doc = await charger(id);
    const { inscriptions } = await getCollections();

    await inscriptions.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "inscriptions",
      ressource_id: id,
      details: `Suppression (logique) de l'inscription de ${doc.etudiant_name} en ${doc.langue_name}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
