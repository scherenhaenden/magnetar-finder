"""
Desktop launcher for Magnetar Finder (Angular 22).
Runs local server and opens app window.
"""
import logging
import os
import sys
import shutil
import socket
import threading
import tempfile
import subprocess
import webbrowser
import time
from flask import Flask, send_from_directory
from flask_cors import CORS

def get_bundle_dir():
    """Get absolute path to resource, works for dev and for PyInstaller."""
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def find_free_port(start: int = 7474) -> int:
    port = start
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                port += 1
    raise RuntimeError("No free port found")

def find_chrome() -> str | None:
    return (
        shutil.which("google-chrome") or
        shutil.which("chromium") or
        shutil.which("chromium-browser") or
        shutil.which("chrome")
    )

def create_angular_app(static_dir: str) -> Flask:
    app = Flask(__name__, static_folder=static_dir, static_url_path="")
    CORS(app)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        if path != "" and os.path.exists(os.path.join(static_dir, path)):
            return send_from_directory(static_dir, path)
        return send_from_directory(static_dir, "index.html")

    return app

def main():
    bundle_dir = get_bundle_dir()
    static_dir = os.path.join(bundle_dir, "angular_assets")

    if not os.path.exists(static_dir):
        # Fallback for running directly from source
        static_dir = os.path.join(os.path.dirname(bundle_dir), "build", "angular")

    port = find_free_port(7475)
    app = create_angular_app(static_dir)

    # Disable flask server logging in terminal
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    sys.stdout = open(os.devnull, 'w') if not sys.stdout or not sys.stdout.isatty() else sys.stdout

    server_thread = threading.Thread(
        target=lambda: app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False),
        daemon=True
    )
    server_thread.start()

    url = f"http://127.0.0.1:{port}"
    chrome = find_chrome()

    if chrome:
        with tempfile.TemporaryDirectory(prefix="magnetar-finder-chrome-") as profile:
            cmd = [
                chrome,
                f"--app={url}",
                f"--user-data-dir={profile}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-sync",
            ]
            try:
                subprocess.run(cmd, check=False)
            except Exception:
                webbrowser.open(url)
    else:
        webbrowser.open(url)
        # Keep server running if using external browser
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
