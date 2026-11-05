import { destroySession } from "@/lib/server/auth";
import { assertSameOrigin, json, route } from "@/lib/server/http";

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await destroySession();
  return json({ ok: true });
});
