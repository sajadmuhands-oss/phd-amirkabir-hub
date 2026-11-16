"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", key: "dashboard", icon: LayoutDashboard },
  { href: "/publications", key: "publications", icon: BookOpen },
  { href: "/changes", key: "changes", icon: Activity },
  { href: "/reports", key: "reports", icon: FileText },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const locale = useLocale();

  async function switchLocale() {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }),
    });
    window.location.reload();
  }

  return (
    <aside className="surface sticky top-0 flex h-screen w-72 flex-col border-l border-[var(--aui-line)] bg-[linear-gradient(180deg,#002147_0%,#0d4377_100%)] p-5 text-white">
      <div className="mb-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-[var(--auiq-gold)]">
          ع
        </div>
        <p className="font-[family-name:var(--font-amiri)] text-xl font-bold">
          {tApp("university")}
        </p>
        <p className="mt-1 text-sm text-white/75">{tApp("system")}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-white text-[var(--auiq-navy)]"
                  : "text-white/90 hover:bg-white/10"
              )}
            >
              <Icon size={18} />
              {t(link.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={switchLocale}
          className="w-full rounded-xl border border-white/20 px-3 py-2 text-sm text-white/90"
        >
          {locale === "ar" ? "English" : "العربية"}
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-200 hover:bg-white/10"
        >
          <LogOut size={16} />
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
