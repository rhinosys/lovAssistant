import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";
import { listChannels } from "@/server/admin/framateam-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ?refresh=1 asks Framateam for the current list of public channels first.
export const GET = withAdmin(async (req) =>
  NextResponse.json({ channels: await listChannels({ refresh: req.nextUrl.searchParams.get("refresh") === "1" }) })
);
