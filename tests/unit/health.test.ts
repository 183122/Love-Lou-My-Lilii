import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

describe("/api/health", () => {
  it("lists missing setting names without leaking values", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    vi.stubEnv("ADMIN_PASSWORD_HASH", "scrypt:secret-value");
    const body = (await (await GET()).json()) as { ok: boolean; missing: string[] };
    expect(body.ok).toBe(false);
    expect(body.missing).toContain("SUPABASE_URL");
    expect(body.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(body.missing).not.toContain("SESSION_SECRET");
    expect(JSON.stringify(body)).not.toContain("secret-value");
    vi.unstubAllEnvs();
  });
});
