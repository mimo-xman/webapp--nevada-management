import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { NiveauDoc, GroupeDoc, InscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Niveau introuvable.");
  const { niveaux } = await getCollections();
  const doc = await niveaux.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Niveau introuvable.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const doc = await charger(id);
    return NextResponse.json({ ...doc, _id: doc._id.toString() });
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
    const name = String(body.name ?? "").trim().toUpperCase();
    if (!name) throw new ApiError(400, "Le nom du niveau est obligatoire.");

    const { niveaux, groupes, inscriptions } = await getCollections();
    const doublon = await niveaux.findOne({
      name,
      deleted_at: null,
      _id: { $ne: doc._id },
    });
    if (doublon) throw new ApiError(409, `Le niveau « ${name} » existe déjà.`);

    await niveaux.updateOne(
      { _id: doc._id },
      { $set: { name, updated_at: new Date() } }
    );

    if (name !== doc.name) {
      await groupes.updateMany(
        { niveau_id: doc._id, deleted_at: null } as Filter<GroupeDoc>,
        { $set: { niveau_name: name } }
      );
      await inscriptions.updateMany(
        { "niveaux.id": doc._id.toString(), deleted_at: null } as Filter<InscriptionDoc>,
        { $set: { "niveaux.$.name": name } }
      );
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "niveaux",
      ressource_id: id,
      details: `Modification du niveau « ${doc.name} » → « ${name} ».`,
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
    const { niveaux } = await getCollections();

    await niveaux.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "niveaux",
      ressource_id: id,
      details: `Suppression (logique) du niveau « ${doc.name} ».`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
