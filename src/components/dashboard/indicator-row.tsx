"use client";
import { Film, ImageIcon } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/misc";
import type { IndicatorProgress } from "@/lib/shared/types";

export function IndicatorRow({ row }: { row: IndicatorProgress }) {
  return (
    <Link
      href={`/indicators/${row.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/70 dark:hover:bg-slate-800/60"
    >
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-100 to-violet-100 text-xs font-semibold text-violet-700 dark:from-sky-500/15 dark:to-violet-500/15 dark:text-violet-200">
        {row.code}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{row.title}</p>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-3.5" /> {row.image_count}/{row.required_image_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <Film className="size-3.5" /> {row.video_count}/{row.required_video_count}
          </span>
        </p>
      </div>
      <StatusBadge status={row.status} />
    </Link>
  );
}
