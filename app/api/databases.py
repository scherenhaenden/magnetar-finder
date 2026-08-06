"""Databases API — manage connected SQLite files."""
import os
import json
from flask import Blueprint, request, jsonify
from ..core.results_db import get_connection
from ..core.db_manager import get_tables, get_columns, open_external

bp = Blueprint("databases", __name__, url_prefix="/api/databases")


@bp.get("/")
def list_databases():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM connected_databases ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.post("/")
def add_database():
    data = request.get_json()
    path = data.get("path", "").strip()
    alias = data.get("alias", "").strip() or os.path.basename(path)

    if not path:
        return jsonify({"error": "path is required"}), 400
    if not os.path.isfile(path):
        return jsonify({"error": f"File not found: {path}"}), 404

    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO connected_databases (alias, path) VALUES (?, ?)",
            (alias, path),
        )
        conn.commit()
        db_id = cur.lastrowid
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409
    conn.close()
    return jsonify({"id": db_id, "alias": alias, "path": path}), 201


@bp.patch("/<int:db_id>")
def update_database(db_id):
    data = request.get_json()
    conn = get_connection()
    if "alias" in data:
        conn.execute(
            "UPDATE connected_databases SET alias = ? WHERE id = ?",
            (data["alias"], db_id),
        )
    if "active" in data:
        conn.execute(
            "UPDATE connected_databases SET active = ? WHERE id = ?",
            (1 if data["active"] else 0, db_id),
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@bp.delete("/<int:db_id>")
def delete_database(db_id):
    conn = get_connection()
    conn.execute("DELETE FROM connected_databases WHERE id = ?", (db_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@bp.get("/<int:db_id>/tables")
def list_tables(db_id):
    tables = get_tables(db_id)
    if tables is None:
        return jsonify({"error": "database not found or offline"}), 404
    return jsonify(tables)


@bp.get("/<int:db_id>/tables/<table>/columns")
def list_columns(db_id, table):
    cols = get_columns(db_id, table)
    return jsonify(cols)


@bp.get("/<int:db_id>/tables/<table>/preview")
def preview_table(db_id, table):
    """Return first 20 rows of a table for schema exploration."""
    conn = open_external(db_id)
    if not conn:
        return jsonify({"error": "database not found"}), 404
    try:
        rows = conn.execute(f'SELECT * FROM "{table}" LIMIT 20').fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()
