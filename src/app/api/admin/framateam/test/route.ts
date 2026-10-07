import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";
import { testConnection } from "@/server/admin/framateam-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdmin(async () => NextResponse.json(await testConnection()));
