export type SourcePublication = {
  eid?: string | null;
  doi?: string | null;
  title: string;
  publicationType?: string | null;
  journalName?: string | null;
  issn?: string | null;
  volume?: string | null;
  issue?: string | null;
  pageRange?: string | null;
  coverDate?: string | null;
  publishedYear?: number | null;
  citationCount?: number;
  openAccess?: boolean;
  scopusUrl?: string | null;
  authors: Array<{
    name: string;
    scopusAuthorId?: string | null;
    order?: number;
  }>;
  rawPayload?: unknown;
};

export type SourceMetrics = {
  documentCount: number;
  citationCount: number;
  hIndex?: number | null;
  authorCount?: number | null;
};

export type SourceConnectionStatus = {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export interface SourceAdapter {
  code: string;
  nameAr: string;
  nameEn: string;
  testConnection(): Promise<SourceConnectionStatus>;
  fetchPublications(options?: {
    startYear?: number;
    onPage?: (
      page: SourcePublication[],
      pageInfo: { start: number; total: number }
    ) => Promise<void> | void;
  }): Promise<SourcePublication[]>;
  fetchMetrics(): Promise<SourceMetrics | null>;
}
