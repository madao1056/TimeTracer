import { execSync } from "node:child_process";
import type { WindowInfo } from "../types.ts";

const APPLE_SCRIPT = `
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
`;

export function getActiveWindow(): WindowInfo | null {
  try {
    const result = execSync(`osascript -e '${APPLE_SCRIPT.replace(/'/g, "'\\''")}'`, {
      timeout: 3000,
      encoding: "utf-8",
    }).trim();

    const [appName, windowTitle] = result.split("|||");
    if (!appName) return null;

    return {
      appName: appName.trim(),
      windowTitle: (windowTitle ?? "").trim(),
    };
  } catch {
    return null;
  }
}
