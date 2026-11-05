import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Applies the REAL SQL migration + seed to an embedded PostgreSQL (PGlite)
 * and checks schema, constraints, RLS and the helper functions.
 */
let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  // Supabase roles that the migration references
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
  await db.exec(readFileSync("supabase/migrations/20261105000000_init.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
}, 60_000);

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

describe("database migration + seed", () => {
  it("creates all 7 required tables (+ rate_limits) with RLS enabled", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    expect(rows.map((r) => r.relname)).toEqual([
      "admin_sessions",
      "categories",
      "drive_folders",
      "evidence_files",
      "indicators",
      "rate_limits",
      "submissions",
      "system_settings",
    ]);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it("uses UUID primary keys everywhere", async () => {
    const { rows } = await db.query<{ table_name: string; data_type: string }>(`
      select k.table_name, c.data_type from information_schema.table_constraints t
      join information_schema.key_column_usage k on k.constraint_name = t.constraint_name and k.table_schema = t.table_schema
      join information_schema.columns c on c.table_name = k.table_name and c.column_name = k.column_name and c.table_schema = k.table_schema
      where t.constraint_type = 'PRIMARY KEY' and t.table_schema = 'public'`);
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.data_type === "uuid")).toBe(true);
  });

  it("seeds 7 categories and 36 indicators; seed is idempotent", async () => {
    expect(Number((await one<{ n: number }>("select count(*) n from categories"))!.n)).toBe(7);
    expect(Number((await one<{ n: number }>("select count(*) n from indicators"))!.n)).toBe(36);
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    expect(Number((await one<{ n: number }>("select count(*) n from indicators"))!.n)).toBe(36);
  });

  it("grants nothing to anon/authenticated (no direct client writes)", async () => {
    const { rows } = await db.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')`,
    );
    expect(rows).toEqual([]);
    await db.exec("set role anon");
    await expect(db.query("select * from indicators")).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into categories (code, name) values ('Z','x')")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });

  it("enforces constraints: unique codes, FK, UPLOADED requires drive_file_id, unique client_upload_id", async () => {
    await expect(db.query("insert into categories (code, name) values ('A', 'dup')")).rejects.toThrow(/duplicate/);
    const ind = (await one<{ id: string }>("select id from indicators where code='A01'"))!;
    const sub = (await one<{ id: string }>(
      `insert into submissions (indicator_id, submitter_name, submitter_position, activity_title, activity_date) values ($1,'ครู ก','ครู','ประชุม','2026-11-01') returning id`,
      [ind.id],
    ))!;
    const ins = (cid: string, extra = "") =>
      db.query(
        `insert into evidence_files (submission_id, indicator_id, client_upload_id, file_name, mime_type, media_type, size_bytes${extra ? ", status" : ""}) values ($1,$2,$3,'a.jpg','image/jpeg','IMAGE',100${extra ? ", 'UPLOADED'" : ""})`,
        [sub.id, ind.id, cid],
      );
    await expect(ins("client-upload-0001", "uploaded")).rejects.toThrow(/evidence_uploaded_has_drive_id/);
    await ins("client-upload-0001");
    await expect(ins("client-upload-0001")).rejects.toThrow(/duplicate/);
    await expect(db.query("delete from indicators where id=$1", [ind.id])).rejects.toThrow(/foreign key/);
  });

  it("indicator_file_counts view counts only UPLOADED files", async () => {
    const ind = (await one<{ id: string }>("select id from indicators where code='A01'"))!;
    await db.query(
      `update evidence_files set status='UPLOADED', drive_file_id='drv-1', uploaded_at=now() where client_upload_id='client-upload-0001'`,
    );
    const sub = (await one<{ id: string }>("select submission_id id from evidence_files limit 1"))!;
    await db.query(
      `insert into evidence_files (submission_id, indicator_id, client_upload_id, file_name, mime_type, media_type, size_bytes, status) values ($1,$2,'client-upload-0002','v.mp4','video/mp4','VIDEO',100,'FAILED')`,
      [sub.id, ind.id],
    );
    const c = (await one<{ image_count: number; video_count: number }>("select * from indicator_file_counts where indicator_id=$1", [ind.id]))!;
    expect(Number(c.image_count)).toBe(1);
    expect(Number(c.video_count)).toBe(0);
  });

  it("rate_limit_hit allows up to the limit within the window", async () => {
    const hit = async () => (await one<{ ok: boolean }>("select rate_limit_hit('login:test', 3, 60) ok"))!.ok;
    expect([await hit(), await hit(), await hit(), await hit()]).toEqual([true, true, true, false]);
  });

  it("drive_folders prevents duplicate indicator folders per root", async () => {
    const ind = (await one<{ id: string; category_id: string }>("select id, category_id from indicators where code='A01'"))!;
    const q = `insert into drive_folders (kind, root_folder_id, category_id, indicator_id, drive_folder_id, name) values ('INDICATOR','root',$1,$2,$3,'A01')`;
    await db.query(q, [ind.category_id, ind.id, "f1"]);
    await expect(db.query(q, [ind.category_id, ind.id, "f2"])).rejects.toThrow(/duplicate/);
  });
});
