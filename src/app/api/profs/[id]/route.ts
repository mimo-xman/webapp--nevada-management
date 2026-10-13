import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { validerPersonne, nomComplet } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { ProfDoc, GroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Professeur introuvable.");
  const { profs } = await getCollections();
  const doc = await profs.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Professeur introuvable.");
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
    const valeurs = validerPersonne(body);
    const { profs, groupes } = await getCollections();

    const doublon = await profs.findOne({
      cin: valeurs.cin,
      deleted_at: null,
      _id: { $ne: doc._id },
    });
    if (doublon) {
      throw new ApiError(409, `Le CIN ${valeurs.cin} est déjà utilisé par un autre professeur.`);
    }

    const nom = nomComplet(valeurs);
    const nomAvant = nomComplet(doc);

    await profs.updateOne(
      { _id: doc._id },
      { $set: { ...valeurs, updated_at: new Date() } }
    );

    if (nom !== nomAvant) {
      await groupes.updateMany(
        { prof_id: doc._id, deleted_at: null } as Filter<GroupeDoc>,
        { $set: { prof_name: nom } }
      );
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "profs",
      ressource_id: id,
      details: `Modification du professeur ${nom} (anciennement ${nomAvant}, CIN ${valeurs.cin}).`,
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
    const { profs } = await getCollections();

    await profs.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "profs",
      ressource_id: id,
      details: `Suppression (logique) du professeur ${nomComplet(doc)}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
