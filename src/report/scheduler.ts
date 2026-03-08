import { config } from "../config.ts";
import { generateReport } from "./reportGenerator.ts";

export class ReportScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    this.scheduleNext();
    console.log(`[TimeTracer] Report scheduled at ${config.reportTime}`);
  }

  private scheduleNext(): void {
    const delayMs = this.msUntilReportTime();
    this.timer = setTimeout(() => {
      try {
        generateReport();
      } catch (e) {
        console.error("[TimeTracer] Report generation failed:", e);
      }
      // 翌日分を再スケジュール
      this.scheduleNext();
    }, delayMs);
  }

  private msUntilReportTime(): number {
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
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
