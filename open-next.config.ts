// OpenNext adapter config for Cloudflare Workers.
// No incremental cache is needed: every data page is client-rendered from
// no-store API routes, so there is nothing to revalidate (no R2 bucket required).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
