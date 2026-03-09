import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { DATA_DIR } from "../config.ts";
import type { StatusData } from "../types.ts";

const STATUS_PATH = join(DATA_DIR, "status.json");

let dirEnsured = false;

export function writeStatus(
  state: "active" | "idle",
  currentApp: string,
  todayActiveSec: number
): void {
  try {
    if (!dirEnsured) {
      mkdirSync(dirname(STATUS_PATH), { recursive: true });
      dirEnsured = true;
    }

    const data: StatusData = {
      state,
      currentApp,
      todayActiveSec,
      lastUpdate: new Date().toISOString(),
    };

    writeFileSync(STATUS_PATH, JSON.stringify(data) + "\n");
  } catch {
    // ステータス書き出し失敗は無視（トラッキング本体に影響させない）
  }
}
