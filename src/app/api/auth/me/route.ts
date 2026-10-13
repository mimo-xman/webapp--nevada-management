import { NextResponse } from "next/server";
import { getSessionUser, handleApiError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    return NextResponse.json({ user });
  } catch (e) {
    return handleApiError(e);
  }
}
