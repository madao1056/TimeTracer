import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { config, DATA_DIR } from "./config.ts";
import { pollSystem } from "./macos/systemPoll.ts";
import { writeStatus } from "./macos/statusWriter.ts";
import { SessionManager } from "./session/sessionManager.ts";
import { generateReport } from "./report/reportGenerator.ts";

const REPORT_TRIGGER = join(DATA_DIR, ".report-trigger");

export class Tracker {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sessionManager = new SessionManager();
  private todayActiveSec = 0;
  private currentDate = "";

  start(): void {
    console.log(
      `[TimeTracer] Tracking started (active: ${config.pollIntervalMs}ms, idle: ${config.idlePollIntervalMs}ms)`
    );

    this.currentDate = this.todayStr();
    this.poll();
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private poll(): void {
    const now = new Date();

    // 日付が変わったらカウンタリセット
    const today = this.todayStr();
    if (today !== this.currentDate) {
      this.todayActiveSec = 0;
      this.currentDate = today;
    }

    const { window, idleMs } = pollSystem();
    const isIdle = idleMs >= config.idleThresholdMs;

    this.sessionManager.update(window, idleMs, now);

    // アクティブ時間を累積（ポーリング間隔分を加算）
    if (!isIdle && window) {
      this.todayActiveSec += Math.round(
        (this.timer === null ? 0 : (isIdle ? config.idlePollIntervalMs : config.pollIntervalMs)) / 1000
      );
    }

    // ステータス書き出し
    writeStatus(
      isIdle ? "idle" : "active",
      window?.appName ?? "",
      this.todayActiveSec
    );

    // トリガーファイルがあればレポート生成
    this.checkReportTrigger();

    // アダプティブポーリング: アイドル時は間隔を延長
    const nextDelay = isIdle ? config.idlePollIntervalMs : config.pollIntervalMs;
    this.scheduleNext(nextDelay);
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.poll();
    }, delayMs);
  }

  private checkReportTrigger(): void {
    try {
      if (existsSync(REPORT_TRIGGER)) {
        unlinkSync(REPORT_TRIGGER);
        this.sessionManager.flush(new Date());
        generateReport();
        console.log("[TimeTracer] Report generated via trigger.");
      }
    } catch {
      // 無視
    }
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.sessionManager.shutdown();
    console.log("[TimeTracer] Tracking stopped");
  }
}
