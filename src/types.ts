export interface WindowInfo {
  appName: string;
  windowTitle: string;
}

export interface TrackingRecord {
  id?: number;
  appName: string;
  windowTitle: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  sessionType: SessionType;
  date: string;
}

export type SessionType = "active" | "idle";

export interface SessionState {
  appName: string;
  windowTitle: string;
  sessionType: SessionType;
  startTime: Date;
  lastPollTime: Date;
}

export interface Config {
  pollIntervalMs: number;
  idlePollIntervalMs: number;
  idleThresholdMs: number;
  sleepGapThresholdMs: number;
  reportTime: string;
  targetActiveHours: number;
  categories: Record<string, string[]>;
}

export interface SystemPollResult {
  window: WindowInfo | null;
  idleMs: number;
}

export interface StatusData {
  state: "active" | "idle";
  currentApp: string;
  todayActiveSec: number;
  lastUpdate: string;
}

export interface AppSummary {
  appName: string;
  totalSec: number;
  category: string;
}

export interface CategorySummary {
  category: string;
  totalSec: number;
}

export interface HourlySummary {
  hour: number;
  totalSec: number;
}

export interface TimelineEntry {
  appName: string;
  startTime: string;
  endTime: string;
  durationSec: number;
}

export interface HourlyAppEntry {
  hour: number;
  appName: string;
  totalSec: number;
}

export type ReportPeriod = "daily" | "weekly" | "monthly";

export interface DailySummary {
  date: string;
  totalSec: number;
}

export interface DailyAppEntry {
  date: string;
  appName: string;
  totalSec: number;
}

export interface DailyReportData {
  date: string;
  totalActiveSec: number;
  totalIdleSec: number;
  appSummary: AppSummary[];
  categorySummary: CategorySummary[];
  hourlySummary: HourlySummary[];
  hourlyAppBreakdown: HourlyAppEntry[];
  timeline: TimelineEntry[];
}
