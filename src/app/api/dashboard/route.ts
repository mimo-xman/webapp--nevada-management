import { NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError } from "@/lib/auth";
import { todayStr, fmtMois } from "@/lib/format";
import type {
  InscriptionDoc,
  GroupeDoc,
  ProfDoc,
  PaiementDoc,
  AuditDoc,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const {
      etudiants,
      profs,
      groupes,
      inscriptions,
      paiements,
      audits,
      langues,
    } = await getCollections();

    const aujourdHui = todayStr();
    const moisCourant = aujourdHui.slice(0, 7);

    // 4 indicateurs principaux
    const [inscriptionsActives, nbProfs, nbGroupesActifs, encaisseAgg, attenteAgg] =
      await Promise.all([
        inscriptions.countDocuments({ expired_at: null, deleted_at: null } as Filter<InscriptionDoc>),
        profs.countDocuments({ deleted_at: null } as Filter<ProfDoc>),
        groupes.countDocuments({ end_date: null, deleted_at: null } as Filter<GroupeDoc>),
        paiements
          .aggregate<{ total: number }>([
            { $match: { deleted_at: null, status: "payer", date: { $regex: `^${moisCourant}` } } },
            { $group: { _id: null, total: { $sum: "$montant" } } },
          ])
          .toArray(),
        paiements
          .aggregate<{ total: number }>([
            { $match: { deleted_at: null, status: "en_attente" } },
            { $group: { _id: null, total: { $sum: "$montant" } } },
          ])
          .toArray(),
      ]);

    // Étudiants distincts ayant au moins une inscription active.
    const etudiantsActifs = (
      await inscriptions.distinct("etudiant_id", {
        expired_at: null,
        deleted_at: null,
      } as Filter<InscriptionDoc>)
    ).length;

    // Encaissé sur les 6 derniers mois (barres du tableau de bord).
    const sixMois: string[] = [];
    const [y, m] = moisCourant.split("-").map((x) => parseInt(x, 10));
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      sixMois.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      );
    }
    const parMoisAgg = await paiements
      .aggregate<{ _id: string; total: number }>([
        {
          $match: {
            deleted_at: null,
            status: "payer",
            date: { $gte: sixMois[0] + "-01", $lte: sixMois[5] + "-31" },
          },
        },
        { $group: { _id: { $substr: ["$date", 0, 7] }, total: { $sum: "$montant" } } },
      ])
      .toArray();
    const parMois = sixMois.map((mois) => ({
      mois,
      label: fmtMois(mois),
      total: parMoisAgg.find((x) => x._id === mois)?.total || 0,
    }));

    // Dernières inscriptions (5).
    const dernieresInscriptions = await inscriptions
      .find({ deleted_at: null } as Filter<InscriptionDoc>)
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    // Paiements du jour déjà créés ?
    const paiementsJour = await paiements.countDocuments({
      date: aujourdHui,
      deleted_at: null,
    } as Filter<PaiementDoc>);

    // Derniers audits (admin uniquement).
    const derniersAudits =
      user.role === "admin"
        ? (
            await audits
              .find({ deleted_at: null } as Filter<AuditDoc>)
              .sort({ created_at: -1 })
              .limit(5)
              .toArray()
          ).map((a) => ({
            _id: a._id.toString(),
            username: a.username,
            action: a.action,
            details: a.details,
            created_at: a.created_at,
          }))
        : [];

    // Langues actives pour le sélecteur rapide.
    const nbLangues = await langues.countDocuments({ deleted_at: null });

    return NextResponse.json({
      aujourdhui: aujourdHui,
      stats: {
        etudiants_actifs: etudiantsActifs,
        inscriptions_actives: inscriptionsActives,
        profs: nbProfs,
        groupes_actifs: nbGroupesActifs,
        langues: nbLangues,
        encaisse_mois: encaisseAgg[0]?.total || 0,
        en_attente: attenteAgg[0]?.total || 0,
        paiements_jour: paiementsJour,
      },
      parMois,
      dernieresInscriptions: dernieresInscriptions.map((i) => ({
        _id: i._id.toString(),
        etudiant_name: i.etudiant_name,
        langue_name: i.langue_name,
        niveaux: i.niveaux.map((n) => n.name),
        price: i.price,
        start_date: i.start_date,
        expired_at: i.expired_at,
        created_at: i.created_at,
      })),
      derniersAudits,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
