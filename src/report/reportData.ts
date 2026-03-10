import { db } from "../db.ts";
import { config } from "../config.ts";
import type { AppSummary, CategorySummary, DailyReportData, HourlyAppEntry, HourlySummary, TimelineEntry } from "../types.ts";

function categorize(appName: string): string {
  for (const [category, apps] of Object.entries(config.categories)) {
    if (apps.some((a) => appName.toLowerCase().includes(a.toLowerCase()))) {
      return category;
    }
  }
  return "other";
}

export function getAppSummary(date: string): AppSummary[] {
  const rows = db
    .prepare(
      `SELECT app_name, SUM(duration_sec) as total_sec
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'
       GROUP BY app_name
       ORDER BY total_sec DESC`
    )
    .all(date) as Array<{ app_name: string; total_sec: number }>;

  return rows.map((r) => ({
    appName: r.app_name,
    totalSec: r.total_sec,
    category: categorize(r.app_name),
  }));
}

export function getCategorySummary(date: string): CategorySummary[] {
  const appSummary = getAppSummary(date);
  const map = new Map<string, number>();

  for (const app of appSummary) {
    map.set(app.category, (map.get(app.category) ?? 0) + app.totalSec);
  }

  return Array.from(map.entries())
    .map(([category, totalSec]) => ({ category, totalSec }))
    .sort((a, b) => b.totalSec - a.totalSec);
}

/** セッションを時間境界で分割し、各時間帯への秒数を返す */
function splitByHour(startTime: string, durationSec: number): Array<{ hour: number; sec: number }> {
  const start = new Date(startTime);
  const localStart = new Date(start.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  let remaining = durationSec;
  let cursor = localStart;
  const result: Array<{ hour: number; sec: number }> = [];

  while (remaining > 0) {
    const hour = cursor.getHours();
    const nextHour = new Date(cursor);
    nextHour.setHours(hour + 1, 0, 0, 0);
    const secsUntilNextHour = Math.max((nextHour.getTime() - cursor.getTime()) / 1000, 0);
    const allocated = Math.min(remaining, secsUntilNextHour);
    if (allocated > 0) {
      result.push({ hour, sec: Math.round(allocated) });
    }
    remaining -= allocated;
    cursor = nextHour;
  }
  return result;
}

function getRawActiveRecords(date: string): Array<{ start_time: string; duration_sec: number; app_name: string }> {
  return db
    .prepare(
      `SELECT start_time, duration_sec, app_name
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'`
    )
    .all(date) as Array<{ start_time: string; duration_sec: number; app_name: string }>;
}

export function getHourlySummary(date: string): HourlySummary[] {
  const records = getRawActiveRecords(date);
  const hourMap = new Map<number, number>();

  for (const r of records) {
    for (const { hour, sec } of splitByHour(r.start_time, r.duration_sec)) {
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + sec);
    }
  }

  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    totalSec: hourMap.get(i) ?? 0,
  }));
}

export function getTimeline(date: string): TimelineEntry[] {
  const rows = db
    .prepare(
      `SELECT app_name, start_time, end_time, duration_sec
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'
       ORDER BY start_time`
    )
    .all(date) as Array<{
      app_name: string;
      start_time: string;
      end_time: string;
      duration_sec: number;
    }>;

  return rows.map((r) => ({
    appName: r.app_name,
    startTime: r.start_time,
    endTime: r.end_time,
    durationSec: r.duration_sec,
  }));
}

export function getHourlyAppBreakdown(date: string): HourlyAppEntry[] {
  const records = getRawActiveRecords(date);
  const map = new Map<string, number>(); // key: "hour:appName"

  for (const r of records) {
    for (const { hour, sec } of splitByHour(r.start_time, r.duration_sec)) {
      const key = `${hour}:${r.app_name}`;
      map.set(key, (map.get(key) ?? 0) + sec);
    }
  }

  return Array.from(map.entries())
    .map(([key, totalSec]) => {
      const sep = key.indexOf(":");
      return {
        hour: parseInt(key.substring(0, sep), 10),
        appName: key.substring(sep + 1),
        totalSec,
      };
    })
    .sort((a, b) => a.hour - b.hour || b.totalSec - a.totalSec);
}

export function getTotalActiveSec(date: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(duration_sec), 0) as total
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'`
    )
    .get(date) as { total: number };
  return row.total;
}

export function getTotalIdleSec(date: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(duration_sec), 0) as total
       FROM tracking_records
       WHERE date = ? AND session_type = 'idle'`
    )
    .get(date) as { total: number };
  return row.total;
}

// --- 1日分の全データをまとめて返す ---

export function exportDailyData(date: string): DailyReportData {
  return {
    date,
    totalActiveSec: getTotalActiveSec(date),
    totalIdleSec: getTotalIdleSec(date),
    appSummary: getAppSummary(date),
    categorySummary: getCategorySummary(date),
    hourlySummary: getHourlySummary(date),
    hourlyAppBreakdown: getHourlyAppBreakdown(date),
    timeline: getTimeline(date),
  };
}
