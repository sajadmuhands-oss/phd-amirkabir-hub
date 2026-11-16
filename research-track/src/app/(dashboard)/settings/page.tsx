import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskSecret } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as { role?: string } | undefined)?.role;
  if (role !== "admin") redirect("/");
  const t = await getTranslations("settings");
  const tDash = await getTranslations("dashboard");

  const [settings, sources, lastScan, recentMessages] = await Promise.all([
    prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.source.findMany({ orderBy: { code: "asc" } }),
    prisma.scanRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="surface rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[var(--aui-navy)]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--aui-slate)]">
          Scopus · WhatsApp · Asia/Baghdad
        </p>
        {lastScan ? (
          <p className="mt-3 text-xs text-[var(--aui-slate)]">
            {tDash("lastScan")}: {lastScan.status} —{" "}
            {lastScan.startedAt.toLocaleString("ar-IQ")} · +{lastScan.newCount} / ~
            {lastScan.updatedCount}
            {lastScan.errorMessage ? ` · ${lastScan.errorMessage}` : ""}
          </p>
        ) : null}
      </header>

      <SettingsForm
        initialSettings={settings.map((s) => ({
          key: s.key,
          value: s.isSecret ? maskSecret(s.value) : s.value,
          hasValue: Boolean(s.value),
          isSecret: s.isSecret,
        }))}
        initialSources={sources.map((s) => ({
          code: s.code,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          enabled: s.enabled,
        }))}
      />

      <section className="surface rounded-2xl p-5">
        <h2 className="mb-3 text-lg font-semibold text-[var(--aui-navy)]">{t("whatsappLog")}</h2>
        <ul className="space-y-2 text-sm text-[var(--aui-slate)]">
          {recentMessages.map((msg) => (
            <li key={msg.id}>
              {msg.status} → {msg.recipient} · {msg.createdAt.toLocaleString("ar-IQ")}
              {msg.errorMessage ? ` · ${msg.errorMessage}` : ""}
            </li>
          ))}
          {recentMessages.length === 0 ? <li>{t("noMessages")}</li> : null}
        </ul>
      </section>
    </div>
  );
}
