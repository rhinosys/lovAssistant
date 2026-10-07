import crypto from "crypto";
import { getConfig } from "../config";
import { getUserRepository } from "../persistence";
import { SessionUser, AuthSession } from "./types";

export class AuthenticationError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface IAuthService {
  createSessionToken(user: SessionUser, ttlSeconds?: number): string;
  verifySessionToken(token: string): AuthSession | null;
  authenticateRequest(headers: Headers | Record<string, string | string[] | undefined>): Promise<SessionUser>;
}

const readHeader = (headers: Headers | Record<string, string | string[] | undefined>, name: string): string | null => {
  if (headers instanceof Headers) return headers.get(name);
  const val = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(val)) return val[0] || null;
  return typeof val === "string" ? val : null;
};

// Admin role sources:
// - YunoHost: SSOwat only lets members of the `admin` permission reach /admin and /api/admin, where
//   nginx sets X-Lov-Admin: 1 (and strips it everywhere else). Trusted only when the package says so.
// - Development: ADMIN_USERS, never in production.
const withAdminRole = (
  user: SessionUser,
  headers: Headers | Record<string, string | string[] | undefined>
): SessionUser => {
  const config = getConfig();
  const fromProxy = config.TRUST_PROXY_ADMIN_HEADER && readHeader(headers, "x-lov-admin") === "1";
  const fromDevList = config.NODE_ENV !== "production" && config.ADMIN_USERS.includes(user.username);
  if ((fromProxy || fromDevList) && !user.roles.includes("admin")) {
    return { ...user, roles: [...user.roles, "admin"] };
  }
  return user;
};

export const isAdmin = (user: SessionUser): boolean => user.roles.includes("admin");

export function requireAdmin(user: SessionUser): void {
  if (!isAdmin(user)) throw new AuthorizationError("Accès réservé aux administrateurs");
}

export class TokenAuthService implements IAuthService {
  private getSecret(): string {
    return getConfig().SESSION_SECRET;
  }

  createSessionToken(user: SessionUser, ttlSeconds = 86400 * 7): string {
    const now = Math.floor(Date.now() / 1000);
    const session: AuthSession = {
      user,
      issuedAt: now,
      expiresAt: now + ttlSeconds,
    };

    const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.getSecret())
      .update(payload)
      .digest("base64url");

    return `${payload}.${signature}`;
  }

  verifySessionToken(token: string): AuthSession | null {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", this.getSecret())
      .update(payload)
      .digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
      const now = Math.floor(Date.now() / 1000);
      if (decoded.expiresAt < now) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  async authenticateRequest(headers: Headers | Record<string, string | string[] | undefined>): Promise<SessionUser> {
    const user = await this.resolveUser(headers);
    return withAdminRole(user, headers);
  }

  private async resolveUser(headers: Headers | Record<string, string | string[] | undefined>): Promise<SessionUser> {
    const getHeader = (name: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(name);
      }
      const val = headers[name.toLowerCase()] ?? headers[name];
      if (Array.isArray(val)) return val[0] || null;
      return typeof val === "string" ? val : null;
    };

    // 1. Check Authorization header
    const authHeader = getHeader("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const session = this.verifySessionToken(token);
      if (session) return session.user;
    }

    // 2. Check cookie
    const cookieHeader = getHeader("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      const sessionCookie = cookies.find((c) => c.startsWith("session="));
      if (sessionCookie) {
        const token = sessionCookie.substring(8);
        const session = this.verifySessionToken(token);
        if (session) return session.user;
      }
    }

    // 3. YunoHost SSO (SSOwat) headers — takes priority over the legacy dev fallback
    // SECURITY: these headers are only trustworthy behind a reverse proxy (e.g. YunoHost's
    // SSOwat) that strips any client-supplied Remote-User/Auth-User before proxying. Never
    // expose this app directly to untrusted clients without such a proxy in front of it.
    const remoteUser = getHeader("remote-user") || getHeader("auth-user");
    if (remoteUser) {
      const userRepo = getUserRepository();
      const user = await userRepo.createOrFind(remoteUser);
      return {
        id: user.id,
        username: user.username,
        roles: ["member"],
      };
    }

    // 4. PoC Dev fallback: x-user-id / x-username for easy lab testing
    const explicitUserId = getHeader("x-user-id");
    const explicitUsername = getHeader("x-username");
    if (explicitUsername || explicitUserId) {
      const userRepo = getUserRepository();
      const username = explicitUsername || `user_${explicitUserId?.substring(0, 8)}`;
      const user = await userRepo.createOrFind(username);
      return {
        id: explicitUserId || user.id,
        username: user.username,
        roles: ["member"],
      };
    }

    // Default guest/anonymous session for local prototype if allowed, otherwise throw
    const defaultUser = await getUserRepository().createOrFind("fablab_member");
    return {
      id: defaultUser.id,
      username: defaultUser.username,
      roles: ["member"],
    };
  }
}

export const authService: IAuthService = new TokenAuthService();
