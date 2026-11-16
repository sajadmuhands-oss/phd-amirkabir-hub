"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type SettingRow = {
  key: string;
  value: string;
  hasValue: boolean;
  isSecret: boolean;
};

type SourceRow = {
  code: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
};

const FIELD_DEFS: Array<{
  key: string;
  label: string;
  secret?: boolean;
  textarea?: boolean;
  help?: string;
}> = [
  { key: "scopus.affiliationId", label: "Scopus Affiliation ID" },
  { key: "scopus.affiliationUrl", label: "رابط صفحة Affiliation" },
  { key: "scopus.apiKey", label: "Scopus API Key", secret: true },
  { key: "scopus.instToken", label: "Scopus Institutional Token", secret: true },
  {
    key: "whatsapp.token",
    label: "WhatsApp Cloud API Token",
    secret: true,
  },
  { key: "whatsapp.phoneNumberId", label: "WhatsApp Phone Number ID" },
  {
    key: "whatsapp.recipients",
    label: "أرقام واتساب للطوارئ والتقارير",
    help: "recipientsHelp",
  },
  {
    key: "monitor.intervalMinutes",
    label: "فاصل الفحص (بالدقائق)",
    help: "intervalHelp",
  },
  { key: "reports.daily.enabled", label: "تفعيل التقرير اليومي" },
  { key: "reports.daily.time", label: "وقت التقرير اليومي (HH:mm)" },
  { key: "reports.weekly.enabled", label: "تفعيل التقرير الأسبوعي" },
  { key: "reports.weekly.day", label: "يوم التقرير الأسبوعي" },
  { key: "reports.weekly.time", label: "وقت التقرير الأسبوعي" },
  { key: "reports.monthly.enabled", label: "تفعيل التقرير الشهري" },
  { key: "reports.monthly.day", label: "يوم التقرير الشهري (1-28)" },
  { key: "reports.monthly.time", label: "وقت التقرير الشهري" },
  { key: "alerts.enabled", label: "تفعيل تنبيهات الطوارئ" },
  { key: "alerts.newPubsThreshold", label: "حد البحوث الجديدة المفاجئ" },
  { key: "alerts.removedThreshold", label: "حد الإزالات المريب" },
  { key: "alerts.citationDropPct", label: "نسبة انخفاض الاستشهادات %" },
  { key: "alerts.scanFailStreak", label: "حد فشل الفحص المتكرر" },
  { key: "alerts.cooldownMinutes", label: "تهدئة التنبيهات (دقائق)" },
  { key: "timezone", label: "المنطقة الزمنية" },
];

export function SettingsForm({
  initialSettings,
  initialSources,
}: {
  initialSettings: SettingRow[];
  initialSources: SourceRow[];
}) {
  const t = useTranslations("settings");
  const common = useTranslations("common");

  const initialMap = useMemo(() => {
    return Object.fromEntries(initialSettings.map((s) => [s.key, s.value]));
  }, [initialSettings]);

  const [values, setValues] = useState<Record<string, string>>(initialMap);
  const [sources, setSources] = useState(initialSources);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy("save");
    setMessage("");
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: values,
        sources: sources.map((s) => ({ code: s.code, enabled: s.enabled })),
      }),
    });
    const json = await response.json();
    setBusy("");
    setMessage(
      response.ok
        ? `${common("success")}${json.schedule?.error ? ` — تنبيه جدولة: ${json.schedule.error}` : ""}`
        : json.error || common("error")
    );
  }

  async function runAction(
    key: string,
    url: string,
    body?: Record<string, unknown>
  ) {
    setBusy(key);
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(json.error || json.message || common("error"));
      return;
    }
    setMessage(
      json.message ||
        (json.result
          ? `الفحص: ${json.result.status} · جديد ${json.result.newCount} · محدّث ${json.result.updatedCount}`
          : common("success"))
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="surface rounded-2xl p-5">
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">{t("scopus")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_DEFS.filter((f) => f.key.startsWith("scopus.")).map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] || ""}
              onChange={setValue}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">{t("whatsapp")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_DEFS.filter((f) => f.key.startsWith("whatsapp.")).map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] || ""}
              onChange={setValue}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">{t("schedule")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_DEFS.filter(
            (f) =>
              f.key.startsWith("reports.") ||
              f.key === "monitor.intervalMinutes" ||
              f.key === "timezone"
          ).map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] || ""}
              onChange={setValue}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">{t("alerts")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FIELD_DEFS.filter((f) => f.key.startsWith("alerts.")).map((field) => (
            <Field
              key={field.key}
              field={field}
              value={values[field.key] || ""}
              onChange={setValue}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">مصادر البيانات</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <label
              key={source.code}
              className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(0,33,71,0.08)] bg-white px-4 py-3"
            >
              <span>
                <span className="block text-sm font-medium">{source.nameAr}</span>
                <span className="text-xs text-[var(--auiq-muted)]">{source.code}</span>
              </span>
              <input
                type="checkbox"
                checked={source.enabled}
                disabled={source.code !== "scopus"}
                onChange={(e) =>
                  setSources((prev) =>
                    prev.map((s) =>
                      s.code === source.code
                        ? { ...s, enabled: e.target.checked }
                        : s
                    )
                  )
                }
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={Boolean(busy)}
          className="rounded-xl bg-[var(--auiq-navy)] px-5 py-3 text-white disabled:opacity-60"
        >
          {busy === "save" ? "…" : t("save")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runAction("scopus", "/api/scopus/test")}
          className="rounded-xl border border-[rgba(0,33,71,0.15)] bg-white px-5 py-3"
        >
          {busy === "scopus" ? "…" : t("testScopus")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runAction("whatsapp", "/api/whatsapp/test")}
          className="rounded-xl border border-[rgba(0,33,71,0.15)] bg-white px-5 py-3"
        >
          {busy === "whatsapp" ? "…" : t("testWhatsApp")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runAction("scan", "/api/monitor/run", {})}
          className="rounded-xl border border-[rgba(0,33,71,0.15)] bg-white px-5 py-3"
        >
          {busy === "scan" ? "…" : t("runScan")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            runAction("report", "/api/reports/generate", { type: "TEST" })
          }
          className="rounded-xl border border-[rgba(0,33,71,0.15)] bg-white px-5 py-3"
        >
          {busy === "report" ? "…" : t("testReport")}
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--auiq-mist)] px-4 py-3 text-sm text-[var(--auiq-navy)]">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  field,
  value,
  onChange,
  t,
}: {
  field: (typeof FIELD_DEFS)[number];
  value: string;
  onChange: (key: string, value: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <label className="block text-sm md:col-span-1">
      <span className="mb-1.5 block text-[var(--auiq-muted)]">{field.label}</span>
      <input
        type={field.secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="w-full rounded-xl border border-[rgba(0,33,71,0.12)] bg-white px-3 py-2 outline-none ring-[var(--auiq-sapphire)] focus:ring-2"
        autoComplete="off"
      />
      {field.help ? (
        <span className="mt-1 block text-xs text-[var(--auiq-muted)]">
          {t(field.help as "recipientsHelp" | "intervalHelp")}
        </span>
      ) : null}
    </label>
  );
}
