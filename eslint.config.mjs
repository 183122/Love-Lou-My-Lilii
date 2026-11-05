import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "legacy/**", "playwright-report/**", "test-results/**", ".open-next/**", ".wrangler/**", "cloudflare-env.d.ts"] },
];
export default config;
