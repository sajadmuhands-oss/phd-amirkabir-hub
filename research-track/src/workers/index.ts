import { Worker } from "bullmq";
import { ReportType } from "@prisma/client";
import { runMonitoringScan } from "@/lib/monitoring/engine";
import { getConnectionOptions, QUEUE_NAMES } from "@/lib/queue";
import { generateReport, generateTestReport } from "@/lib/reports/builder";
import { setupRepeatableJobs } from "@/workers/scheduler";

async function main() {
  console.log("[worker] starting research-track workers...");
  const schedule = await setupRepeatableJobs();
  console.log("[worker] schedule configured:", schedule);

  const monitorWorker = new Worker(
    QUEUE_NAMES.monitor,
    async (job) => {
      const triggeredBy =
        (job.data?.triggeredBy as string | undefined) || "scheduler";
      console.log(`[monitor] scan started (${triggeredBy})`);
      const result = await runMonitoringScan({ triggeredBy });
      console.log("[monitor] scan finished:", result);
      return result;
    },
    { connection: getConnectionOptions(), concurrency: 1 }
  );

  const reportsWorker = new Worker(
    QUEUE_NAMES.reports,
    async (job) => {
      const reportType = (job.data?.reportType as string) || "DAILY";
      const force = Boolean(job.data?.force);
      console.log(`[reports] generating ${reportType}`);

      if (reportType === "TEST") {
        return generateTestReport();
      }

      const type =
        reportType === "WEEKLY"
          ? ReportType.WEEKLY
          : reportType === "MONTHLY"
            ? ReportType.MONTHLY
            : ReportType.DAILY;

      return generateReport({
        reportType: type,
        sendWhatsApp: true,
        force,
      });
    },
    { connection: getConnectionOptions(), concurrency: 1 }
  );

  monitorWorker.on("failed", (job, err) => {
    console.error("[monitor] job failed", job?.id, err.message);
  });
  reportsWorker.on("failed", (job, err) => {
    console.error("[reports] job failed", job?.id, err.message);
  });

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    await Promise.all([monitorWorker.close(), reportsWorker.close()]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
