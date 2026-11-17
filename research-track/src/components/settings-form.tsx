"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createRecipient,
  parseRecipientRecords,
  type WhatsAppRecipient,
} from "@/lib/whatsapp/recipients";

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

function blankDraft(): Omit<WhatsAppRecipient, "id"> {
  return {
    name: "",
    phone: "",
    enabled: true,
    notifyAlerts: true,
    notifyDaily: true,
    notifyWeekly: true,
    notifyMonthly: true,
  };
}

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
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>(() =>
    parseRecipientRecords(initialMap["whatsapp.recipients"] || "")
  );
  const [draft, setDraft] = useState(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function startEdit(row: WhatsAppRecipient) {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      phone: row.phone,
      enabled: row.enabled,
      notifyAlerts: row.notifyAlerts,
      notifyDaily: row.notifyDaily,
      notifyWeekly: row.notifyWeekly,
      notifyMonthly: row.notifyMonthly,
    });
  }

  function resetDraft() {
    setEditingId(null);
    setDraft(blankDraft());
  }

  function upsertRecipient() {
    const phone = draft.phone.replace(/[^\d]/g, "");
    if (phone.length < 8) {
      setMessage(t("recipientPhoneInvalid"));
      return;
    }
    const next = createRecipient({
      id: editingId || undefined,
      name: draft.name,
      phone,
      enabled: draft.enabled,
      notifyAlerts: draft.notifyAlerts,
      notifyDaily: draft.notifyDaily,
      notifyWeekly: draft.notifyWeekly,
      notifyMonthly: draft.notifyMonthly,
    });
    setRecipients((prev) => {
      const withoutDup = prev.filter(
        (r) => r.id !== next.id && r.phone !== next.phone
      );
      return [...withoutDup, next];
    });
    resetDraft();
    setMessage("");
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) resetDraft();
  }

  function toggleRecipient(id: string, enabled: boolean) {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r))
    );
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
        recipients,
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

        <div className="mt-6 space-y-4 border-t border-[rgba(0,33,71,0.08)] pt-5">
          <div>
            <h3 className="text-base text-[var(--auiq-navy)]">
              {t("recipientsTitle")}
            </h3>
            <p className="mt-1 text-xs text-[var(--auiq-muted)]">
              {t("recipientsHelp")}
            </p>
          </div>

          <div className="space-y-3">
            {recipients.length === 0 ? (
              <p className="text-sm text-[var(--auiq-muted)]">
                {t("recipientsEmpty")}
              </p>
            ) : (
              recipients.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-[rgba(0,33,71,0.08)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--auiq-navy)]">
                      {row.name || row.phone}
                      {!row.enabled ? (
                        <span className="ms-2 text-xs text-[var(--auiq-muted)]">
                          ({t("disabled")})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-[var(--auiq-muted)]" dir="ltr">
                      {row.phone}
                    </p>
                    <p className="mt-1 text-xs text-[var(--auiq-muted)]">
                      {[
                        row.notifyAlerts ? t("chanAlerts") : null,
                        row.notifyDaily ? t("chanDaily") : null,
                        row.notifyWeekly ? t("chanWeekly") : null,
                        row.notifyMonthly ? t("chanMonthly") : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || t("noChannels")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          toggleRecipient(row.id, e.target.checked)
                        }
                      />
                      {t("enabled")}
                    </label>
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-lg border border-[rgba(0,33,71,0.12)] px-3 py-1.5 text-sm"
                    >
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecipient(row.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-dashed border-[rgba(0,33,71,0.18)] bg-[var(--auiq-mist)]/40 p-4">
            <p className="mb-3 text-sm font-medium text-[var(--auiq-navy)]">
              {editingId ? t("editRecipient") : t("addRecipient")}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--auiq-muted)]">
                  {t("recipientName")}
                </span>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[rgba(0,33,71,0.12)] bg-white px-3 py-2 outline-none ring-[var(--auiq-sapphire)] focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--auiq-muted)]">
                  {t("recipientPhone")}
                </span>
                <input
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="9647XXXXXXXX"
                  dir="ltr"
                  className="w-full rounded-xl border border-[rgba(0,33,71,0.12)] bg-white px-3 py-2 outline-none ring-[var(--auiq-sapphire)] focus:ring-2"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["enabled", "enabled"],
                  ["notifyAlerts", "chanAlerts"],
                  ["notifyDaily", "chanDaily"],
                  ["notifyWeekly", "chanWeekly"],
                  ["notifyMonthly", "chanMonthly"],
                ] as const
              ).map(([key, labelKey]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={upsertRecipient}
                className="rounded-xl bg-[var(--auiq-navy)] px-4 py-2 text-sm text-white"
              >
                {editingId ? t("updateRecipient") : t("addRecipient")}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="rounded-xl border border-[rgba(0,33,71,0.15)] bg-white px-4 py-2 text-sm"
                >
                  {t("cancelEdit")}
                </button>
              ) : null}
            </div>
          </div>
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
        <h2 className="mb-4 text-lg text-[var(--auiq-navy)]">{t("sources")}</h2>
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
  const inputClass =
    "w-full rounded-xl border border-[rgba(0,33,71,0.12)] bg-white px-3 py-2 outline-none ring-[var(--auiq-sapphire)] focus:ring-2";

  return (
    <label className="block text-sm md:col-span-1">
      <span className="mb-1.5 block text-[var(--auiq-muted)]">{field.label}</span>
      <input
        type={field.secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={inputClass}
        autoComplete="off"
      />
      {field.help ? (
        <span className="mt-1 block text-xs text-[var(--auiq-muted)]">
          {t(field.help as "intervalHelp")}
        </span>
      ) : null}
    </label>
  );
}
