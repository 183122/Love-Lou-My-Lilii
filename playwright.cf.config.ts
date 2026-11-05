import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Same E2E suite, but served by `wrangler dev` — the real Cloudflare Workers
 * runtime (workerd) running the OpenNext bundle. Run `npm run cf:build` first.
 */
const PORT = 8787;
const salt = randomBytes(16);
const hash = ["scrypt", 16384, 8, 1, salt.toString("base64"), scryptSync("e2e-admin-password-123", salt, 64).toString("base64")].join(":");
mkdirSync(".wrangler", { recursive: true });
writeFileSync(
  ".wrangler/e2e.vars",
  [
    "VTR_TEST_BACKENDS=1",
    "VTR_TEST_ALLOW_WORKERD=1",
    `VTR_TEST_ADMIN_HASH=${hash}`,
    `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
    `NEXT_PUBLIC_APP_URL=http://localhost:${PORT}`,
  ].join("\n"),
);

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx wrangler dev --port ${PORT} --env-file .wrangler/e2e.vars --show-interactive-dev-session=false`,
    url: `http://localhost:${PORT}/api/public/config`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
