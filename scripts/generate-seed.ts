/**
 * Generates supabase/seed.sql from src/data/indicators.ts.
 * Usage: npm run seed:generate
 */
import { writeFileSync } from "node:fs";
import { buildSeedSql } from "../src/data/seed-sql.ts";

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), buildSeedSql());
console.log("supabase/seed.sql written");
