import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";
import { forgetSchema } from "@/server/admin/framateam-admin";
import { createThreadRebuilder, forgetChannel, forgetPost } from "@/server/framateam/privacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req, user) => {
  const input = forgetSchema.parse(await req.json());
  if ("post" in input) {
    const result = await forgetPost(input.post, { by: user.username, rebuild: await createThreadRebuilder() });
    return NextResponse.json({ post: result });
  }
  const { channel, removedChunks } = await forgetChannel(input.channel, { by: user.username });
  return NextResponse.json({ channel: { channelId: channel.channelId, name: channel.name }, removedChunks });
});
