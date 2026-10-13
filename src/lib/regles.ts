import { ObjectId, type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { ApiError } from "@/lib/auth";
import type { InscriptionDoc, EtudiantGroupeDoc, GroupeDoc } from "@/lib/types";

/**
 * Règle métier (conception) : un étudiant ne peut avoir qu'UNE inscription
 * active (expired_at: null) par langue ET par niveau.
 * Vérifiée à la création et à la modification.
 */
export async function verifierUniciteInscription(opts: {
  etudiant_id: ObjectId;
  langue_id: ObjectId;
  niveau_ids: ObjectId[];
  exclureId?: ObjectId;
}): Promise<void> {
  const { inscriptions } = await getCollections();
  const actives = await inscriptions
    .find({
      etudiant_id: opts.etudiant_id,
      langue_id: opts.langue_id,
      expired_at: null,
      deleted_at: null,
      ...(opts.exclureId ? { _id: { $ne: opts.exclureId } } : {}),
    } as Filter<InscriptionDoc>)
    .toArray();

  const chaineNiveaux = new Set(opts.niveau_ids.map((n) => n.toString()));
  for (const active of actives) {
    for (const nid of active.niveau_ids) {
      if (chaineNiveaux.has(nid.toString())) {
        throw new ApiError(
          409,
          "Cet étudiant a déjà une inscription active pour cette langue et ce niveau. Marquez d'abord l'inscription existante comme expirée."
        );
      }
    }
  }
}

/**
 * Règle métier (conception) : un étudiant ne peut être que dans UN groupe
 * actif (end_date: null) par langue. Vérifiée à la création et à la
 * modification d'une relation étudiant-groupe.
 */
export async function verifierUniciteGroupeLangue(opts: {
  etudiant_id: ObjectId;
  langue_id: ObjectId;
  exclureId?: ObjectId;
}): Promise<void> {
  const { etudiants_groupes, groupes } = await getCollections();

  // Groupes de la même langue où l'étudiant a une relation active.
  const groupesMemeLangue = await groupes
    .find({ langue_id: opts.langue_id, deleted_at: null } as Filter<GroupeDoc>)
    .project({ _id: 1 })
    .toArray();
  const idsGroupes = groupesMemeLangue.map((g) => g._id);
  if (idsGroupes.length === 0) return;

  const relationActive = await etudiants_groupes.findOne({
    etudiant_id: opts.etudiant_id,
    groupe_id: { $in: idsGroupes },
    end_date: null,
    deleted_at: null,
    ...(opts.exclureId ? { _id: { $ne: opts.exclureId } } : {}),
  } as Filter<EtudiantGroupeDoc>);

  if (relationActive) {
    throw new ApiError(
      409,
      "Cet étudiant est déjà dans un groupe actif pour cette langue. Terminez d'abord la relation existante."
    );
  }
}

/**
 * Règle métier (conception) : une inscription ne peut avoir qu'un
 * paiement par date.
 */
export async function verifierPaiementUnique(opts: {
  inscription_id: ObjectId;
  date: string;
  exclureId?: ObjectId;
}): Promise<void> {
  const { paiements } = await getCollections();
  const existant = await paiements.findOne({
    inscription_id: opts.inscription_id,
    date: opts.date,
    deleted_at: null,
    ...(opts.exclureId ? { _id: { $ne: opts.exclureId } } : {}),
  });
  if (existant) {
    throw new ApiError(
      409,
      "Un paiement existe déjà pour cette inscription à cette date."
    );
  }
}
