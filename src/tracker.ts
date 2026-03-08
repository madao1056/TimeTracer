import { config } from "./config.ts";
import { getActiveWindow } from "./macos/activeWindow.ts";
import { getIdleTimeMs } from "./macos/idleTime.ts";
import { SessionManager } from "./session/sessionManager.ts";

export class Tracker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionManager = new SessionManager();

  start(): void {
    console.log(`[TimeTracer] Tracking started (poll: ${config.pollIntervalMs}ms)`);

    // 初回即実行
    this.poll();

    this.timer = setInterval(() => {
      this.poll();
    }, config.pollIntervalMs);
  }

  private poll(): void {
    const now = new Date();
    const window = getActiveWindow();
    const idleMs = getIdleTimeMs();
    this.sessionManager.update(window, idleMs, now);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.sessionManager.shutdown();
    console.log("[TimeTracer] Tracking stopped");
  }
}
