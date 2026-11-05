"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import * as React from "react";
import type { IndicatorStatus } from "@/lib/shared/types";
import { STATUS_LABEL } from "@/lib/shared/status";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn("h-full rounded-full", !color && "brand-gradient")}
        style={color ? { background: color } : undefined}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

const STATUS_STYLE: Record<IndicatorStatus, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  NOT_SUBMITTED: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: IndicatorStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 via-violet-100 to-pink-100 text-violet-500 dark:from-sky-500/10 dark:via-violet-500/10 dark:to-pink-500/10">
        {icon ?? <Inbox className="size-7" />}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Switch(props: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-slate-300 transition data-[state=checked]:bg-violet-500 dark:bg-slate-600",
        props.className,
      )}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="brand-text">{title}</span>
        </h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-4">
          ลองใหม่
        </button>
      )}
    </div>
  );
}
