"""Search API — execute queries against external SQLite databases."""
import json
from flask import Blueprint, request, jsonify
from ..core.db_manager import open_external
from ..core.query_builder import build_query
from ..core.results_db import get_connection

bp = Blueprint("search", __name__, url_prefix="/api/search")


@bp.post("/")
def search():
    """
    Body:
    {
        "db_ids":     [1, 2],       # list of connected_databases ids
        "table":      "my_table",
        "filters":    [...],        # filter descriptor list
        "logic":      "AND",        # "AND" | "OR"
        "sort_field": "created_at",
        "sort_dir":   "DESC",
        "limit":      200,
        "offset":     0,
        "date_field": "created_at",
        "date_from":  "2023-01-01",
        "date_to":    "2023-12-31"
    }
    """
    body = request.get_json()
    db_ids = body.get("db_ids", [])
    table = body.get("table", "")
    filters = body.get("filters", [])
    logic = body.get("logic", "AND")
    sort_field = body.get("sort_field")
    sort_dir = body.get("sort_dir", "ASC")
    limit = min(int(body.get("limit", 200)), 1000)
    offset = int(body.get("offset", 0))
    date_field = body.get("date_field")
    date_from = body.get("date_from")
    date_to = body.get("date_to")

    if not db_ids or not table:
        return jsonify({"error": "db_ids and table are required"}), 400

    sql, params, count_sql, count_params = build_query(
        table=table,
        filters=filters,
        logic=logic,
        sort_field=sort_field,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
        date_field=date_field,
        date_from=date_from,
        date_to=date_to,
    )

    all_rows = []
    total = 0
    errors = []
    query_times = []

    import time
    for db_id in db_ids:
        conn = open_external(db_id)
        if not conn:
            errors.append({"db_id": db_id, "error": "not found or offline"})
            continue
        try:
            t0 = time.time()
            rows = conn.execute(sql, params).fetchall()
            count_row = conn.execute(count_sql, count_params).fetchone()
            elapsed = round((time.time() - t0) * 1000, 1)
            query_times.append(elapsed)
            total += count_row[0]
            for r in rows:
                d = dict(r)
                d["__db_id__"] = db_id
                all_rows.append(d)
        except Exception as e:
            errors.append({"db_id": db_id, "error": str(e)})
        finally:
            conn.close()

    # Auto-save search to history
    iconn = get_connection()
    iconn.execute(
        """INSERT INTO search_history
           (db_ids, table_name, filters, sort_field, sort_dir, result_count)
           VALUES (?,?,?,?,?,?)""",
        (
            json.dumps(db_ids),
            table,
            json.dumps(filters),
            sort_field,
            sort_dir,
            total,
        ),
    )
    iconn.commit()
    iconn.close()

    return jsonify(
        {
            "rows": all_rows,
            "total": total,
            "returned": len(all_rows),
            "offset": offset,
            "query_ms": max(query_times) if query_times else 0,
            "errors": errors,
        }
    )


@bp.get("/history")
def get_history():
    limit = int(request.args.get("limit", 50))
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM search_history ORDER BY executed_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.get("/antecedents")
def get_antecedents():
    """
    Return rows from the same table, same day as the selected record,
    ordered by date field.
    db_id, table, date_field, date_value (ISO date string), limit
    """
    db_id = int(request.args.get("db_id"))
    table = request.args.get("table")
    date_field = request.args.get("date_field")
    date_value = request.args.get("date_value")  # e.g. "2023-10-12"
    limit = int(request.args.get("limit", 100))

    conn = open_external(db_id)
    if not conn:
        return jsonify({"error": "database not found"}), 404
    try:
        sql = f"""
            SELECT * FROM "{table}"
            WHERE date("{date_field}") = date(?)
            ORDER BY "{date_field}" ASC
            LIMIT ?
        """
        rows = conn.execute(sql, (date_value, limit)).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()
