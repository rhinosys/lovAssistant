import crypto from "node:crypto";
import { decodeKey, getConfig } from "../config";

export class SecretKeyMissingError extends Error {
  constructor() {
    super("APP_ENCRYPTION_KEY n'est pas configurée : impossible de stocker un secret en base.");
    this.name = "SecretKeyMissingError";
  }
}

export class SecretDecryptionError extends Error {
  constructor() {
    super("Le secret stocké ne peut pas être déchiffré (clé modifiée ou donnée corrompue).");
    this.name = "SecretDecryptionError";
  }
}

const resolveKey = (key?: string): Buffer => {
  const raw = key ?? getConfig().APP_ENCRYPTION_KEY;
  const decoded = raw ? decodeKey(raw) : null;
  if (!decoded) throw new SecretKeyMissingError();
  return decoded;
};

// Format: v1:<iv>:<auth tag>:<ciphertext>, base64url parts, AES-256-GCM.
export function encryptSecret(plain: string, key?: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", resolveKey(key), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(":");
}

export function decryptSecret(stored: string, key?: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new SecretDecryptionError();
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", resolveKey(key), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof SecretKeyMissingError) throw error;
    throw new SecretDecryptionError();
  }
}
