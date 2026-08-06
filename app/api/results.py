"""Results API — save, group, annotate and crosslink findings."""
import json
from flask import Blueprint, request, jsonify
from ..core.results_db import get_connection

bp = Blueprint("results", __name__, url_prefix="/api/results")


# ── Saved Results ──────────────────────────────────────────────────────────────

@bp.get("/")
def list_results():
    conn = get_connection()
    rows = conn.execute(
        """SELECT sr.*, cd.alias as db_alias
           FROM saved_results sr
           LEFT JOIN connected_databases cd ON sr.db_id = cd.id
           ORDER BY sr.saved_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.post("/")
def save_result():
    data = request.get_json()
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO saved_results (db_id, table_name, row_pk, row_data, label)
           VALUES (?,?,?,?,?)""",
        (
            data.get("db_id"),
            data.get("table_name"),
            data.get("row_pk", ""),
            json.dumps(data.get("row_data", {})),
            data.get("label", ""),
        ),
    )
    conn.commit()
    saved_id = cur.lastrowid
    conn.close()
    return jsonify({"id": saved_id}), 201


@bp.delete("/<int:result_id>")
def delete_result(result_id):
    conn = get_connection()
    conn.execute("DELETE FROM saved_results WHERE id = ?", (result_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@bp.patch("/<int:result_id>")
def update_result(result_id):
    data = request.get_json()
    conn = get_connection()
    if "label" in data:
        conn.execute(
            "UPDATE saved_results SET label = ? WHERE id = ?",
            (data["label"], result_id),
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Groups ─────────────────────────────────────────────────────────────────────

@bp.get("/groups")
def list_groups():
    conn = get_connection()
    groups = conn.execute(
        "SELECT * FROM result_groups ORDER BY created_at DESC"
    ).fetchall()
    result = []
    for g in groups:
        members = conn.execute(
            """SELECT sr.id, sr.label, sr.table_name, sr.saved_at
               FROM result_group_members gm
               JOIN saved_results sr ON gm.saved_result_id = sr.id
               WHERE gm.group_id = ?""",
            (g["id"],),
        ).fetchall()
        d = dict(g)
        d["members"] = [dict(m) for m in members]
        result.append(d)
    conn.close()
    return jsonify(result)


@bp.post("/groups")
def create_group():
    data = request.get_json()
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO result_groups (name, description) VALUES (?,?)",
        (data.get("name", "Unnamed Group"), data.get("description", "")),
    )
    conn.commit()
    group_id = cur.lastrowid
    conn.close()
    return jsonify({"id": group_id}), 201


@bp.post("/groups/<int:group_id>/members")
def add_member(group_id):
    data = request.get_json()
    result_id = data.get("result_id")
    conn = get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO result_group_members (group_id, saved_result_id) VALUES (?,?)",
        (group_id, result_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@bp.delete("/groups/<int:group_id>/members/<int:result_id>")
def remove_member(group_id, result_id):
    conn = get_connection()
    conn.execute(
        "DELETE FROM result_group_members WHERE group_id=? AND saved_result_id=?",
        (group_id, result_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Notes ──────────────────────────────────────────────────────────────────────

@bp.get("/notes")
def list_notes():
    target_type = request.args.get("target_type")
    target_id = request.args.get("target_id")
    conn = get_connection()
    if target_type and target_id:
        rows = conn.execute(
            "SELECT * FROM notes WHERE target_type=? AND target_id=? ORDER BY created_at DESC",
            (target_type, target_id),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM notes ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.post("/notes")
def create_note():
    data = request.get_json()
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO notes (title, content, target_type, target_id)
           VALUES (?,?,?,?)""",
        (
            data.get("title", ""),
            data.get("content", ""),
            data.get("target_type"),
            data.get("target_id"),
        ),
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()
    return jsonify({"id": note_id}), 201


@bp.patch("/notes/<int:note_id>")
def update_note(note_id):
    data = request.get_json()
    conn = get_connection()
    conn.execute(
        """UPDATE notes SET title=?, content=?, updated_at=datetime('now')
           WHERE id=?""",
        (data.get("title", ""), data.get("content", ""), note_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@bp.delete("/notes/<int:note_id>")
def delete_note(note_id):
    conn = get_connection()
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Crosslinks ─────────────────────────────────────────────────────────────────

@bp.get("/crosslinks")
def list_crosslinks():
    from_type = request.args.get("from_type")
    from_id = request.args.get("from_id")
    conn = get_connection()
    if from_type and from_id:
        rows = conn.execute(
            "SELECT * FROM crosslinks WHERE from_type=? AND from_id=?",
            (from_type, from_id),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM crosslinks ORDER BY created_at DESC LIMIT 100").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.post("/crosslinks")
def create_crosslink():
    data = request.get_json()
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO crosslinks (from_type, from_id, to_type, to_id, label)
           VALUES (?,?,?,?,?)""",
        (
            data.get("from_type"),
            data.get("from_id"),
            data.get("to_type"),
            data.get("to_id"),
            data.get("label", ""),
        ),
    )
    conn.commit()
    link_id = cur.lastrowid
    conn.close()
    return jsonify({"id": link_id}), 201


@bp.delete("/crosslinks/<int:link_id>")
def delete_crosslink(link_id):
    conn = get_connection()
    conn.execute("DELETE FROM crosslinks WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
