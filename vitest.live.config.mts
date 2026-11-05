import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Real Google Drive integration test. Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/live/**/*.test.ts"], environment: "node", testTimeout: 120_000 },
});
