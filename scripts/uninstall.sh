#!/bin/bash
set -euo pipefail

LABEL="com.timetracer.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  rm "$PLIST_PATH"
  echo "[TimeTracer] Daemon uninstalled."
else
  echo "[TimeTracer] Daemon plist not found. Nothing to uninstall."
fi
