import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const DEFAULT_CONFIG: Config = {
  pollIntervalMs: 5000,
  idlePollIntervalMs: 30_000,
  idleThresholdMs: 300_000,
  sleepGapThresholdMs: 30_000,
  reportTime: "23:55",
  targetActiveHours: 8,
  categories: {},
};

function loadConfig(): Config {
  try {
    const raw = readFileSync(join(PROJECT_ROOT, "config.json"), "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export const config = loadConfig();
export const DATA_DIR = join(PROJECT_ROOT, "data");
