export interface ManifestRow {
  order: number;
  category: string;
  indicator: string;
  activity: string;
  file_name: string;
  file_type: string;
  note: string;
}

const HEAD = ["ลำดับ", "หมวด", "ตัวชี้วัด", "ชื่อกิจกรรม", "ชื่อไฟล์", "ประเภทไฟล์", "หมายเหตุ"];

/** RFC 4180 CSV; neutralises spreadsheet formula injection. */
export function csvCell(v: string | number): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildManifestCsv(rows: ManifestRow[]): string {
  const lines = [HEAD.map(csvCell).join(",")];
  for (const r of rows)
    lines.push([r.order, r.category, r.indicator, r.activity, r.file_name, r.file_type, r.note].map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function sortVtr<T extends { vtr_order: number | null; created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (a.vtr_order ?? Number.MAX_SAFE_INTEGER) - (b.vtr_order ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at),
  );
}
