"""Search API — execute queries against external SQLite databases."""
import json
from collections import OrderedDict
from flask import Blueprint, request, jsonify
from ..core.db_manager import open_external, get_tables
from ..core.query_builder import build_query
from ..core.results_db import get_connection

bp = Blueprint("search", __name__, url_prefix="/api/search")


@bp.post("/")
def search():
    return _execute_search(request.get_json() or {}, include_all=False)


@bp.post("/analysis")
def search_analysis():
    """Return the complete deduplicated result set for MATCH ANALYSIS only."""
    return _execute_search(request.get_json() or {}, include_all=True, record_history=False)


def _execute_search(body, include_all=False, record_history=True):
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
    db_ids = body.get("db_ids", [])
    table = body.get("table", "")
    filters = body.get("filters", [])
    logic = body.get("logic", "AND")
    expression = body.get("expression")
    sort_field = body.get("sort_field")
    sort_dir = body.get("sort_dir", "ASC")
    limit = min(int(body.get("limit", 200)), 1000)
    offset = int(body.get("offset", 0))
    date_field = body.get("date_field")
    date_from = body.get("date_from")
    date_to = body.get("date_to")

    if not db_ids or not table:
        return jsonify({"error": "db_ids and table are required"}), 400

    missing = [db_id for db_id in db_ids if table not in {item["name"] for item in get_tables(db_id)}]
    if missing:
        return jsonify({"error": "table is not present in every active database", "missing_db_ids": missing}), 400

    if expression is not None and not isinstance(expression, dict):
        return jsonify({"error": "filter expression must be an object"}), 400

    try:
        sql, params, count_sql, count_params = build_query(
            table=table,
            filters=filters,
            logic=logic,
            expression=expression,
            sort_field=sort_field,
            sort_dir=sort_dir,
            # Pagination happens after the databases are merged and deduplicated.
            limit=-1,
            offset=0,
            date_field=date_field,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as error:
        return jsonify({"error": f"Invalid filter expression: {error}"}), 400

    all_rows = []
    total = 0
    errors = []
    query_times = []

    metadata_conn = get_connection()
    placeholders = ",".join("?" for _ in db_ids)
    source_info = {
        int(row["id"]): {"id": int(row["id"]), "alias": row["alias"], "path": row["path"]}
        for row in metadata_conn.execute(
            f"SELECT id, alias, path FROM connected_databases WHERE id IN ({placeholders})", db_ids
        ).fetchall()
    }
    metadata_conn.close()

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
            for r in rows:
                d = dict(r)
                d["__db_id__"] = db_id
                d["__sources__"] = [source_info.get(db_id, {"id": db_id})]
                all_rows.append(d)
        except Exception as e:
            errors.append({"db_id": db_id, "error": str(e)})
        finally:
            conn.close()

    # Merge identical values while retaining all source databases.
    merged = OrderedDict()
    for row in all_rows:
        values = {key: value for key, value in row.items() if not key.startswith("__")}
        identity = json.dumps(values, sort_keys=True, ensure_ascii=False, default=str)
        if identity not in merged:
            merged[identity] = row
            continue
        existing = merged[identity]
        known = {source.get("id") for source in existing.get("__sources__", [])}
        for source in row.get("__sources__", []):
            if source.get("id") not in known:
                existing["__sources__"].append(source)
                known.add(source.get("id"))

    unique_rows = list(merged.values())
    total = len(unique_rows)
    if sort_field:
        reverse = sort_dir.upper() == "DESC"
        unique_rows.sort(key=lambda row: (row.get(sort_field) is None, str(row.get(sort_field) or "")), reverse=reverse)
    paged_rows = unique_rows[offset:offset + limit]

    if record_history:
        # Auto-save the user-triggered search to history. Analysis refreshes
        # are derived reads and must not create duplicate history entries.
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
            # The grid remains paginated; the complete set is opt-in for
            # MATCH ANALYSIS and is kept separate from the visible page.
            "rows": paged_rows,
            **({"analysis_rows": unique_rows} if include_all else {}),
            "total": total,
            "returned": len(paged_rows),
            "offset": offset,
            "query_ms": max(query_times) if query_times else 0,
            "errors": errors,
            "debug": {
                "sql": sql,
                "params": params,
                "count_sql": count_sql,
                "count_params": count_params,
                "db_ids": db_ids,
                "table": table,
            },
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
