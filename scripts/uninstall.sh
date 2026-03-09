#!/bin/bash
set -euo pipefail

LABEL="com.timetracer.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MENUBAR_BIN="${PROJECT_DIR}/data/bin/TimeTracerMenu"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm "$PLIST_PATH"
  echo "[TimeTracer] Daemon uninstalled."
else
  echo "[TimeTracer] Daemon plist not found. Nothing to uninstall."
fi

# メニューバーアプリのバイナリ削除
if [ -f "$MENUBAR_BIN" ]; then
  rm "$MENUBAR_BIN"
  echo "[TimeTracer] Menubar binary removed."
fi
