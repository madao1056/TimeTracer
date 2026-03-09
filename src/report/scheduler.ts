import { config } from "../config.ts";
import { generateDailyJson, ensureViewer } from "./reportGenerator.ts";

export class ReportScheduler {
  private dailyTimer: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    ensureViewer();
    this.scheduleDailyNext();
    console.log(`[TimeTracer] Report scheduled - daily JSON at ${config.reportTime}`);
  }

  private scheduleDailyNext(): void {
    const delayMs = this.msUntilDailyReport();
    this.dailyTimer = setTimeout(() => {
      try {
        generateDailyJson();
      } catch (e) {
        console.error("[TimeTracer] Daily JSON generation failed:", e);
      }
      this.scheduleDailyNext();
    }, delayMs);
  }

  private msUntilDailyReport(): number {
    const [hours, minutes] = config.reportTime.split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  stop(): void {
    if (this.dailyTimer) {
      clearTimeout(this.dailyTimer);
      this.dailyTimer = null;
    }
  }
}
