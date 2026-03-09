import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { Tracker } from "./tracker.ts";
import { ReportScheduler } from "./report/scheduler.ts";
import { closeDb } from "./db.ts";
import { DATA_DIR } from "./config.ts";

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
  console.log("[TimeTracer] Goodbye!");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[TimeTracer] Starting...");
tracker.start();
scheduler.start();
startMenubar();
console.log("[TimeTracer] Running. Press Ctrl+C to stop.");
