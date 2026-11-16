"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SetupPage() {
  const tApp = useTranslations("app");
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data) => {
        if (!data.needsSetup) {
          router.replace("/login");
          return;
        }
        setReady(true);
      })
      .catch(() => setReady(false));
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        name: String(form.get("name") || "مدير النظام"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "فشل الإعداد");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  if (ready === null) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(196,163,90,0.22),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(13,67,119,0.28),transparent_45%),linear-gradient(160deg,#002147_0%,#0d4377_55%,#143f66_100%)]" />
      <div className="relative w-full max-w-md animate-fade-up rounded-3xl border border-white/20 bg-white/90 p-8 shadow-[0_24px_80px_rgba(0,33,71,0.28)] backdrop-blur">
        <h1 className="font-[family-name:var(--font-amiri)] text-2xl font-bold text-[var(--aui-navy)]">
          {tApp("university")}
        </h1>
        <p className="mt-2 text-sm text-[var(--aui-slate)]">
          إعداد حساب المدير لأول مرة على النسخة المستضافة
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">الاسم</label>
            <input
              name="name"
              defaultValue="مدير النظام"
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">البريد</label>
            <input
              name="email"
              type="email"
              required
              defaultValue="admin@alayen.edu.iq"
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">
              كلمة المرور (١٢ حرفاً على الأقل)
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={12}
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--aui-navy)] px-4 py-2.5 text-white transition hover:bg-[var(--aui-sapphire)] disabled:opacity-60"
          >
            {loading ? "..." : "إنشاء المدير والانتقال للدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
