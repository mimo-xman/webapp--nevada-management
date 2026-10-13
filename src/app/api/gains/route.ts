import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections, oid } from "@/lib/mongo";
import { requireRole, handleApiError, ApiError } from "@/lib/auth";
import type { PaiementDoc, StatutPaiement } from "@/lib/types";

export const dynamic = "force-dynamic";

interface AgregatStatut {
  payer: number;
  en_attente: number;
  annuler: number;
}

function agVide(): AgregatStatut {
  return { payer: 0, en_attente: 0, annuler: 0 };
}

/**
 * Page Gains (manager + admin) : synthèse financière annuelle.
 * - totaux par statut
 * - répartition par mois (graphique)
 * - répartition par langue (tableau)
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("admin", "manager");
    const sp = new URL(req.url).searchParams;

    const anneeBrute = parseInt(sp.get("annee") || "", 10);
    const annee =
      Number.isFinite(anneeBrute) && anneeBrute >= 2020 && anneeBrute <= 2100
        ? anneeBrute
        : new Date().getFullYear();

    const langueId = oid(sp.get("langue_id") || "");
    if (sp.get("langue_id") && !langueId) {
      throw new ApiError(400, "Langue invalide.");
    }

    const { paiements, langues } = await getCollections();

    const match: Record<string, unknown> = {
      deleted_at: null,
      date: {
        $gte: `${annee}-01-01`,
        $lte: `${annee}-12-31`,
      },
    };
    if (langueId) match.langue_id = langueId;

    const agg = await paiements
      .aggregate<{
        _id: { mois: string; status: StatutPaiement; langue_name: string; langue_id: ObjectId };
        total: number;
        nb: number;
      }>([
        { $match: match as never },
        {
          $group: {
            _id: {
              mois: { $substr: ["$date", 0, 7] },
              status: "$status",
              langue_name: "$langue_name",
              langue_id: "$langue_id",
            },
            total: { $sum: "$montant" },
            nb: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Totaux généraux
    const totaux = agVide();
    let nbPayes = 0;

    // Par mois (12 mois)
    const parMois: { mois: string; paye: number; attente: number; annule: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      parMois.push({
        mois: `${annee}-${String(m).padStart(2, "0")}`,
        paye: 0,
        attente: 0,
        annule: 0,
      });
    }

    // Par langue
    const parLangueMap = new Map<string, { langue_id: string; langue_name: string } & AgregatStatut & { nb_payes: number }>();

    for (const ligne of agg) {
      const { mois, status, langue_name, langue_id } = ligne._id;
      totaux[status] += ligne.total;
      if (status === "payer") nbPayes += ligne.nb;

      const entreeMois = parMois.find((m) => m.mois === mois);
      if (entreeMois) {
        if (status === "payer") entreeMois.paye += ligne.total;
        else if (status === "en_attente") entreeMois.attente += ligne.total;
        else entreeMois.annule += ligne.total;
      }

      const cle = langue_id.toString();
      let entreeLangue = parLangueMap.get(cle);
      if (!entreeLangue) {
        entreeLangue = {
          langue_id: cle,
          langue_name: langue_name,
          ...agVide(),
          nb_payes: 0,
        };
        parLangueMap.set(cle, entreeLangue);
      }
      entreeLangue[status] += ligne.total;
      if (status === "payer") entreeLangue.nb_payes += ligne.nb;
    }

    // Liste complète des langues actives (pour le filtre).
    const listeLangues = await langues
      .find({ deleted_at: null })
      .project({ _id: 1, name: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({
      annee,
      totaux: { ...totaux, nb_payes: nbPayes },
      parMois,
      parLangue: [...parLangueMap.values()].sort((a, b) =>
        a.langue_name.localeCompare(b.langue_name)
      ),
      langues: listeLangues.map((l) => ({
        _id: l._id.toString(),
        name: l.name,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
