import { getScopusConfig } from "@/lib/settings";
import type {
  SourceConnectionStatus,
  SourceMetrics,
  SourcePublication,
} from "@/lib/sources/types";
import { parseYear } from "@/lib/utils";

const SEARCH_URL = "https://api.elsevier.com/content/search/scopus";
const AFFILIATION_URL = "https://api.elsevier.com/content/affiliation/affiliation_id";

type ScopusEntry = Record<string, unknown>;

function asString(value: unknown) {
  if (value == null) return null;
  return String(value);
}

function extractAuthors(entry: ScopusEntry): SourcePublication["authors"] {
  const authorList = entry.author as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(authorList) && authorList.length > 0) {
    return authorList.map((author, index) => ({
      name:
        asString(author["authname"] || author["given-name"] || author.surname) ||
        `Author ${index + 1}`,
      scopusAuthorId: asString(author["authid"]),
      order: index + 1,
    }));
  }

  const creator = asString(entry["dc:creator"]);
  return creator ? [{ name: creator, order: 1 }] : [];
}

function mapEntry(entry: ScopusEntry): SourcePublication {
  const eid = asString(entry.eid);
  const doi = asString(entry["prism:doi"]);
  const coverDate = asString(entry["prism:coverDate"]);
  const links = entry.link as Array<{ "@ref"?: string; "@href"?: string }> | undefined;

  return {
    eid,
    doi,
    title: asString(entry["dc:title"]) || "Untitled",
    publicationType: asString(entry["subtypeDescription"] || entry["prism:aggregationType"]),
    journalName: asString(entry["prism:publicationName"]),
    issn: asString(entry["prism:issn"]),
    volume: asString(entry["prism:volume"]),
    issue: asString(entry["prism:issueIdentifier"]),
    pageRange: asString(entry["prism:pageRange"]),
    coverDate,
    publishedYear: parseYear(coverDate),
    citationCount: Number(entry["citedby-count"] || 0),
    openAccess: Boolean(entry.openaccessFlag || entry.openaccess),
    scopusUrl: asString(links?.find((l) => l["@ref"] === "scopus")?.["@href"]),
    authors: extractAuthors(entry),
    rawPayload: entry,
  };
}

async function scopusFetch(url: string, apiKey: string, instToken?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-ELS-APIKey": apiKey,
  };
  if (instToken) headers["X-ELS-Insttoken"] = instToken;

  const response = await fetch(url, { headers, cache: "no-store" });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const message =
      (json as { "service-error"?: { status?: { statusText?: string } } })?.[
        "service-error"
      ]?.status?.statusText || `Scopus API error (${response.status})`;
    throw new Error(message);
  }

  return json as Record<string, unknown>;
}

export class ScopusClient {
  async getConfig() {
    return getScopusConfig();
  }

  async testConnection(): Promise<SourceConnectionStatus> {
    const config = await this.getConfig();
    if (!config.apiKey) {
      return { ok: false, message: "لم يتم إدخال مفتاح Scopus API بعد." };
    }
    if (!config.affiliationId) {
      return { ok: false, message: "لم يتم إدخال Scopus Affiliation ID." };
    }

    try {
      const query = encodeURIComponent(`AF-ID(${config.affiliationId})`);
      const url = `${SEARCH_URL}?query=${query}&count=1&start=0`;
      const data = await scopusFetch(url, config.apiKey, config.instToken);
      const results = data["search-results"] as Record<string, unknown> | undefined;
      const total = Number(results?.["opensearch:totalResults"] || 0);
      return {
        ok: true,
        message: `الاتصال ناجح. عدد المنشورات المتاحة عبر API: ${total}`,
        details: { total, affiliationId: config.affiliationId },
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "فشل الاتصال بـ Scopus API",
      };
    }
  }

  async fetchPublications(options?: {
    startYear?: number;
    onPage?: (
      page: SourcePublication[],
      pageInfo: { start: number; total: number }
    ) => Promise<void> | void;
  }): Promise<SourcePublication[]> {
    const config = await this.getConfig();
    if (!config.apiKey || !config.affiliationId) {
      throw new Error("إعدادات Scopus غير مكتملة (API Key / Affiliation ID).");
    }

    const pageSize = 25;
    const pageDelayMs = 250;
    const fields = [
      "eid",
      "dc:title",
      "prism:doi",
      "prism:coverDate",
      "prism:publicationName",
      "prism:aggregationType",
      "prism:issn",
      "prism:volume",
      "prism:issueIdentifier",
      "prism:pageRange",
      "subtypeDescription",
      "citedby-count",
      "openaccess",
      "openaccessFlag",
      "dc:creator",
      "author",
      "link",
    ].join(",");

    let start = 0;
    let total = Infinity;
    const all: SourcePublication[] = [];

    while (start < total) {
      let query = `AF-ID(${config.affiliationId})`;
      if (options?.startYear) query += ` AND PUBYEAR > ${options.startYear - 1}`;

      const url =
        `${SEARCH_URL}?query=${encodeURIComponent(query)}` +
        `&count=${pageSize}&start=${start}&sort=coverDate` +
        `&field=${encodeURIComponent(fields)}`;
      const data = await scopusFetch(url, config.apiKey, config.instToken);
      const results = data["search-results"] as Record<string, unknown>;
      total = Number(results?.["opensearch:totalResults"] || 0);
      const entries = (results?.entry as ScopusEntry[] | undefined) || [];
      if (!Array.isArray(entries) || entries.length === 0) break;

      const mapped = entries
        .filter((entry) => entry["dc:title"] || entry.eid)
        .map(mapEntry);

      all.push(...mapped);
      if (options?.onPage) await options.onPage(mapped, { start, total });

      start += pageSize;
      if (entries.length < pageSize) break;
      if (start < total) {
        await new Promise((resolve) => setTimeout(resolve, pageDelayMs));
      }
    }

    return all;
  }

  async fetchMetrics(): Promise<SourceMetrics | null> {
    const config = await this.getConfig();
    if (!config.apiKey || !config.affiliationId) return null;

    try {
      const url = `${AFFILIATION_URL}/${config.affiliationId}?view=STANDARD`;
      const data = await scopusFetch(url, config.apiKey, config.instToken);
      const profile =
        (data["affiliation-retrieval-response"] as Record<string, unknown>) || data;

      return {
        documentCount: Number(profile["document-count"] || profile.documentCount || 0),
        citationCount: Number(
          (profile as { "citation-count"?: number })["citation-count"] ?? 0
        ),
        hIndex:
          (profile as { "h-index"?: number })["h-index"] == null
            ? null
            : Number((profile as { "h-index"?: number })["h-index"]),
        authorCount: Number(profile["author-count"] || profile.authorCount || 0),
      };
    } catch {
      const status = await this.testConnection();
      if (!status.ok) return null;
      return {
        documentCount: Number(status.details?.total || 0),
        citationCount: 0,
        hIndex: null,
        authorCount: null,
      };
    }
  }
}

export const scopusClient = new ScopusClient();
