import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TokenAuthService, AuthorizationError, requireAdmin } from "./session";
import { resetConfigCache } from "../config";
import { assertThreadOwnership, ThreadNotFoundError } from "../chat/ownership";
import {
  setForceInMemoryRepositories,
  getUserRepository,
  getThreadRepository,
} from "../persistence";

describe("Authentication & User Isolation", () => {
  const authService = new TokenAuthService();

  beforeEach(() => {
    setForceInMemoryRepositories(true);
  });

  describe("Session Tokens", () => {
    it("creates and verifies valid session tokens", () => {
      const user = { id: "usr-123", username: "alice", roles: ["admin"] };
      const token = authService.createSessionToken(user, 3600);

      const session = authService.verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("usr-123");
      expect(session?.user.username).toBe("alice");
      expect(session?.user.roles).toContain("admin");
    });

    it("rejects tampered tokens", () => {
      const user = { id: "usr-123", username: "alice", roles: ["member"] };
      const token = authService.createSessionToken(user);

      const parts = token.split(".");
      const tampered = `${parts[0]}xyz.${parts[1]}`;
      expect(authService.verifySessionToken(tampered)).toBeNull();
    });

    it("rejects expired tokens", () => {
      const user = { id: "usr-123", username: "alice", roles: ["member"] };
      // Expired 10 seconds ago
      const token = authService.createSessionToken(user, -10);
      expect(authService.verifySessionToken(token)).toBeNull();
    });
  });

  describe("Server-side Thread Ownership Isolation", () => {
    it("allows the thread owner to access their thread", async () => {
      const userRepo = getUserRepository();
      const threadRepo = getThreadRepository();

      const userA = await userRepo.createOrFind("user_a");
      const threadA = await threadRepo.create({ userId: userA.id, title: "Projet A" });

      const authorized = await assertThreadOwnership(userA.id, threadA.id);
      expect(authorized.id).toBe(threadA.id);
      expect(authorized.userId).toBe(userA.id);
    });

    it("strictly blocks User B from accessing User A's thread", async () => {
      const userRepo = getUserRepository();
      const threadRepo = getThreadRepository();

      const userA = await userRepo.createOrFind("user_a");
      const userB = await userRepo.createOrFind("user_b");

      const threadA = await threadRepo.create({ userId: userA.id, title: "Secret User A" });

      await expect(assertThreadOwnership(userB.id, threadA.id)).rejects.toThrow(
        AuthorizationError
      );
    });

    it("throws ThreadNotFoundError when thread does not exist", async () => {
      await expect(
        assertThreadOwnership("any-user", "non-existent-thread-id")
      ).rejects.toThrow(ThreadNotFoundError);
    });
  });

  describe("YunoHost SSO headers", () => {
    it("authenticates from the Remote-User header when present", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("falls back to Auth-User when Remote-User is absent", async () => {
      const user = await authService.authenticateRequest({
        "auth-user": "bob.ynh",
      });
      expect(user.username).toBe("bob.ynh");
    });

    it("prefers Remote-User over Auth-User when both are present", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
        "auth-user": "bob.ynh",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("prefers Remote-User over the legacy x-username fallback", async () => {
      const user = await authService.authenticateRequest({
        "remote-user": "alice.ynh",
        "x-username": "legacy-user",
      });
      expect(user.username).toBe("alice.ynh");
    });

    it("still supports the legacy x-username header when no SSO header is present", async () => {
      const user = await authService.authenticateRequest({
        "x-username": "legacy-user",
      });
      expect(user.username).toBe("legacy-user");
    });
  });

  describe("Admin role", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      resetConfigCache();
    });

    const env = (vars: Record<string, string>) => {
      for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
      resetConfigCache();
    };

    it("grants admin from the proxy header when the package trusts it", async () => {
      env({ TRUST_PROXY_ADMIN_HEADER: "true", NODE_ENV: "production" });
      const user = await authService.authenticateRequest({ "remote-user": "nicolas", "x-lov-admin": "1" });
      expect(user.roles).toContain("admin");
      expect(() => requireAdmin(user)).not.toThrow();
    });

    it("denies admin without the proxy header", async () => {
      env({ TRUST_PROXY_ADMIN_HEADER: "true", NODE_ENV: "production" });
      const user = await authService.authenticateRequest({ "remote-user": "nicolas" });
      expect(user.roles).not.toContain("admin");
      expect(() => requireAdmin(user)).toThrow(AuthorizationError);
    });

    it("ignores a spoofed proxy header when the proxy is not trusted", async () => {
      env({ NODE_ENV: "development" });
      const user = await authService.authenticateRequest({ "x-username": "mallory", "x-lov-admin": "1" });
      expect(user.roles).not.toContain("admin");
    });

    it("grants admin from ADMIN_USERS outside production", async () => {
      env({ NODE_ENV: "development", ADMIN_USERS: "alice, nrineau" });
      const user = await authService.authenticateRequest({ "x-username": "nrineau" });
      expect(user.roles).toContain("admin");
    });

    it("ignores ADMIN_USERS in production, even with dev identity headers", async () => {
      env({ NODE_ENV: "production", ADMIN_USERS: "nrineau" });
      const user = await authService.authenticateRequest({ "x-username": "nrineau" });
      expect(user.roles).not.toContain("admin");
    });
  });
});
