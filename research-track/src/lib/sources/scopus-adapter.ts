import { scopusClient } from "@/lib/scopus/client";
import type { SourceAdapter } from "@/lib/sources/types";

export const scopusAdapter: SourceAdapter = {
  code: "scopus",
  nameAr: "Scopus",
  nameEn: "Scopus",
  testConnection: () => scopusClient.testConnection(),
  fetchPublications: (options) => scopusClient.fetchPublications(options),
  fetchMetrics: () => scopusClient.fetchMetrics(),
};
