#!/usr/bin/env node
// Usage: npm run hash-password -- "your-strong-password"
// Prints a scrypt hash for ADMIN_PASSWORD_HASH / VIEWER_ACCESS_CODE_HASH.
import { randomBytes, scryptSync } from "node:crypto";

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('ใช้: npm run hash-password -- "รหัสผ่านอย่างน้อย 10 ตัวอักษร"');
  process.exit(1);
}
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const key = scryptSync(pw, salt, 64, { N, r, p });
console.log(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":"));
