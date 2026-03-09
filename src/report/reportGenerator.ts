import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.ts";
import { exportDailyData } from "./reportData.ts";
import { generateViewerHtml } from "./htmlTemplate.ts";

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 1日分のデータをJSONファイルとして出力 */
export function generateDailyJson(date?: string): string {
  const targetDate = date ?? todayString();
  const reportDir = join(DATA_DIR, "reports");
  mkdirSync(reportDir, { recursive: true });

  const data = exportDailyData(targetDate);
  const filePath = join(reportDir, `${targetDate}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[TimeTracer] Daily JSON generated: ${filePath}`);
  return filePath;
}

/** reportsディレクトリ内の全JSONを読み込んでMapとして返す */
function loadAllReportData(): Record<string, unknown> {
  const reportDir = join(DATA_DIR, "reports");
  const store: Record<string, unknown> = {};
  if (!existsSync(reportDir)) return store;

  for (const file of readdirSync(reportDir)) {
    if (!file.endsWith(".json")) continue;
    const date = file.replace(".json", "");
    try {
      const raw = readFileSync(join(reportDir, file), "utf-8");
      store[date] = JSON.parse(raw);
    } catch {
      // 壊れたJSONは無視
    }
  }
  return store;
}

/** ビューワーHTMLを出力（既存なら上書き） */
export function generateViewer(): string {
  const reportDir = join(DATA_DIR, "reports");
  mkdirSync(reportDir, { recursive: true });

  const embeddedData = loadAllReportData();
  const html = generateViewerHtml(embeddedData);
  const filePath = join(reportDir, "index.html");
  writeFileSync(filePath, html, "utf-8");
  console.log(`[TimeTracer] Viewer generated: ${filePath}`);
  return filePath;
}

/** ビューワーが存在しなければ生成 */
export function ensureViewer(): void {
  const viewerPath = join(DATA_DIR, "reports", "index.html");
  if (!existsSync(viewerPath)) {
    generateViewer();
  }
}

/** 日次JSON + ビューワー生成（後方互換） */
export function generateReport(date?: string): string {
  generateDailyJson(date);
  ensureViewer();
  return join(DATA_DIR, "reports", `${date ?? todayString()}.json`);
}

// CLI直接実行時
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const isViewerOnly = args.includes("--viewer");
  const dateIdx = args.indexOf("--date");
  const dateArg = dateIdx !== -1 ? args[dateIdx + 1] : undefined;

  if (isViewerOnly) {
    generateViewer();
  } else {
    generateDailyJson(dateArg);
    generateViewer();
  }
}
