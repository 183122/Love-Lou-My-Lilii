import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Signed, expiring tokens (HMAC-SHA256)
// ---------------------------------------------------------------------------
export function signToken(payload: Record<string, unknown>, secret: string, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string, secret: string): (T & { exp: number }) | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AES-256-GCM for secrets at rest (Google refresh token)
// ---------------------------------------------------------------------------
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(`vtr-token-key:${secret}`).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(blob: string, secret: string): string {
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("invalid encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt). Format: scrypt:N:r:p:saltB64:hashB64 (":" avoids $-expansion in .env files)
// ---------------------------------------------------------------------------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scryptAsync(pw: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pw, salt, keylen, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const N = Number(n);
  if (!Number.isInteger(N) || N < 1024 || N > 1 << 20) return false;
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), N, Number(r), Number(p), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
