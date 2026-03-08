import { Tracker } from "./tracker.ts";
import { ReportScheduler } from "./report/scheduler.ts";
import { closeDb } from "./db.ts";

const tracker = new Tracker();
const scheduler = new ReportScheduler();

function shutdown(): void {
  console.log("\n[TimeTracer] Shutting down...");
  tracker.stop();
  scheduler.stop();
  closeDb();
  console.log("[TimeTracer] Goodbye!");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[TimeTracer] Starting...");
tracker.start();
scheduler.start();
console.log("[TimeTracer] Running. Press Ctrl+C to stop.");
