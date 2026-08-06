"""Settings API — app-level configuration (port info, etc.)."""
from flask import Blueprint, jsonify, request
import socket

bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@bp.get("/info")
def info():
    """Return basic server info."""
    return jsonify({
        "app": "Magnetar Finder",
        "version": "0.1.0",
        "status": "online",
    })
