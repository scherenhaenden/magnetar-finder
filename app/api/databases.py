"""Databases API — manage connected SQLite files."""
import os
import json
import sqlite3
import hashlib
from pathlib import Path
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from ..core.results_db import get_connection
from ..core.db_manager import get_tables, get_columns, open_external

bp = Blueprint("databases", __name__, url_prefix="/api/databases")
IMPORTED_DB_DIR = Path(__file__).resolve().parents[2] / "data" / "imported_databases"


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _registered_duplicate(path: Path, compare_content: bool = False) -> str | None:
    """Return the registered path if this file is already connected."""
    canonical = path.resolve()
    conn = get_connection()
    rows = conn.execute("SELECT path FROM connected_databases").fetchall()
    conn.close()
    for row in rows:
        registered = Path(row["path"])
        if registered.exists() and registered.resolve() == canonical:
            return row["path"]
        if compare_content and registered.exists() and _file_hash(registered) == _file_hash(path):
            return row["path"]
    return None


@bp.get("/")
def list_databases():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM connected_databases ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.get("/common-tables")
def common_tables():
    """List tables shared by every requested active database."""
    raw_ids = request.args.get("db_ids", "")
    try:
        db_ids = [int(value) for value in raw_ids.split(",") if value.strip()]
    except ValueError:
        return jsonify({"error": "db_ids must be comma-separated integers"}), 400
    if not db_ids:
        return jsonify({"error": "at least one db_id is required"}), 400

    tables_by_db = [
        {table["name"] for table in get_tables(db_id)}
        for db_id in db_ids
    ]
    shared = set.intersection(*tables_by_db) if tables_by_db else set()
    return jsonify(sorted(shared))


@bp.post("/")
def add_database():
    data = request.get_json()
    path = os.path.realpath(os.path.abspath(os.path.expanduser(data.get("path", "").strip())))
    alias = data.get("alias", "").strip() or os.path.basename(path)

    if not path:
        return jsonify({"error": "path is required"}), 400
    if not os.path.isfile(path):
        return jsonify({"error": f"File not found: {path}"}), 404

    duplicate = _registered_duplicate(Path(path))
    if duplicate:
        return jsonify({"error": f"Database already added: {duplicate}", "path": duplicate}), 409

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


@bp.post("/upload")
def upload_databases():
    """Copy one or more uploaded SQLite files into local app storage and register them."""
    files = [f for f in request.files.getlist("files") if f and f.filename]
    if not files:
        return jsonify({"error": "at least one SQLite file is required"}), 400

    alias_prefix = request.form.get("alias", "").strip()
    IMPORTED_DB_DIR.mkdir(parents=True, exist_ok=True)
    imported = []
    errors = []

    for uploaded in files:
        filename = secure_filename(uploaded.filename)
        if not filename:
            errors.append({"filename": uploaded.filename, "error": "invalid filename"})
            continue

        target = IMPORTED_DB_DIR / filename
        stem, suffix = target.stem, target.suffix
        counter = 2
        while target.exists():
            target = IMPORTED_DB_DIR / f"{stem}-{counter}{suffix}"
            counter += 1

        uploaded.save(target)
        try:
            duplicate = _registered_duplicate(target, compare_content=True)
            if duplicate:
                raise ValueError(f"database already added: {duplicate}")
            with target.open("rb") as stream:
                if stream.read(16) != b"SQLite format 3\x00":
                    raise ValueError("file is not a SQLite database")
            with sqlite3.connect(f"file:{target}?mode=ro", uri=True) as conn:
                conn.execute("SELECT name FROM sqlite_master LIMIT 1").fetchone()
        except Exception as exc:
            target.unlink(missing_ok=True)
            errors.append({"filename": uploaded.filename, "error": str(exc)})
            continue

        alias = alias_prefix if len(files) == 1 and alias_prefix else target.name
        conn = get_connection()
        try:
            cur = conn.execute(
                "INSERT INTO connected_databases (alias, path) VALUES (?, ?)",
                (alias, str(target)),
            )
            conn.commit()
            imported.append({"id": cur.lastrowid, "alias": alias, "path": str(target)})
        except Exception as exc:
            errors.append({"filename": uploaded.filename, "error": str(exc)})
            target.unlink(missing_ok=True)
        finally:
            conn.close()

    status = 201 if imported else 400
    return jsonify({"imported": imported, "errors": errors}), status


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
    row = conn.execute(
        "SELECT path FROM connected_databases WHERE id = ?", (db_id,)
    ).fetchone()
    if row is None:
        conn.close()
        return jsonify({"error": "database not found"}), 404

    conn.execute("DELETE FROM connected_databases WHERE id = ?", (db_id,))
    conn.commit()
    conn.close()

    # Uploaded files are app-owned; manually connected external files are not.
    db_path = Path(row["path"]).resolve()
    imported_dir = IMPORTED_DB_DIR.resolve()
    deleted_file = False
    if db_path.parent == imported_dir and db_path.is_file():
        db_path.unlink()
        deleted_file = True

    return jsonify({"ok": True, "deleted_file": deleted_file})


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
