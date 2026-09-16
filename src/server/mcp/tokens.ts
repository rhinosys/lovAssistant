import crypto from "crypto";
import { getConfig } from "../config";

export interface ConfirmationTokenPayload {
  pageName: string;
  contentHash: string;
  summary: string;
  expiresAt: number;
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function createConfirmationToken(pageName: string, content: string, summary: string, ttlSeconds = 300): { token: string; expiresAt: number } {
  const secret = getConfig().SESSION_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  const payload: ConfirmationTokenPayload = {
    pageName,
    contentHash: hashContent(content),
    summary,
    expiresAt,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");

  return {
    token: `${payloadStr}.${signature}`,
    expiresAt,
  };
}

export function verifyConfirmationToken(token: string): ConfirmationTokenPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;
  const secret = getConfig().SESSION_SECRET;

  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8")) as ConfirmationTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.expiresAt < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
