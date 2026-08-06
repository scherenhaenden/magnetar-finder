"""Unique values API — group and count distinct values in a column."""
from flask import Blueprint, request, jsonify
from ..core.db_manager import open_external

bp = Blueprint("unique", __name__, url_prefix="/api/unique")


@bp.get("/")
def get_uniques():
    """
    Query params:
    - db_id: int
    - table: str
    - field: str
    - limit: int (default 500)
    - search: str (filter values containing this string)
    """
    db_id = int(request.args.get("db_id", 0))
    table = request.args.get("table", "")
    field = request.args.get("field", "")
    limit = int(request.args.get("limit", 500))
    search = request.args.get("search", "")

    if not db_id or not table or not field:
        return jsonify({"error": "db_id, table, field are required"}), 400

    conn = open_external(db_id)
    if not conn:
        return jsonify({"error": "database not found or offline"}), 404

    try:
        where = ""
        params: list = []
        if search:
            where = f'WHERE "{field}" LIKE ?'
            params.append(f"%{search}%")

        sql = f"""
            SELECT "{field}" as value, COUNT(*) as count
            FROM "{table}"
            {where}
            GROUP BY "{field}"
            ORDER BY count DESC
            LIMIT ?
        """
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()

        total_unique = conn.execute(
            f'SELECT COUNT(DISTINCT "{field}") as c FROM "{table}"'
        ).fetchone()["c"]

        return jsonify({
            "field": field,
            "table": table,
            "total_unique": total_unique,
            "rows": [{"value": r["value"], "count": r["count"]} for r in rows],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()


@bp.get("/timeline")
def get_value_timeline():
    """
    Get all records for a specific field value, ordered by date.
    Params: db_id, table, field, value, date_field, limit
    """
    db_id = int(request.args.get("db_id", 0))
    table = request.args.get("table", "")
    field = request.args.get("field", "")
    value = request.args.get("value", "")
    date_field = request.args.get("date_field", "")
    limit = int(request.args.get("limit", 200))

    conn = open_external(db_id)
    if not conn:
        return jsonify({"error": "not found"}), 404
    try:
        if date_field:
            sql = f'SELECT * FROM "{table}" WHERE "{field}" = ? ORDER BY "{date_field}" ASC LIMIT ?'
        else:
            sql = f'SELECT * FROM "{table}" WHERE "{field}" = ? LIMIT ?'
        rows = conn.execute(sql, (value, limit)).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()
