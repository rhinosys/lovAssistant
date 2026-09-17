import { NextRequest, NextResponse } from "next/server";
import { RefreshBusyError, startRagRefresh } from "@/server/rag/maintenance/refresh";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (process.env.RAG_REFRESH_ENABLED !== "true") {
    return NextResponse.json({ error: "La mise à jour manuelle doit être activée par l’administrateur." }, { status: 403 });
  }
  // This maintenance route must also be restricted by the deployment's access control.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost: string | undefined;
  try { originHost = origin ? new URL(origin).host : undefined; } catch { /* Invalid origin. */ }
  if (!originHost || originHost !== host) {
    return NextResponse.json({ error: "Origine de la requête refusée." }, { status: 403 });
  }
  try {
    const { completion } = await startRagRefresh();
    void completion.catch(() => { /* Failure is logged and persisted by the runner. */ });
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof RefreshBusyError ? "Une mise à jour est déjà en cours." : "Impossible de lancer la mise à jour." }, { status: error instanceof RefreshBusyError ? 409 : 500 });
  }
}
