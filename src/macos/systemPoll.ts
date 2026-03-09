import { execSync } from "node:child_process";
import type { SystemPollResult, WindowInfo } from "../types.ts";

const SEPARATOR = "---TIMETRACER_SEP---";

/**
 * osascript（アクティブウィンドウ取得）と ioreg（アイドル時間取得）を
 * 1回の execSync で実行し、プロセス生成を半減させる
 */
const POLL_SCRIPT = `
app=$(osascript -e '
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set winTitle to name of front window of frontApp
  on error
    set winTitle to ""
  end try
  return appName & "|||" & winTitle
end tell
' 2>/dev/null || echo "")
echo "$app"
echo "${SEPARATOR}"
ioreg -c IOHIDSystem | awk '/HIDIdleTime/{print $NF; exit}'
`;

export function pollSystem(): SystemPollResult {
  try {
    const raw = execSync(POLL_SCRIPT, {
      timeout: 5000,
      encoding: "utf-8",
      shell: "/bin/bash",
    }).trim();

    const parts = raw.split(SEPARATOR);
    const windowRaw = (parts[0] ?? "").trim();
    const idleRaw = (parts[1] ?? "").trim();

    let window: WindowInfo | null = null;
    if (windowRaw) {
      const [appName, windowTitle] = windowRaw.split("|||");
      if (appName) {
        window = {
          appName: appName.trim(),
          windowTitle: (windowTitle ?? "").trim(),
        };
      }
    }

    let idleMs = 0;
    if (idleRaw) {
      const nanoSec = BigInt(idleRaw);
      idleMs = Number(nanoSec / 1_000_000n);
    }

    return { window, idleMs };
  } catch {
    return { window: null, idleMs: 0 };
  }
}
