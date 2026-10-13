import { ObjectId } from "mongodb";
import { getCollections } from "./mongo";
import { ACTION_LABELS, RESSOURCE_LABELS } from "./labels";
import type { AuditAction, SessionUser } from "./types";

export { ACTION_LABELS, RESSOURCE_LABELS };

/** Enregistre une trace d'activité (collection audits). Ne lève jamais d'erreur. */
export async function logAudit(params: {
  user?: SessionUser | null;
  action: AuditAction;
  ressource: string;
  ressource_id?: string | null;
  details: string;
}): Promise<void> {
  try {
    if (!(params.action in ACTION_LABELS)) return;
    const { audits } = await getCollections();
    const now = new Date();
    await audits.insertOne({
      _id: new ObjectId(),
      user_id: ObjectId.isValid(params.user?.id || "")
        ? new ObjectId(params.user!.id)
        : new ObjectId(),
      username: params.user?.username || "système",
      action: params.action,
      ressource: params.ressource,
      ressource_id: params.ressource_id || null,
      details: params.details,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  } catch (e) {
    console.error("[audit] échec de journalisation", e);
  }
}
