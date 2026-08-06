"""
DB Manager — opens read-only connections to external SQLite databases
registered in the internal results DB.
"""
import sqlite3
import os
from typing import Optional
from .results_db import get_connection as get_internal


def get_external_db_path(db_id: int) -> Optional[str]:
    """Return the filesystem path for a registered external DB."""
    conn = get_internal()
    row = conn.execute(
        "SELECT path FROM connected_databases WHERE id = ? AND active = 1", (db_id,)
    ).fetchone()
    conn.close()
    return row["path"] if row else None


def open_external(db_id: int) -> Optional[sqlite3.Connection]:
    """Open a read-only connection to an external registered SQLite file."""
    path = get_external_db_path(db_id)
    if not path or not os.path.isfile(path):
        return None
    uri = f"file:{path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except sqlite3.OperationalError:
        pass  # ignore attempt to write a readonly database WAL warning
    return conn


def get_tables(db_id: int) -> list[dict]:
    """List all tables in an external DB with their row counts."""
    conn = open_external(db_id)
    if not conn:
        return []
    try:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        result = []
        for t in tables:
            name = t["name"]
            try:
                count = conn.execute(f'SELECT COUNT(*) as c FROM "{name}"').fetchone()["c"]
            except Exception:
                count = -1
            result.append({"name": name, "row_count": count})
        return result
    finally:
        conn.close()


def get_columns(db_id: int, table: str) -> list[dict]:
    """Return column info for a table in an external DB."""
    conn = open_external(db_id)
    if not conn:
        return []
    try:
        cols = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
        return [{"name": c["name"], "type": c["type"], "pk": c["pk"]} for c in cols]
    finally:
        conn.close()
