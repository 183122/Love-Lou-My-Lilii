// OpenNext adapter config for Cloudflare Workers.
// No incremental cache is needed: every data page is client-rendered from
// no-store API routes, so there is nothing to revalidate (no R2 bucket required).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig({}),
  // `npm run build` runs the OpenNext build (so Cloudflare's default build
  // command produces .open-next/); OpenNext itself calls plain `next build`.
  buildCommand: "npx next build",
};

export default config;
