import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireUser, requireRole, handleApiError, ApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { todayStr } from "@/lib/format";
import type { InscriptionDoc, EtudiantGroupeDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function chargerInscription(id: string) {
  const _id = oid(id);
  if (!_id) throw new ApiError(404, "Inscription introuvable.");
  const { inscriptions } = await getCollections();
  const doc = await inscriptions.findOne({ _id, deleted_at: null });
  if (!doc) throw new ApiError(404, "Inscription introuvable.");
  return doc;
}

/** Groupes actifs de l'étudiant pour la langue de l'inscription. */
async function groupesLies(inscription: InscriptionDoc) {
  const { etudiants_groupes } = await getCollections();
  const relations = await etudiants_groupes
    .find({
      etudiant_id: inscription.etudiant_id,
      langue_id: inscription.langue_id,
      end_date: null,
      deleted_at: null,
    } as Filter<EtudiantGroupeDoc>)
    .toArray();
  return relations.map((r) => ({
    _id: r._id.toString(),
    groupe_label: r.groupe_label,
    start_date: r.start_date,
  }));
}

/**
 * GET : analyse avant expiration — liste les relations de groupe actives
 * de la même langue, pour que l'interface demande confirmation.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const inscription = await chargerInscription(id);

    if (inscription.expired_at) {
      throw new ApiError(409, "Cette inscription est déjà expirée.");
    }

    const lies = await groupesLies(inscription);
    return NextResponse.json({
      inscription: {
        _id: inscription._id.toString(),
        etudiant_name: inscription.etudiant_name,
        langue_name: inscription.langue_name,
      },
      groupes_lies: lies,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST : marque l'inscription comme expirée (expired_at = aujourd'hui).
 * Si `terminer_groupes` est vrai, clôture aussi (end_date = aujourd'hui)
 * les relations de groupe actives de la même langue.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("admin", "manager");
    const { id } = await params;
    const inscription = await chargerInscription(id);

    if (inscription.expired_at) {
      throw new ApiError(409, "Cette inscription est déjà expirée.");
    }

    const body = (await req.json().catch(() => ({}))) as {
      terminer_groupes?: boolean;
    };
    const terminer = Boolean(body.terminer_groupes);
    const aujourdHui = todayStr();

    const { inscriptions, etudiants_groupes } = await getCollections();

    await inscriptions.updateOne(
      { _id: inscription._id },
      { $set: { expired_at: aujourdHui, updated_at: new Date() } }
    );

    let groupesTermines = 0;
    if (terminer) {
      const res = await etudiants_groupes.updateMany(
        {
          etudiant_id: inscription.etudiant_id,
          langue_id: inscription.langue_id,
          end_date: null,
          deleted_at: null,
        } as Filter<EtudiantGroupeDoc>,
        { $set: { end_date: aujourdHui, updated_at: new Date() } }
      );
      groupesTermines = res.modifiedCount;
    }

    await logAudit({
      user,
      action: "modifier",
      ressource: "inscriptions",
      ressource_id: id,
      details: `Inscription de ${inscription.etudiant_name} (${inscription.langue_name}) marquée expirée au ${aujourdHui}${terminer ? ` — ${groupesTermines} relation(s) de groupe terminée(s).` : " — relations de groupe conservées."}`,
    });

    return NextResponse.json({ ok: true, groupes_termines: groupesTermines });
  } catch (e) {
    return handleApiError(e);
  }
}
