import { NextRequest, NextResponse } from "next/server";
import { type Filter } from "mongodb";
import { getCollections } from "@/lib/mongo";
import { requireRole, handleApiError } from "@/lib/auth";
import { parseListParams, qFilter, sortStage, paginate } from "@/lib/list";
import { ACTION_LABELS, RESSOURCE_LABELS } from "@/lib/audit";
import type { AuditDoc, AuditAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORTS = ["created_at", "username", "action", "ressource"];

export async function GET(req: NextRequest) {
  try {
    await requireRole("admin");
    const sp = new URL(req.url).searchParams;
    const p = parseListParams(sp, SORTS, "created_at", "desc");
    const { audits } = await getCollections();

    const base: Filter<AuditDoc> = { deleted_at: null };
    const qf = qFilter(["username", "details"], p.q);
    if (qf) Object.assign(base, qf);

    const action = sp.get("action");
    if (action && action in ACTION_LABELS) base.action = action as AuditAction;

    const ressource = sp.get("ressource");
    if (ressource && ressource in RESSOURCE_LABELS) base.ressource = ressource;

    const total = await audits.countDocuments(base);
    const docs = await audits
      .find(base, { sort: sortStage(p.sort, p.dir), skip: p.skip, limit: p.limit })
      .toArray();

    const data = docs.map((d) => ({
      _id: d._id.toString(),
      username: d.username,
      action: d.action,
      ressource: d.ressource,
      ressource_id: d.ressource_id,
      details: d.details,
      created_at: d.created_at,
    }));

    return NextResponse.json(paginate(data, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}
