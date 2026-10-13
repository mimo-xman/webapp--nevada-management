import { NextRequest, NextResponse } from "next/server";
import { ObjectId, type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { todayStr } from "@/lib/format";
import type { InscriptionDoc, PaiementDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Candidat {
  inscription_id: string;
  etudiant_id: string;
  etudiant_name: string;
  langue_id: string;
  langue_name: string;
  start_date: string;
  montant: number;
}

/**
 * Règle métier (conception) : le bouton d'analyse prend toutes les
 * inscriptions ACTIVES (expired_at: null) dont start_date = aujourd'hui
 * et qui n'ont pas encore de paiement à la date du jour, puis crée un
 * paiement « en attente » pour chacune.
 */
async function analyser(): Promise<Candidat[]> {
  const { inscriptions, paiements } = await getCollections();
  const aujourdHui = todayStr();

  const candidats = await inscriptions
    .find({
      expired_at: null,
      start_date: aujourdHui,
      deleted_at: null,
    } as Filter<InscriptionDoc>)
    .toArray();

  if (candidats.length === 0) return [];

  const ids = candidats.map((c) => c._id);
  const dejaPayes = new Set(
    (
      await paiements
        .find({
          inscription_id: { $in: ids },
          date: aujourdHui,
          deleted_at: null,
        } as Filter<PaiementDoc>)
        .project({ inscription_id: 1 })
        .toArray()
    ).map((p) => p.inscription_id.toString())
  );

  return candidats
    .filter((c) => !dejaPayes.has(c._id.toString()))
    .map((c) => ({
      inscription_id: c._id.toString(),
      etudiant_id: c.etudiant_id.toString(),
      etudiant_name: c.etudiant_name,
      langue_id: c.langue_id.toString(),
      langue_name: c.langue_name,
      start_date: c.start_date,
      montant: c.price,
    }));
}

/** GET : aperçu de l'analyse (combien de paiements seraient créés). */
export async function GET() {
  try {
    await requireUser();
    const candidats = await analyser();
    return NextResponse.json({
      date: todayStr(),
      candidats,
      total: candidats.length,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST : exécute la génération des paiements du jour (statut « en attente »). */
export async function POST() {
  try {
    const user = await requireUser();
    const candidats = await analyser();

    if (candidats.length === 0) {
      return NextResponse.json({ creees: 0, date: todayStr() });
    }

    const { paiements } = await getCollections();
    const aujourdHui = todayStr();
    const now = new Date();

    await paiements.insertMany(
      candidats.map((c) => ({
        inscription_id: new ObjectId(c.inscription_id),
        date: aujourdHui,
        status: "en_attente" as const,
        montant: c.montant,
        etudiant_id: new ObjectId(c.etudiant_id),
        etudiant_name: c.etudiant_name,
        langue_id: new ObjectId(c.langue_id),
        langue_name: c.langue_name,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }))
    );

    await logAudit({
      user,
      action: "creer",
      ressource: "paiements_generation",
      details: `Génération automatique : ${candidats.length} paiement(s) « en attente » créé(s) pour les inscriptions du ${aujourdHui}.`,
    });

    return NextResponse.json({ creees: candidats.length, date: aujourdHui });
  } catch (e) {
    return handleApiError(e);
  }
}
