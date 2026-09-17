import { NextResponse } from "next/server";
import { getRagStatus } from "@/server/rag/maintenance/refresh";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getRagStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Impossible de lire l’état du RAG." }, { status: 500 }); }
}
