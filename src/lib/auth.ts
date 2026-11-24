export const SESSION_COOKIE_NAME = "set360_session";
const TOKEN_VERSION = "v1";
const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000; // 24h hard server cap (cookie itself is session-only)

function getSecret(): string {
  return process.env.AUTH_SECRET?.trim() || "set360-default-hmac-secret-change-me";
}

export function getConfiguredPasscode(): string {
  return process.env.APP_PASSCODE?.trim() || "084116";
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPasscode(candidate: string): Promise<boolean> {
  const normalized = candidate.trim();
  const expected = getConfiguredPasscode();
  const [h1, h2] = await Promise.all([sha256Hex(normalized), sha256Hex(expected)]);
  return timingSafeEqualHex(h1, h2);
}

export async function createSessionToken(): Promise<string> {
  const issuedAt = Date.now().toString();
  const payload = `${TOKEN_VERSION}.${issuedAt}`;
  const sig = await hmacSign(payload, getSecret());
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, issuedAtStr, sig] = parts;
  if (version !== TOKEN_VERSION) return false;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > MAX_TOKEN_AGE_MS || issuedAt > Date.now() + 60_000) {
    return false;
  }
  const expectedSig = await hmacSign(`${version}.${issuedAtStr}`, getSecret());
  return timingSafeEqualHex(sig, expectedSig);
}
