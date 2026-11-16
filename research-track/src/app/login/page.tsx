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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-md rounded-3xl p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--aui-line)] bg-[var(--aui-mist)] text-sm font-semibold text-[var(--aui-navy)]">
            Logo
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
              defaultValue="admin@alayen.edu.iq"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--aui-slate)]">{t("password")}</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-[var(--aui-line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--aui-sapphire)]"
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
