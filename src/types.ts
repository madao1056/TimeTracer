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
  idleThresholdMs: number;
  sleepGapThresholdMs: number;
  reportTime: string;
  categories: Record<string, string[]>;
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
