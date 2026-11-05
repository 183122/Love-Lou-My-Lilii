import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TH_DATE = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });
const TH_DATETIME = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export function thDate(d: string | null | undefined) {
  if (!d) return "-";
  const t = Date.parse(d.length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(t) ? "-" : TH_DATE.format(t);
}
export function thDateTime(d: string | null | undefined) {
  if (!d) return "-";
  const t = Date.parse(d);
  return Number.isNaN(t) ? "-" : TH_DATETIME.format(t);
}
