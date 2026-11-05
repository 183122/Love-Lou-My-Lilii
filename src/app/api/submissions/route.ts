import { ipHash, json, readJson, route, assertSameOrigin } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { loadSettings } from "@/lib/server/settings";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { createSubmission } from "@/lib/server/uploads";
import { submissionSchema } from "@/lib/server/validation";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "submission");
  const input = submissionSchema.parse(await readJson(req));
  const settings = await loadSettings();
  await verifyTurnstile(req, input.turnstileToken, settings.requireTurnstile);
  const result = await createSubmission(input, { ipHash: ipHash(req) });
  return json(result, { status: result.reused ? 200 : 201 });
});
