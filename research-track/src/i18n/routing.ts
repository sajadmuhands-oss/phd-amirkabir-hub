import { defineRouting } from "next-intl/routing";

// Locale is cookie-based (no /ar|/en URL prefix). Keep as-needed to avoid
// implying a [locale] segment that this app does not implement.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
});
