import { NextRequest, NextResponse } from "next/server";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { exigerDate } from "@/lib/entities";
import { verifierPaiementUnique } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import { STATUT_PAIEMENT_LABELS } from "@/lib/permissions";
import type { PaiementDoc, StatutPaiement } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const STATUTS: StatutPaiement[] = ["en_attente", "payer", "annuler"];

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Paiement introuvable.");
  const { paiements } = await getCollections();
  const doc = await paiements.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Paiement introuvable.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const doc = await charger(id);
    return NextResponse.json({
      _id: doc._id.toString(),
      inscription_id: doc.inscription_id.toString(),
      etudiant_name: doc.etudiant_name,
      langue_name: doc.langue_name,
      date: doc.date,
      status: doc.status,
      montant: doc.montant,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** Modification : statut, date, montant. Le statut « Payé » est l'action courante. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin", "manager");
    const { id } = await params;
    const doc = await charger(id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { paiements } = await getCollections();

    const date = exigerDate(body.date ?? doc.date, "La date du paiement");

    const statutBrut = String(body.status ?? doc.status);
    if (!STATUTS.includes(statutBrut as StatutPaiement)) {
      throw new ApiError(400, "Statut de paiement invalide.");
    }
    const status = statutBrut as StatutPaiement;

    let montant = doc.montant;
    if (body.montant !== undefined && body.montant !== null && body.montant !== "") {
      const brut = Number(body.montant);
      if (!Number.isFinite(brut) || brut <= 0) {
        throw new ApiError(400, "Le montant doit être un nombre positif.");
      }
      montant = Math.round(brut * 100) / 100;
    }

    if (date !== doc.date) {
      await verifierPaiementUnique({
        inscription_id: doc.inscription_id,
        date,
        exclureId: doc._id,
      });
    }

    await paiements.updateOne(
      { _id: doc._id },
      { $set: { date, status, montant, updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "modifier",
      ressource: "paiements",
      ressource_id: id,
      details: `Paiement de ${doc.etudiant_name} (${doc.langue_name}) : statut « ${STATUT_PAIEMENT_LABELS[status]} », ${montant} DH, date ${date}.`,
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
    const { paiements } = await getCollections();

    await paiements.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "paiements",
      ressource_id: id,
      details: `Suppression (logique) du paiement de ${doc.etudiant_name} (${doc.montant} DH, ${doc.date}).`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
