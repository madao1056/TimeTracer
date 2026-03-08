import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.ts";
import {
  getAppSummary,
  getCategorySummary,
  getHourlyAppBreakdown,
  getHourlySummary,
  getTimeline,
  getTotalActiveSec,
  getTotalIdleSec,
} from "./reportData.ts";
import { generateHtml } from "./htmlTemplate.ts";

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function generateReport(date?: string): string {
  const targetDate = date ?? todayString();
  const reportDir = join(DATA_DIR, "reports");
  mkdirSync(reportDir, { recursive: true });

  const html = generateHtml({
    date: targetDate,
    totalActiveSec: getTotalActiveSec(targetDate),
    totalIdleSec: getTotalIdleSec(targetDate),
    appSummary: getAppSummary(targetDate),
    categorySummary: getCategorySummary(targetDate),
    hourlySummary: getHourlySummary(targetDate),
    hourlyAppBreakdown: getHourlyAppBreakdown(targetDate),
    timeline: getTimeline(targetDate),
  });

  const filePath = join(reportDir, `report-${targetDate}.html`);
  writeFileSync(filePath, html, "utf-8");
  console.log(`[TimeTracer] Report generated: ${filePath}`);
  return filePath;
}

// CLI直接実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  const date = process.argv[2];
  generateReport(date);
}
