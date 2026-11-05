import { afterEach, describe, expect, it, vi } from "vitest";
import { isTestMode } from "@/lib/server/backends";

describe("test backends can never activate in production", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const onWorkers = () => vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });

  it("is off unless VTR_TEST_BACKENDS=1", () => {
    vi.stubEnv("VTR_TEST_BACKENDS", "");
    expect(isTestMode()).toBe(false);
  });
  it("is refused on Cloudflare Workers with an https URL even if both flags are set", () => {
    onWorkers();
    vi.stubEnv("VTR_TEST_BACKENDS", "1");
    vi.stubEnv("VTR_TEST_ALLOW_WORKERD", "1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://vtr-evidence-hub.school.workers.dev");
    expect(isTestMode()).toBe(false);
  });
  it("is refused on Workers without the second flag", () => {
    onWorkers();
    vi.stubEnv("VTR_TEST_BACKENDS", "1");
    vi.stubEnv("VTR_TEST_ALLOW_WORKERD", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:8787");
    expect(isTestMode()).toBe(false);
  });
  it("is allowed only for local wrangler dev on http://localhost", () => {
    onWorkers();
    vi.stubEnv("VTR_TEST_BACKENDS", "1");
    vi.stubEnv("VTR_TEST_ALLOW_WORKERD", "1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:8787");
    expect(isTestMode()).toBe(true);
  });
  it("is refused on Vercel", () => {
    vi.stubEnv("VTR_TEST_BACKENDS", "1");
    vi.stubEnv("VERCEL", "1");
    expect(isTestMode()).toBe(false);
  });
});
