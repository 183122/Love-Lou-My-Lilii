import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { json, readJson, route } from "@/lib/server/http";
import { categoryInputSchema } from "@/lib/server/validation";

export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const input = categoryInputSchema.parse(await readJson(req));
  return json(await getRepo().createCategory(input), { status: 201 });
});
