import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService, AuthorizationError } from "@/server/auth/session";
import { assertThreadOwnership, ThreadNotFoundError } from "@/server/chat/ownership";
import { getThreadRepository, getMessageRepository } from "@/server/persistence";
import { logger } from "@/server/observability/logger";

const updateThreadSchema = z.object({
  title: z.string().min(1).max(255),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: threadId } = await params;
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;

  try {
    const user = await authService.authenticateRequest(req.headers);
    const thread = await assertThreadOwnership(user.id, threadId);

    const messageRepo = getMessageRepository();
    const messages = await messageRepo.listByThreadId(thread.id);

    return NextResponse.json({
      thread: {
        id: thread.id,
        userId: thread.userId,
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
      },
      messages: messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof ThreadNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }
    logger.error("Failed to fetch thread", { requestId, threadId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch thread" } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: threadId } = await params;
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;

  try {
    const user = await authService.authenticateRequest(req.headers);
    await assertThreadOwnership(user.id, threadId);

    const body = await req.json();
    const parseResult = updateThreadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parseResult.error.message } },
        { status: 400 }
      );
    }

    const threadRepo = getThreadRepository();
    const updated = await threadRepo.updateTitle(threadId, parseResult.data.title);

    logger.info("Thread title updated", { requestId, userId: user.id, threadId });

    return NextResponse.json({
      thread: updated
        ? {
            id: updated.id,
            userId: updated.userId,
            title: updated.title,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof ThreadNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }
    logger.error("Failed to update thread", { requestId, threadId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update thread" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: threadId } = await params;
  const requestId = req.headers.get("x-request-id") || `req_${Date.now()}`;

  try {
    const user = await authService.authenticateRequest(req.headers);
    await assertThreadOwnership(user.id, threadId);

    const threadRepo = getThreadRepository();
    const messageRepo = getMessageRepository();

    await messageRepo.deleteByThreadId(threadId);
    await threadRepo.delete(threadId);

    logger.info("Thread deleted", { requestId, userId: user.id, threadId });

    return NextResponse.json({ success: true, threadId });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 }
      );
    }
    if (err instanceof ThreadNotFoundError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 }
      );
    }
    logger.error("Failed to delete thread", { requestId, threadId, error: String(err) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete thread" } },
      { status: 500 }
    );
  }
}
