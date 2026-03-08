import { config } from "../config.ts";
import { insertRecord } from "../db.ts";
import type { SessionState, SessionType, WindowInfo } from "../types.ts";

function toISOString(date: Date): string {
  return date.toISOString();
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export class SessionManager {
  private current: SessionState | null = null;

  /**
   * ポーリングごとに呼ばれる。状態遷移を判定し、セッション区切りでDBに書き込む。
   */
  update(window: WindowInfo | null, idleMs: number, now: Date): void {
    const isIdle = idleMs >= config.idleThresholdMs;

    // スリープ検出: 前回ポーリングからの経過時間が閾値を超えていたら
    if (this.current) {
      const gap = now.getTime() - this.current.lastPollTime.getTime();
      if (gap >= config.sleepGapThresholdMs) {
        this.flush(this.current.lastPollTime);
        this.current = null;
      }
    }

    if (!window) {
      // ウィンドウ取得失敗時は現在セッションを継続
      if (this.current) {
        this.current.lastPollTime = now;
      }
      return;
    }

    const newType: SessionType = isIdle ? "idle" : "active";
    const appName = isIdle ? "(idle)" : window.appName;
    const windowTitle = isIdle ? "" : window.windowTitle;

    if (!this.current) {
      // 初回
      this.current = {
        appName,
        windowTitle,
        sessionType: newType,
        startTime: now,
        lastPollTime: now,
      };
      return;
    }

    // セッション切替判定: アプリ変更 or active/idle遷移
    const appChanged = this.current.appName !== appName;
    const typeChanged = this.current.sessionType !== newType;

    if (appChanged || typeChanged) {
      this.flush(now);
      this.current = {
        appName,
        windowTitle,
        sessionType: newType,
        startTime: now,
        lastPollTime: now,
      };
    } else {
      // 同一セッション継続
      this.current.windowTitle = windowTitle;
      this.current.lastPollTime = now;
    }
  }

  /**
   * 現在のセッションをDBに書き込んで終了
   */
  flush(endTime?: Date): void {
    if (!this.current) return;

    const end = endTime ?? this.current.lastPollTime;
    const durationSec = (end.getTime() - this.current.startTime.getTime()) / 1000;

    if (durationSec < 1) return;

    insertRecord({
      appName: this.current.appName,
      windowTitle: this.current.windowTitle,
      startTime: toISOString(this.current.startTime),
      endTime: toISOString(end),
      durationSec: Math.round(durationSec),
      sessionType: this.current.sessionType,
      date: toDateString(this.current.startTime),
    });
  }

  /**
   * シャットダウン時に呼ぶ
   */
  shutdown(): void {
    this.flush(new Date());
    this.current = null;
  }
}
