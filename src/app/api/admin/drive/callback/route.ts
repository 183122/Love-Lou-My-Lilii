import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/auth";
import { verifyToken } from "@/lib/server/crypto";
import { exchangeCode, GoogleDriveClient } from "@/lib/server/drive/google-drive";
import { storeRefreshToken } from "@/lib/server/drive/service";
import { DriveError } from "@/lib/server/drive/types";
import { env } from "@/lib/server/env";

function back(params: Record<string, string>) {
  return NextResponse.redirect(`${env.appUrl}/settings?tab=drive&${new URLSearchParams(params)}`);
}

/** OAuth redirect target. Exchanges the code server-side and stores the refresh token encrypted. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await getSession().catch(() => null);
  const state = verifyToken<{ t: string; sid: string }>(url.searchParams.get("state") ?? "", env.sessionSecret);
  if (!session || session.role !== "ADMIN" || !state || state.t !== "oauth" || state.sid !== session.id) {
    return back({ drive_error: "STATE" });
  }
  const oauthError = url.searchParams.get("error");
  if (oauthError) return back({ drive_error: oauthError === "access_denied" ? "DENIED" : "OAUTH" });
  const code = url.searchParams.get("code");
  if (!code) return back({ drive_error: "OAUTH" });
  try {
    const { refreshToken, scope } = await exchangeCode({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      redirectUri: `${env.appUrl}/api/admin/drive/callback`,
      code,
    });
    if (!/auth\/drive(\.file)?\b/.test(scope)) return back({ drive_error: "SCOPE" });
    const client = new GoogleDriveClient({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      refreshToken,
    });
    const me = await client.about();
    await storeRefreshToken(refreshToken, me.email, scope);
    return back({ drive_connected: "1" });
  } catch (e) {
    console.error("[drive callback]", e instanceof DriveError ? `${e.code} ${e.detail}` : e);
    return back({ drive_error: e instanceof DriveError ? e.code : "OAUTH" });
  }
}
