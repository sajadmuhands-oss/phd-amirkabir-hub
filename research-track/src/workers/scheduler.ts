import { Queue } from "bullmq";
import { getConnectionOptions, QUEUE_NAMES } from "@/lib/queue";
import { getReportScheduleConfig } from "@/lib/settings";

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parseHourMinute(time: string) {
  const [h, m] = time.split(":").map((v) => Number(v));
  return {
    hour: Number.isFinite(h) ? h : 21,
    minute: Number.isFinite(m) ? m : 0,
  };
}

export async function setupRepeatableJobs() {
  const config = await getReportScheduleConfig();
  const connection = getConnectionOptions();

  const monitorQueue = new Queue(QUEUE_NAMES.monitor, { connection });
  const reportsQueue = new Queue(QUEUE_NAMES.reports, { connection });

  const existingMonitor = await monitorQueue.getRepeatableJobs();
  for (const job of existingMonitor) {
    await monitorQueue.removeRepeatableByKey(job.key);
  }

  const existingReports = await reportsQueue.getRepeatableJobs();
  for (const job of existingReports) {
    await reportsQueue.removeRepeatableByKey(job.key);
  }

  const everyMs =
    Math.max(5, config.monitorIntervalMinutes || 60) * 60 * 1000;
  await monitorQueue.add(
    "scan",
    { triggeredBy: "scheduler" },
    {
      repeat: { every: everyMs, tz: config.timezone },
      jobId: "monitor-repeat",
    }
  );

  if (config.daily.enabled) {
    const { hour, minute } = parseHourMinute(config.daily.time);
    await reportsQueue.add(
      "generate",
      { reportType: "DAILY" },
      {
        repeat: {
          pattern: `${minute} ${hour} * * *`,
          tz: config.timezone,
        },
        jobId: "report-daily",
      }
    );
  }

  if (config.weekly.enabled) {
    const { hour, minute } = parseHourMinute(config.weekly.time);
    const dow = WEEKDAY_MAP[config.weekly.day.toLowerCase()] ?? 5;
    await reportsQueue.add(
      "generate",
      { reportType: "WEEKLY" },
      {
        repeat: {
          pattern: `${minute} ${hour} * * ${dow}`,
          tz: config.timezone,
        },
        jobId: "report-weekly",
      }
    );
  }

  if (config.monthly.enabled) {
    const { hour, minute } = parseHourMinute(config.monthly.time);
    const day = Math.min(28, Math.max(1, config.monthly.day));
    await reportsQueue.add(
      "generate",
      { reportType: "MONTHLY" },
      {
        repeat: {
          pattern: `${minute} ${hour} ${day} * *`,
          tz: config.timezone,
        },
        jobId: "report-monthly",
      }
    );
  }

  await monitorQueue.close();
  await reportsQueue.close();

  return {
    timezone: config.timezone,
    monitorEveryMinutes: config.monitorIntervalMinutes,
    daily: config.daily,
    weekly: config.weekly,
    monthly: config.monthly,
  };
}
