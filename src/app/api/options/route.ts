import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { todayStr } from "@/lib/format";
import type {
  EtudiantDoc,
  ProfDoc,
  LangueDoc,
  NiveauDoc,
  GroupeDoc,
  InscriptionDoc,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Options légères pour les listes déroulantes des formulaires :
 * ?type=etudiants|profs|langues|niveaux|groupes|inscriptions_actives
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const type = new URL(req.url).searchParams.get("type");
    const {
      etudiants,
      profs,
      langues,
      niveaux,
      groupes,
      inscriptions,
    } = await getCollections();

    switch (type) {
      case "etudiants": {
        const docs = await etudiants
          .find({ deleted_at: null } as Filter<EtudiantDoc>)
          .project({ first_name: 1, last_name: 1 })
          .sort({ last_name: 1, first_name: 1 })
          .limit(1000)
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: `${d.last_name} ${d.first_name}`,
          })),
        });
      }
      case "profs": {
        const docs = await profs
          .find({ deleted_at: null } as Filter<ProfDoc>)
          .project({ first_name: 1, last_name: 1 })
          .sort({ last_name: 1 })
          .limit(1000)
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: `${d.last_name} ${d.first_name}`,
          })),
        });
      }
      case "langues": {
        const docs = await langues
          .find({ deleted_at: null } as Filter<LangueDoc>)
          .project({ name: 1 })
          .sort({ name: 1 })
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: d.name,
          })),
        });
      }
      case "niveaux": {
        const docs = await niveaux
          .find({ deleted_at: null } as Filter<NiveauDoc>)
          .project({ name: 1 })
          .sort({ name: 1 })
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: d.name,
          })),
        });
      }
      case "groupes": {
        const docs = await groupes
          .find({ deleted_at: null } as Filter<GroupeDoc>)
          .project({ langue_name: 1, niveau_name: 1, start_date: 1, end_date: 1, prof_name: 1 })
          .sort({ start_date: -1 })
          .limit(1000)
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: `${d.langue_name} · ${d.niveau_name} — ${d.prof_name}${d.end_date ? " (terminé)" : ""}`,
          })),
        });
      }
      case "inscriptions_actives": {
        const docs = await inscriptions
          .find({
            expired_at: null,
            deleted_at: null,
            start_date: { $lte: todayStr() },
          } as Filter<InscriptionDoc>)
          .project({ etudiant_name: 1, langue_name: 1, niveaux: 1, price: 1, start_date: 1 })
          .sort({ etudiant_name: 1 })
          .limit(1000)
          .toArray();
        return NextResponse.json({
          options: docs.map((d) => ({
            value: d._id.toString(),
            label: `${d.etudiant_name} — ${d.langue_name} ${d.niveaux.map((n) => n.name).join("+")} (${d.price} DH)`,
          })),
        });
      }
      default:
        throw new ApiError(400, "Type d'options inconnu.");
    }
  } catch (e) {
    return handleApiError(e);
  }
}
