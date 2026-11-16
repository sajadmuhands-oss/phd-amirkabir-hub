import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BAGHDAD_TZ = "Asia/Baghdad";

export type PeriodRange = {
  periodKey: string;
  labelAr: string;
  start: Date;
  end: Date;
};

export function formatBaghdad(
  date: Date,
  pattern = "yyyy-MM-dd HH:mm"
) {
  return formatInTimeZone(date, BAGHDAD_TZ, pattern);
}

function baghdadParts(date: Date) {
  const datePart = formatInTimeZone(date, BAGHDAD_TZ, "yyyy-MM-dd");
  const [y, m, d] = datePart.split("-").map(Number);
  return { y, m, d, datePart };
}

function utcFromBaghdadLocal(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
  ms = 0
) {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const local = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(ms, 3)}`;
  return fromZonedTime(local, BAGHDAD_TZ);
}

function addBaghdadDays(y: number, m: number, d: number, delta: number) {
  const base = utcFromBaghdadLocal(y, m, d, 12, 0, 0);
  const shifted = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
  return baghdadParts(shifted);
}

export function getDailyPeriod(reference = new Date()): PeriodRange {
  const { y, m, d, datePart } = baghdadParts(reference);
  const start = utcFromBaghdadLocal(y, m, d, 0, 0, 0, 0);
  const next = addBaghdadDays(y, m, d, 1);
  const end = new Date(
    utcFromBaghdadLocal(next.y, next.m, next.d, 0, 0, 0, 0).getTime() - 1
  );
  return {
    periodKey: `daily:${datePart}`,
    labelAr: `التقرير اليومي — ${datePart}`,
    start,
    end,
  };
}

/** Week starts Saturday (common in Iraq) */
export function getWeeklyPeriod(reference = new Date()): PeriodRange {
  const parts = baghdadParts(reference);
  const noon = utcFromBaghdadLocal(parts.y, parts.m, parts.d, 12, 0, 0);
  const weekday = Number(formatInTimeZone(noon, BAGHDAD_TZ, "i")); // 1=Mon .. 7=Sun
  // Saturday = 6. Days since Saturday:
  const daysSinceSaturday = weekday === 6 ? 0 : (weekday + 1) % 7;
  const startParts = addBaghdadDays(parts.y, parts.m, parts.d, -daysSinceSaturday);
  const endParts = addBaghdadDays(startParts.y, startParts.m, startParts.d, 7);
  const start = utcFromBaghdadLocal(startParts.y, startParts.m, startParts.d, 0, 0, 0, 0);
  const end = new Date(
    utcFromBaghdadLocal(endParts.y, endParts.m, endParts.d, 0, 0, 0, 0).getTime() - 1
  );
  const key = formatInTimeZone(start, BAGHDAD_TZ, "yyyy-'W'II");
  return {
    periodKey: `weekly:${key}`,
    labelAr: `التقرير الأسبوعي — ${startParts.datePart} إلى ${formatInTimeZone(end, BAGHDAD_TZ, "yyyy-MM-dd")}`,
    start,
    end,
  };
}

export function getMonthlyPeriod(reference = new Date()): PeriodRange {
  const { y, m } = baghdadParts(reference);
  const start = utcFromBaghdadLocal(y, m, 1, 0, 0, 0, 0);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = new Date(utcFromBaghdadLocal(nextY, nextM, 1, 0, 0, 0, 0).getTime() - 1);
  const key = `${y}-${String(m).padStart(2, "0")}`;
  return {
    periodKey: `monthly:${key}`,
    labelAr: `التقرير الشهري — ${key}`,
    start,
    end,
  };
}

export function previousDaily(reference = new Date()) {
  return getDailyPeriod(new Date(reference.getTime() - 24 * 60 * 60 * 1000));
}

export function previousWeekly(reference = new Date()) {
  return getWeeklyPeriod(new Date(reference.getTime() - 7 * 24 * 60 * 60 * 1000));
}

export function previousMonthly(reference = new Date()) {
  const { y, m } = baghdadParts(reference);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  return getMonthlyPeriod(utcFromBaghdadLocal(prevY, prevM, 15, 12, 0, 0));
}
