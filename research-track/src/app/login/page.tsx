"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(t("error"));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(196,163,90,0.22),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(13,67,119,0.28),transparent_45%),linear-gradient(160deg,#002147_0%,#0d4377_55%,#143f66_100%)]" />
      <div className="relative w-full max-w-md animate-fade-up rounded-3xl border border-white/20 bg-white/90 p-8 shadow-[0_24px_80px_rgba(0,33,71,0.28)] backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--aui-line)] bg-[linear-gradient(145deg,#002147,#0d4377)] font-[family-name:var(--font-amiri)] text-2xl font-bold text-[var(--aui-gold)] shadow-inner">
            ع
          </div>
          <h1 className="font-[family-name:var(--font-amiri)] text-2xl font-bold text-[var(--aui-navy)]">
            {tApp("university")}
          </h1>
          <p className="mt-1 text-sm text-[var(--aui-slate)]">{tApp("system")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">{t("email")}</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
              autoComplete="username"
              placeholder="admin@alayen.edu.iq"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">{t("password")}</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--aui-navy)] px-4 py-2.5 text-white transition hover:bg-[var(--aui-sapphire)] disabled:opacity-60"
          >
            {loading ? "..." : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
