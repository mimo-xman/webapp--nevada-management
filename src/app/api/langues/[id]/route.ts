import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { couleurLangue } from "@/lib/format";
import type { LangueDoc, GroupeDoc, InscriptionDoc, PaiementDoc, EtudiantGroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Langue introuvable.");
  const { langues } = await getCollections();
  const doc = await langues.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Langue introuvable.");
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
    const name = String(body.name ?? "").trim();
    if (!name) throw new ApiError(400, "Le nom de la langue est obligatoire.");

    const { langues, groupes, inscriptions, etudiants_groupes, paiements } = await getCollections();
    const doublon = await langues.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      deleted_at: null,
      _id: { $ne: doc._id },
    });
    if (doublon) throw new ApiError(409, `La langue « ${name} » existe déjà.`);

    await langues.updateOne(
      { _id: doc._id },
      { $set: { name, couleur: couleurLangue(name), updated_at: new Date() } }
    );

    if (name !== doc.name) {
      // Instantanés : libellés de groupes, inscriptions, relations, paiements.
      await groupes.updateMany(
        { langue_id: doc._id, deleted_at: null } as Filter<GroupeDoc>,
        { $set: { langue_name: name } }
      );
      await inscriptions.updateMany(
        { langue_id: doc._id, deleted_at: null } as Filter<InscriptionDoc>,
        { $set: { langue_name: name } }
      );
      const gDocs = await groupes
        .find({ langue_id: doc._id, deleted_at: null } as Filter<GroupeDoc>)
        .project({ _id: 1, langue_name: 1, niveau_name: 1 })
        .toArray();
      for (const g of gDocs) {
        const label = `${g.langue_name} · ${g.niveau_name}`;
        await etudiants_groupes.updateMany(
          { groupe_id: g._id, deleted_at: null } as Filter<EtudiantGroupeDoc>,
          { $set: { groupe_label: label } }
        );
      }
      await paiements.updateMany(
        { langue_id: doc._id, deleted_at: null } as Filter<PaiementDoc>,
        { $set: { langue_name: name } }
      );
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "langues",
      ressource_id: id,
      details: `Modification de la langue « ${doc.name} » → « ${name} ».`,
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
    const { langues } = await getCollections();

    await langues.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "langues",
      ressource_id: id,
      details: `Suppression (logique) de la langue « ${doc.name} ».`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
