import { execSync } from "node:child_process";

/**
 * ioregからHIDIdleTimeを取得し、ミリ秒で返す
 */
export function getIdleTimeMs(): number {
  try {
    const result = execSync(
      'ioreg -c IOHIDSystem | grep HIDIdleTime | head -1',
      { timeout: 3000, encoding: "utf-8" }
    ).trim();

    const match = result.match(/= (\d+)/);
    if (!match) return 0;

    // HIDIdleTime はナノ秒単位
    const nanoSec = BigInt(match[1]);
    return Number(nanoSec / 1_000_000n);
  } catch {
    return 0;
  }
}
