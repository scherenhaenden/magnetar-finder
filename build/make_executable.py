#!/usr/bin/env python3
"""
Generates a single self-contained bash executable for Magnetar Finder Angular.
The executable embeds all static files as base64 and uses Python's http.server.
"""
import base64
import os

BUILD_DIR = os.path.join(os.path.dirname(__file__), "angular")
OUTPUT    = os.path.join(os.path.dirname(__file__), "magnetar-finder-angular")

# Collect all files
files = {}
for fname in sorted(os.listdir(BUILD_DIR)):
    fpath = os.path.join(BUILD_DIR, fname)
    if os.path.isfile(fpath):
        with open(fpath, "rb") as f:
            files[fname] = base64.b64encode(f.read()).decode("ascii")

# Build the script
lines = []
lines.append("#!/usr/bin/env bash")
lines.append("# ═══════════════════════════════════════════════════════════════════")
lines.append("#  🌌  MAGNETAR FINDER — Angular 22  |  Self-contained executable")
lines.append("#  Double-click or: bash magnetar-finder-angular")
lines.append("#  Only requires python3 (pre-installed on Linux / macOS)")
lines.append("# ═══════════════════════════════════════════════════════════════════")
lines.append("set -euo pipefail")
lines.append("")
lines.append("DEFAULT_PORT=7475")
lines.append("OPEN_BROWSER=true")
lines.append("")
lines.append("while [[ $# -gt 0 ]]; do")
lines.append("  case \"$1\" in")
lines.append("    --port)       DEFAULT_PORT=\"$2\"; shift 2 ;;")
lines.append("    --no-browser) OPEN_BROWSER=false; shift ;;")
lines.append("    *)            echo \"Unknown arg: $1\"; exit 1 ;;")
lines.append("  esac")
lines.append("done")
lines.append("")
lines.append("# Find a free port")
lines.append("PORT=$DEFAULT_PORT")
lines.append("while python3 -c \"import socket; s=socket.socket(); s.connect(('127.0.0.1',$PORT)); s.close()\" 2>/dev/null; do")
lines.append("  ((PORT++))")
lines.append("done")
lines.append("")
lines.append("# Extract files to temp directory")
lines.append("APP_TMP=$(mktemp -d /tmp/magnetar-finder-XXXXXX)")
lines.append("trap 'rm -rf \"$APP_TMP\"' EXIT INT TERM")
lines.append("")
lines.append("echo \"\"")
lines.append("echo \"  ╔══════════════════════════════════════════════════════╗\"")
lines.append("echo \"  ║   🌌  MAGNETAR FINDER — Angular 22                  ║\"")
lines.append("echo \"  ╠══════════════════════════════════════════════════════╣\"")
lines.append("echo \"  ║   URL    ▸  http://localhost:$PORT                   \"")
lines.append("echo \"  ║   Ctrl+C to stop                                     \"")
lines.append("echo \"  ╚══════════════════════════════════════════════════════╝\"")
lines.append("echo \"\"")
lines.append("")
lines.append("python3 - \"$APP_TMP\" <<'PYEOF'")
lines.append("import base64, os, sys")
lines.append("outdir = sys.argv[1]")
lines.append("files = {")

for fname, b64 in files.items():
    # split long base64 into chunks to avoid shell line-length limits
    lines.append(f"    {repr(fname)}: (")
    chunk_size = 76
    chunks = [b64[i:i+chunk_size] for i in range(0, len(b64), chunk_size)]
    for chunk in chunks:
        lines.append(f"        {repr(chunk)}")
    lines.append("    ),")

lines.append("}")
lines.append("for name, parts in files.items():")
lines.append("    data = base64.b64decode(''.join(parts) if isinstance(parts, tuple) else parts)")
lines.append("    with open(os.path.join(outdir, name), 'wb') as fh:")
lines.append("        fh.write(data)")
lines.append("print(f'  Extracted {len(files)} files to {outdir}')")
lines.append("PYEOF")
lines.append("")
lines.append("# Open browser after 1 second")
lines.append("if [ \"$OPEN_BROWSER\" = true ]; then")
lines.append("  (")
lines.append("    sleep 1")
lines.append("    URL=\"http://localhost:$PORT\"")
lines.append("    if   command -v xdg-open &>/dev/null; then xdg-open \"$URL\"")
lines.append("    elif command -v open     &>/dev/null; then open     \"$URL\"")
lines.append("    fi")
lines.append("  ) &")
lines.append("fi")
lines.append("")
lines.append("# Serve the extracted static files")
lines.append("cd \"$APP_TMP\"")
lines.append("exec python3 -m http.server \"$PORT\" --bind localhost 2>/dev/null")
lines.append("")

script_content = "\n".join(lines)

with open(OUTPUT, "w") as f:
    f.write(script_content)

os.chmod(OUTPUT, 0o755)

total_size = sum(len(v) * 3 // 4 for v in files.values())
print(f"✅ Created: {OUTPUT}")
print(f"   Files embedded: {len(files)}")
print(f"   Approx payload: {total_size // 1024} KB")
print(f"   Script size: {os.path.getsize(OUTPUT) // 1024} KB")
