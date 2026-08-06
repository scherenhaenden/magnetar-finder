#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Magnetar Finder — Angular 22  |  One-Click Launcher
#  Usage:
#    bash run-angular.sh              → auto port from 7475
#    bash run-angular.sh --port 8080  → specific port
#    bash run-angular.sh --no-browser → don't open browser
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC_DIR="$SCRIPT_DIR/angular"
DEFAULT_PORT=7475

# ── Parse args ──────────────────────────────────────────────────────
PORT="$DEFAULT_PORT"
OPEN_BROWSER=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)       PORT="$2"; shift 2 ;;
    --no-browser) OPEN_BROWSER=false; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Find a free port if the default is in use ───────────────────────
while lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; do
  ((PORT++))
done

# ── Banner ──────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║   🌌  MAGNETAR FINDER — Angular 22  (prebuilt)      ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║   URL    ▸  http://localhost:$PORT                   "
echo "  ║   Serve  ▸  Python $(python3 --version 2>&1 | cut -d' ' -f2) HTTP server"
echo "  ║   Ctrl+C to stop                                     "
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

# ── Open browser ────────────────────────────────────────────────────
if [ "$OPEN_BROWSER" = true ]; then
  (
    sleep 1
    URL="http://localhost:$PORT"
    if   command -v xdg-open &>/dev/null; then xdg-open "$URL"
    elif command -v open     &>/dev/null; then open     "$URL"
    fi
  ) &
fi

# ── Serve static files — no Node, no npm, no Angular CLI needed ─────
cd "$STATIC_DIR"
python3 -m http.server "$PORT"
