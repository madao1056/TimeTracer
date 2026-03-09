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

export function getHourlySummary(date: string): HourlySummary[] {
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%H', start_time) AS INTEGER) as hour,
              SUM(duration_sec) as total_sec
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'
       GROUP BY hour
       ORDER BY hour`
    )
    .all(date) as Array<{ hour: number; total_sec: number }>;

  // 0-23時の全スロットを埋める
  const hourMap = new Map(rows.map((r) => [r.hour, r.total_sec]));
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
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%H', start_time) AS INTEGER) as hour,
              app_name,
              SUM(duration_sec) as total_sec
       FROM tracking_records
       WHERE date = ? AND session_type = 'active'
       GROUP BY hour, app_name
       ORDER BY hour, total_sec DESC`
    )
    .all(date) as Array<{ hour: number; app_name: string; total_sec: number }>;

  return rows.map((r) => ({
    hour: r.hour,
    appName: r.app_name,
    totalSec: r.total_sec,
  }));
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
