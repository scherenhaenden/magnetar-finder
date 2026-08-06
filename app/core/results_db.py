"""
Results DB — manages the internal SQLite database that stores
connected databases, saved results, notes, and crosslinks.
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "magnetar_finder.db"
)


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create internal tables if they don't exist."""
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS connected_databases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alias TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            engine TEXT DEFAULT 'sqlite',
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            db_ids TEXT,
            table_name TEXT,
            filters TEXT,
            sort_field TEXT,
            sort_dir TEXT,
            result_count INTEGER,
            executed_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS saved_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            db_id INTEGER REFERENCES connected_databases(id),
            table_name TEXT NOT NULL,
            row_pk TEXT NOT NULL,
            row_data TEXT NOT NULL,
            label TEXT,
            saved_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS result_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS result_group_members (
            group_id INTEGER REFERENCES result_groups(id) ON DELETE CASCADE,
            saved_result_id INTEGER REFERENCES saved_results(id) ON DELETE CASCADE,
            PRIMARY KEY (group_id, saved_result_id)
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT NOT NULL,
            target_type TEXT,   -- 'result' | 'group' | 'value'
            target_id TEXT,     -- id of the target
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS crosslinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_type TEXT NOT NULL,
            from_id TEXT NOT NULL,
            to_type TEXT NOT NULL,
            to_id TEXT NOT NULL,
            label TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()
