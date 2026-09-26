/**
 * Smallest workable auth for a single-owner Studio: a password checked against an env var,
 * and an HMAC-signed session token stored in an httpOnly cookie. No user table, no OAuth —
 * see docs/DECISIONS.md for why that would be over-engineering here.
 *
 * Uses the Web Crypto API (not Node's `crypto` module) so the same code runs in both the
 * Edge middleware runtime and normal server code without a runtime-specific branch.
 */
export const SESSION_COOKIE = "studio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.STUDIO_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "STUDIO_SESSION_SECRET is not set — see docs/OPERATIONS.md#studio-authentication"
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string): Promise<string> {
  const key = await getKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(signature);
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.STUDIO_PASSWORD;
  if (!expected) return false;
  return timingSafeEqualStrings(candidate, expected);
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${expires}`;
  const signature = await sign(payload);
  return { token: `${payload}.${signature}`, maxAge: SESSION_MAX_AGE_SECONDS };
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await sign(payload);
  if (!timingSafeEqualStrings(signature, expected)) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && Date.now() < expires;
}
