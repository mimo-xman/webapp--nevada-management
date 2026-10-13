import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { exigerObjectId, exigerDate, dateOptionnelle } from "@/lib/entities";
import { logAudit } from "@/lib/audit";
import type { GroupeDoc, EtudiantGroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Groupe introuvable.");
  const { groupes } = await getCollections();
  const doc = await groupes.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Groupe introuvable.");
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
      prof_id: doc.prof_id.toString(),
      langue_id: doc.langue_id.toString(),
      niveau_id: doc.niveau_id.toString(),
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
    const { groupes, profs, langues, niveaux, etudiants_groupes } = await getCollections();

    const prof_id = exigerObjectId(body.prof_id, "Le professeur");
    const langue_id = exigerObjectId(body.langue_id, "La langue");
    const niveau_id = exigerObjectId(body.niveau_id, "Le niveau");
    const start_date = exigerDate(body.start_date, "La date de début");
    const end_date = dateOptionnelle(body.end_date, "La date de fin");

    if (end_date && end_date < start_date) {
      throw new ApiError(400, "La date de fin doit être postérieure à la date de début.");
    }

    const [prof, langue, niveau] = await Promise.all([
      profs.findOne({ _id: prof_id, deleted_at: null }),
      langues.findOne({ _id: langue_id, deleted_at: null }),
      niveaux.findOne({ _id: niveau_id, deleted_at: null }),
    ]);
    if (!prof) throw new ApiError(400, "Professeur introuvable.");
    if (!langue) throw new ApiError(400, "Langue introuvable.");
    if (!niveau) throw new ApiError(400, "Niveau introuvable.");

    const label = `${langue.name} · ${niveau.name}`;
    await groupes.updateOne(
      { _id: doc._id },
      {
        $set: {
          prof_id,
          langue_id,
          niveau_id,
          start_date,
          end_date,
          prof_name: `${prof.first_name} ${prof.last_name}`,
          langue_name: langue.name,
          niveau_name: niveau.name,
          updated_at: new Date(),
        },
      }
    );

    if (label !== `${doc.langue_name} · ${doc.niveau_name}`) {
      await etudiants_groupes.updateMany(
        { groupe_id: doc._id, deleted_at: null } as Filter<EtudiantGroupeDoc>,
        { $set: { groupe_label: label, langue_id } }
      );
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "groupes",
      ressource_id: id,
      details: `Modification du groupe ${label} (prof. ${prof.first_name} ${prof.last_name}).`,
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
    const { groupes } = await getCollections();

    await groupes.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "groupes",
      ressource_id: id,
      details: `Suppression (logique) du groupe ${doc.langue_name} · ${doc.niveau_name} (prof. ${doc.prof_name}).`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
