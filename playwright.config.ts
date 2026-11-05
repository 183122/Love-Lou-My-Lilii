import { randomBytes, scryptSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite. Runs the production build with TEST backends (in-memory DB +
 * fake Google Drive, enabled only via VTR_TEST_BACKENDS=1 and never on Vercel).
 * The real Google Drive integration test lives in tests/live (npm run test:drive-live).
 */
const PORT = 3100;
export const E2E_ADMIN_PASSWORD = "e2e-admin-password-123";
const salt = randomBytes(16);
const hash = ["scrypt", 16384, 8, 1, salt.toString("base64"), scryptSync(E2E_ADMIN_PASSWORD, salt, 64).toString("base64")].join(":");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "th-TH",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/public/config`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VTR_TEST_BACKENDS: "1",
      VTR_TEST_ADMIN_HASH: hash,
      SESSION_SECRET: randomBytes(32).toString("hex"),
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    },
  },
});
