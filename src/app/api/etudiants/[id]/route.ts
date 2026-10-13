import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { validerPersonne, nomComplet } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { EtudiantDoc, InscriptionDoc, EtudiantGroupeDoc, PaiementDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Étudiant introuvable.");
  const { etudiants } = await getCollections();
  const doc = await etudiants.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Étudiant introuvable.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const doc = await charger(id);
    return NextResponse.json({
      ...doc,
      _id: doc._id.toString(),
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
    const valeurs = validerPersonne(body);
    const { etudiants, inscriptions, etudiants_groupes, paiements } = await getCollections();

    const doublon = await etudiants.findOne({
      cin: valeurs.cin,
      deleted_at: null,
      _id: { $ne: doc._id },
    });
    if (doublon) {
      throw new ApiError(409, `Le CIN ${valeurs.cin} est déjà utilisé par un autre étudiant.`);
    }

    const nom = nomComplet(valeurs);
    const nomAvant = nomComplet(doc);

    await etudiants.updateOne(
      { _id: doc._id },
      { $set: { ...valeurs, updated_at: new Date() } }
    );

    if (nom !== nomAvant) {
      // Répercute le changement de nom sur les instantanés.
      await inscriptions.updateMany(
        { etudiant_id: doc._id, deleted_at: null } as Filter<InscriptionDoc>,
        { $set: { etudiant_name: nom } }
      );
      await etudiants_groupes.updateMany(
        { etudiant_id: doc._id, deleted_at: null } as Filter<EtudiantGroupeDoc>,
        { $set: { etudiant_name: nom } }
      );
      await paiements.updateMany(
        { etudiant_id: doc._id, deleted_at: null } as Filter<PaiementDoc>,
        { $set: { etudiant_name: nom } }
      );
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "etudiants",
      ressource_id: id,
      details: `Modification de l'étudiant ${nom} (anciennement ${nomAvant}, CIN ${valeurs.cin}).`,
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
    const { etudiants } = await getCollections();

    await etudiants.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "etudiants",
      ressource_id: id,
      details: `Suppression (logique) de l'étudiant ${nomComplet(doc)}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
