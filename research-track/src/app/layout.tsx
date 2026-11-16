import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";

// Local fonts — publish builds must not depend on Google Fonts network access.
const cairo = localFont({
  src: [
    {
      path: "../fonts/cairo-arabic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/cairo-arabic-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/cairo-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/cairo-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-cairo",
  display: "swap",
});

const amiri = localFont({
  src: [
    {
      path: "../fonts/amiri-arabic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/amiri-arabic-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/amiri-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/amiri-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "جامعة العين العراقية — نظام متابعة المسار البحثي",
  description:
    "نظام مؤسسي لمراقبة Scopus ومتابعة المسار البحثي لجامعة العين العراقية",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const locale = store.get("locale")?.value === "en" ? "en" : "ar";
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className={`${cairo.variable} ${amiri.variable} antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
