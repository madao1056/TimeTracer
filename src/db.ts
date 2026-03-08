import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";
import type { TrackingRecord } from "./types.ts";

mkdirSync(DATA_DIR, { recursive: true });

const dbPath = join(DATA_DIR, "timetracer.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS tracking_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    window_title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    session_type TEXT NOT NULL CHECK(session_type IN ('active', 'idle')),
    date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_date ON tracking_records(date);
  CREATE INDEX IF NOT EXISTS idx_app_date ON tracking_records(app_name, date);
`);

const insertStmt = db.prepare(`
  INSERT INTO tracking_records (app_name, window_title, start_time, end_time, duration_sec, session_type, date)
  VALUES (@appName, @windowTitle, @startTime, @endTime, @durationSec, @sessionType, @date)
`);

export function insertRecord(record: TrackingRecord): void {
  insertStmt.run({
    appName: record.appName,
    windowTitle: record.windowTitle,
    startTime: record.startTime,
    endTime: record.endTime,
    durationSec: record.durationSec,
    sessionType: record.sessionType,
    date: record.date,
  });
}

export function closeDb(): void {
  db.close();
}
