import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAMES = {
  monitor: "research-monitor",
  reports: "research-reports",
} as const;

let connection: IORedis | null = null;

export function getRedisConnection() {
  if (!connection) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function getConnectionOptions(): ConnectionOptions {
  return getRedisConnection() as unknown as ConnectionOptions;
}

let monitorQueue: Queue | null = null;
let reportsQueue: Queue | null = null;

export function getMonitorQueue() {
  if (!monitorQueue) {
    monitorQueue = new Queue(QUEUE_NAMES.monitor, {
      connection: getConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return monitorQueue;
}

export function getReportsQueue() {
  if (!reportsQueue) {
    reportsQueue = new Queue(QUEUE_NAMES.reports, {
      connection: getConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
      },
    });
  }
  return reportsQueue;
}

export async function enqueueMonitorScan(triggeredBy = "manual") {
  const queue = getMonitorQueue();
  return queue.add(
    "scan",
    { triggeredBy },
    {
      jobId: `scan:${triggeredBy}:${Date.now()}`,
    }
  );
}

export async function enqueueReport(
  reportType: "DAILY" | "WEEKLY" | "MONTHLY" | "TEST",
  force = false
) {
  const queue = getReportsQueue();
  return queue.add(
    "generate",
    { reportType, force },
    {
      jobId: force
        ? `report:${reportType}:force:${Date.now()}`
        : `report:${reportType}:${new Date().toISOString().slice(0, 13)}`,
    }
  );
}
