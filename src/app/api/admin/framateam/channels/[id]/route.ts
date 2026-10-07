import { NextResponse } from "next/server";
import { adminError, withAdmin } from "@/server/admin/http";
import { channelPatchSchema, updateChannel } from "@/server/admin/framateam-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = withAdmin<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const channel = await updateChannel(id, channelPatchSchema.parse(await req.json()), user.username);
  return channel ? NextResponse.json({ channel }) : adminError(404, "CHANNEL_NOT_FOUND", "Canal introuvable");
});
