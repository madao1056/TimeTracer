import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { Tracker } from "./tracker.ts";
import { ReportScheduler } from "./report/scheduler.ts";
import { closeDb } from "./db.ts";
import { DATA_DIR } from "./config.ts";

const LOCK_FILE = join(DATA_DIR, "tracker.lock");

function acquireLock(): void {
  if (existsSync(LOCK_FILE)) {
    try {
      const pid = parseInt(readFileSync(LOCK_FILE, "utf-8").trim(), 10);
      try {
        process.kill(pid, 0); // プロセス存在チェック（シグナルは送らない）
        console.error(`[TimeTracer] Already running (PID ${pid}). Exiting.`);
        process.exit(1);
      } catch {
        // プロセスが存在しない → 古いロックファイル
      }
    } catch {
      // ロックファイル読み取り失敗 → 上書き
    }
  }
  writeFileSync(LOCK_FILE, String(process.pid), "utf-8");
}

function releaseLock(): void {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // 無視
  }
}

const tracker = new Tracker();
const scheduler = new ReportScheduler();
let menubarProc: ChildProcess | null = null;

function startMenubar(): void {
  const binPath = join(DATA_DIR, "bin", "TimeTracerMenu");
  if (!existsSync(binPath)) return;

  const statusPath = join(DATA_DIR, "status.json");
  menubarProc = spawn(binPath, [statusPath], {
    stdio: "ignore",
    detached: false,
  });

  menubarProc.on("error", () => {
    menubarProc = null;
  });

  menubarProc.on("exit", () => {
    menubarProc = null;
  });

  console.log("[TimeTracer] Menubar app started.");
}

function shutdown(): void {
  console.log("\n[TimeTracer] Shutting down...");
  tracker.stop();
  scheduler.stop();

  if (menubarProc) {
    menubarProc.kill();
    menubarProc = null;
  }

  closeDb();
  releaseLock();
  console.log("[TimeTracer] Goodbye!");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[TimeTracer] Starting...");
acquireLock();
tracker.start();
scheduler.start();
startMenubar();
console.log("[TimeTracer] Running. Press Ctrl+C to stop.");
