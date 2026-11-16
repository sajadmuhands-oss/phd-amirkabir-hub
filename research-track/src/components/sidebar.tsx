"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/publications", icon: BookOpen, key: "publications" as const },
  { href: "/changes", icon: Activity, key: "changes" as const },
  { href: "/reports", icon: FileText, key: "reports" as const },
  { href: "/settings", icon: Settings, key: "settings" as const, adminOnly: true },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const app = useTranslations("app");
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAdmin =
    status === "authenticated" &&
    (session?.user as { role?: string } | undefined)?.role === "admin";

  async function switchLocale(next: "ar" | "en") {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    window.location.reload();
  }

  return (
    <aside className="surface sticky top-0 flex h-screen w-20 flex-col border-[rgba(0,33,71,0.08)] bg-[linear-gradient(180deg,#002147_0%,#0d4377_100%)] text-white md:w-72">
      <div className="border-b border-white/10 px-4 py-6 md:px-6">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-[var(--auiq-gold)]">
          ع
        </div>
        <p className="hidden font-[family-name:var(--font-amiri)] text-xl leading-tight md:block">
          {app("university")}
        </p>
        <p className="mt-1 hidden text-sm text-white/75 md:block">{app("system")}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3 md:p-4">
        {links
          .filter((link) => !link.adminOnly || isAdmin)
          .map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.key}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition md:px-4",
                  active
                    ? "bg-white text-[var(--auiq-navy)] shadow-sm"
                    : "text-white/85 hover:bg-white/10"
                )}
                title={t(link.key)}
              >
                <Icon size={18} />
                <span className="hidden md:inline">{t(link.key)}</span>
              </Link>
            );
          })}
      </nav>

      <div className="space-y-2 p-3 md:p-4">
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            onClick={() => switchLocale("ar")}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-xs",
              locale === "ar" ? "bg-white text-[var(--auiq-navy)]" : "bg-white/10"
            )}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => switchLocale("en")}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-xs",
              locale === "en" ? "bg-white text-[var(--auiq-navy)]" : "bg-white/10"
            )}
          >
            EN
          </button>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/80 transition hover:bg-white/10 md:px-4"
          >
            <LogOut size={18} />
            <span className="hidden md:inline">{t("logout")}</span>
          </button>
        ) : (
          <Link
            href="/login?callbackUrl=/settings"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/80 transition hover:bg-white/10 md:px-4"
          >
            <LogIn size={18} />
            <span className="hidden md:inline">{t("login")}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
