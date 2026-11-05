import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashPassword, signToken, verifyPassword, verifyToken } from "@/lib/server/crypto";

describe("password hashing (scrypt)", () => {
  it("verifies correct password and rejects wrong one", async () => {
    const h = await hashPassword("s3cret-password!");
    expect(h.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("s3cret-password!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "scrypt:1:1:1:a:b")).toBe(false);
  });
  it("is compatible with scripts/hash-password.mjs output format", async () => {
    const { execFileSync } = await import("node:child_process");
    const out = execFileSync("node", ["scripts/hash-password.mjs", "another-strong-pw"]).toString().trim();
    expect(await verifyPassword("another-strong-pw", out)).toBe(true);
  });
});

describe("signed tokens", () => {
  it("round-trips and detects tampering / expiry / wrong secret", () => {
    const t = signToken({ f: "abc" }, "k1", 60);
    expect(verifyToken(t, "k1")?.f).toBe("abc");
    expect(verifyToken(t, "k2")).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ f: "zzz", exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, "k1")).toBeNull();
    expect(verifyToken(`${body}.x${sig.slice(1)}`, "k1")).toBeNull();
    expect(verifyToken(signToken({ f: "a" }, "k1", -10), "k1")).toBeNull();
  });
});

describe("AES-GCM secret storage", () => {
  it("encrypts refresh tokens and fails with the wrong key", () => {
    const enc = encryptSecret("1//refresh-token", "key-a");
    expect(enc).not.toContain("refresh-token");
    expect(decryptSecret(enc, "key-a")).toBe("1//refresh-token");
    expect(() => decryptSecret(enc, "key-b")).toThrow();
  });
});
