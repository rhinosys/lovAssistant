import { describe, it, expect, beforeEach } from "vitest";
import { TokenAuthService, AuthorizationError } from "./session";
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
});
