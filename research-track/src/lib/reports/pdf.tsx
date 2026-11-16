import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportPayload } from "@/lib/reports/builder";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#002147",
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: "#0D4377",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#0D4377",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 6,
    color: "#0D4377",
  },
  row: {
    marginBottom: 3,
  },
  muted: {
    color: "#555555",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 9,
    color: "#666666",
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    paddingTop: 8,
  },
});

function ReportDocument({ payload }: { payload: ReportPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{payload.institutionName}</Text>
          <Text style={styles.subtitle}>Research Track Monitoring Report</Text>
          <Text style={styles.muted}>{payload.period.labelAr}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary metrics</Text>
          <Text style={styles.row}>Documents: {payload.totals.documents}</Text>
          <Text style={styles.row}>Citations: {payload.totals.citations}</Text>
          <Text style={styles.row}>Authors: {payload.totals.authors}</Text>
          <Text style={styles.row}>H-index: {payload.totals.hIndex ?? "—"}</Text>
          <Text style={styles.row}>
            New in period: {payload.newPublications.length}
          </Text>
          <Text style={styles.row}>Updates: {payload.updates}</Text>
          <Text style={styles.row}>Removals: {payload.removals}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New publications</Text>
          {payload.newPublications.length === 0 ? (
            <Text style={styles.muted}>No new publications in this period.</Text>
          ) : (
            payload.newPublications.slice(0, 25).map((pub, index) => (
              <Text key={`${pub.title}-${index}`} style={styles.row}>
                {index + 1}. {pub.title}
                {pub.year ? ` (${pub.year})` : ""}
                {pub.journal ? ` — ${pub.journal}` : ""}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top journals</Text>
          {payload.topJournals.length === 0 ? (
            <Text style={styles.muted}>No journal data yet.</Text>
          ) : (
            payload.topJournals.map((j) => (
              <Text key={j.name} style={styles.row}>
                {j.name}: {j.count}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top authors</Text>
          {payload.topAuthors.length === 0 ? (
            <Text style={styles.muted}>No author data yet.</Text>
          ) : (
            payload.topAuthors.map((a) => (
              <Text key={a.name} style={styles.row}>
                {a.name}: {a.count}
              </Text>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text>
            Al-Ayen Iraqi University — Scopus AF-ID 60118739 — Asia/Baghdad
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(payload: ReportPayload): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReportDocument payload={payload} />);
  return Buffer.from(buffer);
}
