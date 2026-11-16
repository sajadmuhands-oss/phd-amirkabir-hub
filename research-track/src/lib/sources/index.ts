import { scopusAdapter } from "@/lib/sources/scopus-adapter";
import type { SourceAdapter } from "@/lib/sources/types";

const stub = (code: string, nameAr: string, nameEn: string): SourceAdapter => ({
  code,
  nameAr,
  nameEn,
  async testConnection() {
    return {
      ok: false,
      message: `مصدر ${nameAr} غير مفعّل بعد. يمكن تفعيله لاحقاً من الإعدادات.`,
    };
  },
  async fetchPublications() {
    return [];
  },
  async fetchMetrics() {
    return null;
  },
});

const adapters: Record<string, SourceAdapter> = {
  scopus: scopusAdapter,
  wos: stub("wos", "Web of Science", "Web of Science"),
  scholar: stub("scholar", "Google Scholar", "Google Scholar"),
  crossref: stub("crossref", "Crossref", "Crossref"),
  orcid: stub("orcid", "ORCID", "ORCID"),
  openalex: stub("openalex", "OpenAlex", "OpenAlex"),
};

export function getSourceAdapter(code: string): SourceAdapter {
  return adapters[code] || stub(code, code, code);
}

export function listSourceAdapters() {
  return Object.values(adapters);
}
