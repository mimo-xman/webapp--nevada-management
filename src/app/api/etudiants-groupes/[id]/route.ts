import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { exigerObjectId, exigerDate, dateOptionnelle } from "@/lib/entities";
import { verifierUniciteGroupeLangue } from "@/lib/regles";
import { logAudit } from "@/lib/audit";
import type { EtudiantGroupeDoc, EtudiantDoc, GroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function charger(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Relation étudiant-groupe introuvable.");
  const { etudiants_groupes } = await getCollections();
  const doc = await etudiants_groupes.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Relation étudiant-groupe introuvable.");
  return doc;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const doc = await charger(id);
    return NextResponse.json({
      _id: doc._id.toString(),
      groupe_id: doc.groupe_id.toString(),
      etudiant_id: doc.etudiant_id.toString(),
      etudiant_name: doc.etudiant_name,
      groupe_label: doc.groupe_label,
      langue_id: doc.langue_id.toString(),
      start_date: doc.start_date,
      end_date: doc.end_date,
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

    // Règle : un seul groupe actif par langue (relation modifiée exclue).
    if (!end_date) {
      await verifierUniciteGroupeLangue({
        etudiant_id,
        langue_id: groupe.langue_id,
        exclureId: doc._id,
      });
    }

    const etudiant_name = `${etudiant.first_name} ${etudiant.last_name}`;

    await etudiants_groupes.updateOne(
      { _id: doc._id },
      {
        $set: {
          etudiant_id,
          groupe_id,
          start_date,
          end_date,
          etudiant_name,
          langue_id: groupe.langue_id,
          groupe_label: `${groupe.langue_name} · ${groupe.niveau_name}`,
          updated_at: new Date(),
        },
      }
    );

    await logAudit({
      user,
      action: "modifier",
      ressource: "etudiants_groupes",
      ressource_id: id,
      details: `Modification de la relation ${etudiant_name} → ${groupe.langue_name} · ${groupe.niveau_name}.`,
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
    const { etudiants_groupes } = await getCollections();

    await etudiants_groupes.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date(), updated_at: new Date() } }
    );

    await logAudit({
      user,
      action: "supprimer",
      ressource: "etudiants_groupes",
      ressource_id: id,
      details: `Suppression (logique) de la relation ${doc.etudiant_name} → ${doc.groupe_label}.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
