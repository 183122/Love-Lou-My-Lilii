import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import "./globals.css";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VTR Evidence Hub — ระบบรวบรวมภาพและวิดีโอประกอบการนิเทศเปิดภาคเรียน",
  description: "ระบบรวบรวมภาพและวิดีโอประกอบการนิเทศเปิดภาคเรียน โรงเรียนบ้านโคกสูง สพป.ศรีสะเกษ เขต 3",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={kanit.variable}>
      <body className="font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
