import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, SecretDecryptionError, SecretKeyMissingError } from "./secrets";

const key = Buffer.alloc(32, 1).toString("base64");
const otherKey = Buffer.alloc(32, 2).toString("hex");

describe("secret encryption", () => {
  it("round-trips and never stores the clear text", () => {
    const stored = encryptSecret("mot-de-passe-très-secret", key);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("secret");
    expect(decryptSecret(stored, key)).toBe("mot-de-passe-très-secret");
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("rejects tampered ciphertext and a wrong key", () => {
    const stored = encryptSecret("abc", key);
    const parts = stored.split(":");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow(SecretDecryptionError);
    expect(() => decryptSecret(stored, otherKey)).toThrow(SecretDecryptionError);
    expect(() => decryptSecret("garbage", key)).toThrow(SecretDecryptionError);
  });

  it("refuses to encrypt without a valid key", () => {
    expect(() => encryptSecret("abc", "")).toThrow(SecretKeyMissingError);
    expect(() => encryptSecret("abc", "short")).toThrow(SecretKeyMissingError);
  });
});
