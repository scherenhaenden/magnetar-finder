"""
Magnetar Finder — Main entry point.
Starts the Flask dev server and opens the browser automatically.
"""
import argparse
import socket
import threading
import webbrowser
import os
import sys
import subprocess

# Ensure the project root is on the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app


def find_free_port(start: int = 7474) -> int:
    """Try ports starting at `start` until a free one is found."""
    port = start
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("No free port found in range 7474–65535")


def main():
    parser = argparse.ArgumentParser(
        description="Magnetar Finder — SQLite explorer and research tool"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port to run on (default: auto-detect from 7474)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open the browser automatically",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--verify-ui",
        action="store_true",
        help="Run the Playwright UI verification against this server after startup",
    )
    args = parser.parse_args()

    port = args.port if args.port else find_free_port(7474)
    app = create_app()

    url = f"http://{args.host}:{port}"
    print(f"\n  🔭 Magnetar Finder running at: {url}\n")

    if not args.no_browser:
        # Open the browser after a short delay to let Flask start
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    if args.verify_ui:
        verification = os.path.join(os.path.dirname(__file__), "tests", "verify_ui.py")
        threading.Timer(
            1.0,
            lambda: subprocess.run([sys.executable, verification, "--base-url", url], check=False),
        ).start()

    app.run(host=args.host, port=port, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
