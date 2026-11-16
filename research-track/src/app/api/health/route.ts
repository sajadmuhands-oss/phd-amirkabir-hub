import { NextResponse } from "next/server";

/** Public liveness only — no database probe or internal metadata. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
