import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";
import { readSettings, settingsSchema, writeSettings } from "@/server/admin/framateam-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => NextResponse.json({ settings: await readSettings() }));

export const PUT = withAdmin(async (req, user) => {
  const input = settingsSchema.parse(await req.json());
  return NextResponse.json({ settings: await writeSettings(input, user.username) });
});
