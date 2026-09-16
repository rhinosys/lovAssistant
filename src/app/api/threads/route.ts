import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/server/auth/session";
import { getThreadRepository } from "@/server/persistence";
import { logger } from "@/server/observability/logger";

const createThreadSchema = z.object({
  title: z.string().max(255).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;
  try {
    const user = await authService.authenticateRequest(req.headers);
    const threadRepo = getThreadRepository();
    const threads = await threadRepo.listByUserId(user.id);

    return NextResponse.json({
      threads: threads.map((t) => ({
        id: t.id,
        userId: t.userId,
        title: t.title,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    logger.error("Failed to list threads", { requestId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list threads" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;
  try {
    const user = await authService.authenticateRequest(req.headers);
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed
    }

    const parseResult = createThreadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parseResult.error.message } },
        { status: 400 }
      );
    }

    const threadRepo = getThreadRepository();
    const thread = await threadRepo.create({
      userId: user.id,
      title: parseResult.data.title || "Nouvelle conversation",
    });

    logger.info("Thread created", { requestId, userId: user.id, threadId: thread.id });

    return NextResponse.json(
      {
        thread: {
          id: thread.id,
          userId: thread.userId,
          title: thread.title,
          createdAt: thread.createdAt.toISOString(),
          updatedAt: thread.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    logger.error("Failed to create thread", { requestId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create thread" } },
      { status: 500 }
    );
  }
}
