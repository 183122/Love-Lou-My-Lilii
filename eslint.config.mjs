import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "legacy/**", "playwright-report/**", "test-results/**"] },
];
export default config;
