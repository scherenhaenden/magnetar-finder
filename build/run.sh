#!/usr/bin/env bash
# ============================================================
# Magnetar Finder — One-Click Launcher
# Usage:
#   bash run.sh              → auto-detect free port from 7474
#   bash run.sh --port 8080  → specific port
#   bash run.sh --no-browser → don't open browser
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║      🔭 MAGNETAR FINDER           ║"
echo "  ║      Precision Data Explorer      ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# ── Virtual environment ───────────────────────────────────────────────────────
VENV_DIR="$PROJECT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "  [setup] Creating virtual environment…"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# ── Install deps if needed ────────────────────────────────────────────────────
if ! python3 -c "import flask" 2>/dev/null; then
  echo "  [setup] Installing dependencies…"
  pip install -q -r "$PROJECT_DIR/requirements.txt"
fi

# ── Launch app ────────────────────────────────────────────────────────────────
echo "  [start] Launching server…"
cd "$PROJECT_DIR"
python3 run.py "$@"
