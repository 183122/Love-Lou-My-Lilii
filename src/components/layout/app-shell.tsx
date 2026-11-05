"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  Clapperboard,
  CircleDashed,
  Images,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { useApp } from "../providers";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/submit", label: "ส่งหลักฐาน", icon: Upload, primary: true },
  { href: "/indicators", label: "ตัวชี้วัดทั้งหมด", icon: ListChecks },
  { href: "/submitted", label: "หลักฐานที่ส่งแล้ว", icon: CheckCircle2 },
  { href: "/pending", label: "ยังไม่ส่ง", icon: CircleDashed },
  { href: "/gallery", label: "คลังรูปภาพและวิดีโอ", icon: Images },
  { href: "/vtr", label: "คัดเลือกสำหรับ VTR", icon: Clapperboard },
  { href: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid theme hydration mismatch
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-9 place-items-center rounded-xl text-white/90 hover:bg-white/15"
      aria-label={dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      title={dark ? "โหมดสว่าง" : "โหมดมืด"}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function RoleChip() {
  const { role, setSession } = useApp();
  if (!role) return null;
  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setSession({ role: null });
      toast.success("ออกจากระบบแล้ว");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <button
      onClick={logout}
      className="hidden items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/25 sm:inline-flex"
      title="ออกจากระบบ"
    >
      {role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ชม (อ่านอย่างเดียว)"}
      <LogOut className="size-3.5" />
    </button>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="เมนูหลัก">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        if ("primary" in item && item.primary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "my-2 flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-white brand-gradient shadow-lg shadow-violet-500/25 transition hover:brightness-105",
                active && "ring-2 ring-violet-300 ring-offset-2 ring-offset-transparent",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              active
                ? "bg-gradient-to-r from-sky-100 to-violet-100 font-medium text-violet-700 dark:from-sky-500/15 dark:to-violet-500/15 dark:text-violet-200"
                : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/60",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { config } = useApp();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNav = [NAV[0], NAV[2], NAV[1], NAV[5]];

  return (
    <div className="min-h-dvh">
      {config?.testMode && (
        <div className="sticky top-0 z-[60] bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
          TEST MODE — ใช้ฐานข้อมูลและ Google Drive จำลองสำหรับการทดสอบอัตโนมัติเท่านั้น ข้อมูลในหน้านี้ไม่ใช่ข้อมูลจริง
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-4 p-4 lg:flex">
        <div className="glass flex h-full flex-col rounded-3xl p-4">
          <Link href="/" className="mb-4 flex items-center gap-3 px-1">
            <div className="grid size-11 place-items-center rounded-2xl brand-gradient text-lg font-bold text-white shadow-lg">
              V
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">VTR Evidence Hub</p>
              <p className="truncate text-xs text-muted">{config?.schoolName ?? " "}</p>
            </div>
          </Link>
          <NavList />
          <p className="mt-auto px-2 text-xs text-muted">
            ภาคเรียนที่ {config?.semester ?? "-"} ปีการศึกษา {config?.academicYear ?? "-"}
          </p>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        {/* Gradient header */}
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
          <div className="brand-gradient flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg shadow-violet-500/20">
            <button
              className="grid size-9 place-items-center rounded-xl hover:bg-white/15 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base">
                {config?.systemName ?? "ระบบรวบรวมภาพและวิดีโอประกอบการนิเทศเปิดภาคเรียน"}
              </p>
              <p className="truncate text-xs text-white/85">
                {config ? `${config.schoolName} · ${config.schoolArea} · ภาคเรียนที่ ${config.semester}/${config.academicYear}` : " "}
              </p>
            </div>
            <RoleChip />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-7xl px-3 pb-28 pt-6 sm:px-6 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl px-1 py-1.5 lg:hidden"
        aria-label="เมนูด้านล่าง"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          if (item.href === "/submit")
            return (
              <Link key={item.href} href={item.href} className="-mt-6 flex flex-col items-center gap-0.5" aria-label="ส่งหลักฐาน">
                <span className="grid size-14 place-items-center rounded-2xl brand-gradient text-white shadow-xl shadow-violet-500/40 ring-4 ring-white dark:ring-slate-900">
                  <Upload className="size-6" />
                </span>
                <span className="text-[11px] font-medium text-violet-600 dark:text-violet-300">ส่งหลักฐาน</span>
              </Link>
            );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px]",
                active ? "text-violet-600 dark:text-violet-300" : "text-slate-500 dark:text-slate-400",
              )}
            >
              <Icon className="size-5" />
              <span className="max-w-full truncate px-1">{item.href === "/" ? "หน้าหลัก" : item.href === "/gallery" ? "คลัง" : "ตัวชี้วัด"}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <Menu className="size-5" />
          เมนู
        </button>
      </nav>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[82vw] max-w-xs overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900 lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <DialogPrimitive.Title className="font-semibold">เมนู</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">เมนูนำทางหลัก</DialogPrimitive.Description>
              <DialogPrimitive.Close className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="ปิดเมนู">
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <NavList onNavigate={() => setMenuOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
