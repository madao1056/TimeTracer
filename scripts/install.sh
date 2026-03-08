#!/bin/bash
set -euo pipefail

LABEL="com.timetracer.daemon"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${PROJECT_DIR}/data"
NODE_PATH="$(which node)"
TSX_PATH="${PROJECT_DIR}/node_modules/.bin/tsx"

mkdir -p "$LOG_DIR"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${TSX_PATH}</string>
    <string>${PROJECT_DIR}/src/index.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/timetracer.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/timetracer-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:$(dirname "$NODE_PATH")</string>
  </dict>
</dict>
</plist>
EOF

# 既存があれば一旦アンロード
launchctl unload "$PLIST_PATH" 2>/dev/null || true

launchctl load "$PLIST_PATH"
echo "[TimeTracer] Daemon installed and started."
echo "  plist: $PLIST_PATH"
echo "  logs:  $LOG_DIR/timetracer.log"
