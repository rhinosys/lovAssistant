import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { authService, AuthorizationError, requireAdmin } from "../auth/session";
import { SessionUser } from "../auth/types";
import { logger } from "../observability/logger";
import { SecretKeyMissingError } from "./secrets";
import { FramateamAuthError, FramateamMfaRequiredError, FramateamApiError } from "../framateam/client";
import { FramateamNotConfiguredError } from "../framateam/sync";
import { SyncBusyError } from "../framateam/store";
import { ChannelNotFoundError, InvalidPostReferenceError } from "../framateam/privacy";

export const adminError = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

// Mutations ride on the SSO cookie: refuse cross-site requests (CSRF).
const sameOrigin = (req: NextRequest): boolean => {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get("host"); } catch { return false; }
};

type Handler<C> = (req: NextRequest, user: SessionUser, context: C) => Promise<Response>;

// Authenticates, enforces the admin role server-side and maps known errors to JSON responses.
export function withAdmin<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, context: C): Promise<Response> => {
    let user: SessionUser | null = null;
    try {
      user = await authService.authenticateRequest(req.headers);
      requireAdmin(user);
      if (req.method !== "GET" && !sameOrigin(req)) return adminError(403, "FORBIDDEN", "Origine de la requête refusée.");
      return await handler(req, user, context);
    } catch (error) {
      if (error instanceof AuthorizationError) return adminError(403, "FORBIDDEN", error.message);
      if (error instanceof ZodError) return adminError(400, "VALIDATION_ERROR", error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "));
      if (error instanceof SyntaxError) return adminError(400, "BAD_REQUEST", "Corps de requête JSON invalide");
      if (error instanceof SecretKeyMissingError) return adminError(500, "ENCRYPTION_KEY_MISSING", error.message);
      if (error instanceof FramateamNotConfiguredError) return adminError(400, "FRAMATEAM_NOT_CONFIGURED", error.message);
      if (error instanceof FramateamMfaRequiredError) return adminError(400, "FRAMATEAM_MFA_REQUIRED", error.message);
      if (error instanceof FramateamAuthError) return adminError(400, "FRAMATEAM_AUTH_FAILED", error.message);
      if (error instanceof FramateamApiError) return adminError(502, "FRAMATEAM_API_ERROR", error.message);
      if (error instanceof SyncBusyError) return adminError(409, "SYNC_BUSY", error.message);
      if (error instanceof InvalidPostReferenceError) return adminError(400, "INVALID_POST_REFERENCE", error.message);
      if (error instanceof ChannelNotFoundError) return adminError(404, "CHANNEL_NOT_FOUND", error.message);
      logger.error("Admin endpoint failure", { path: req.nextUrl.pathname, user: user?.username, error: String(error) });
      return adminError(500, "INTERNAL_ERROR", "Erreur interne de l'administration");
    }
  };
}
