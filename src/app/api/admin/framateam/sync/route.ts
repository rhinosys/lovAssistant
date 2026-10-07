import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";
import { startSync, syncStatus } from "@/server/admin/framateam-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => NextResponse.json({ sync: await syncStatus() }));

export const POST = withAdmin(async (_req, user) => NextResponse.json({ sync: await startSync(user.username) }, { status: 202 }));
