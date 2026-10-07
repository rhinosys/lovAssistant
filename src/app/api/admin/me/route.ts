import { NextResponse } from "next/server";
import { withAdmin } from "@/server/admin/http";

export const dynamic = "force-dynamic";

// 200 for admins, 403 otherwise: lets the UI decide whether to show the admin link.
export const GET = withAdmin(async (_req, user) => NextResponse.json({ username: user.username, roles: user.roles }));
