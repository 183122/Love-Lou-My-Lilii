import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { signToken } from "@/lib/server/crypto";
import { buildAuthUrl } from "@/lib/server/drive/google-drive";
import { env } from "@/lib/server/env";
import { route } from "@/lib/server/http";

/** Start Google OAuth (admin only). `state` is bound to the current admin session. */
export const GET = route(async (req: Request) => {
  const session = await requireRole(req, "ADMIN");
  if (!env.googleClientId || !env.googleClientSecret) {
    return NextResponse.redirect(`${env.appUrl}/settings?tab=drive&drive_error=NOT_CONFIGURED`);
  }
  const state = signToken({ t: "oauth", sid: session.id }, env.sessionSecret, 600);
  return NextResponse.redirect(
    buildAuthUrl({
      clientId: env.googleClientId,
      redirectUri: `${env.appUrl}/api/admin/drive/callback`,
      scope: env.googleDriveScope,
      state,
    }),
  );
});
