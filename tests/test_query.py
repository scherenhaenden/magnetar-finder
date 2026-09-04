import pytest
from app.core.query_builder import build_query

def test_build_query_basic():
    table = "detections"
    filters = []

    sql, params, count_sql, count_params = build_query(
        table=table,
        filters=filters,
        limit=50,
        offset=10
    )

    assert 'SELECT * FROM "detections"' in sql
    assert sql.endswith("LIMIT ? OFFSET ?")
    assert params == [50, 10]

    assert 'SELECT COUNT(*) as total FROM "detections"' in count_sql
    assert count_params == []

def test_build_query_with_filters():
    table = "detections"
    filters = [
        {"field": "status", "op": "equals", "value": "active"},
        {"field": "content", "op": "contains", "value": "burst"},
    ]

    sql, params, count_sql, count_params = build_query(
        table=table,
        filters=filters,
        logic="AND",
        sort_field="timestamp",
        sort_dir="DESC"
    )

    assert 'WHERE "status" = ? AND "content" LIKE ?' in sql
    assert 'ORDER BY "timestamp" DESC' in sql
    assert "active" in params
    assert "%burst%" in params
    assert params[-2:] == [200, 0]  # default limit/offset

    # Check count query
    assert 'SELECT COUNT(*) as total FROM "detections"' in count_sql
    assert 'WHERE "status" = ? AND "content" LIKE ?' in count_sql
    assert "active" in count_params
    assert "%burst%" in count_params
    assert len(count_params) == 2

def test_build_query_date_range():
    table = "detections"
    sql, params, _, _ = build_query(
        table=table,
        filters=[],
        date_field="timestamp",
        date_from="2023-01-01",
        date_to="2023-12-31"
    )

    assert '"timestamp" BETWEEN ? AND ?' in sql
    assert "2023-01-01" in params
    assert "2023-12-31" in params

def test_build_query_between_operator():
    table = "detections"
    filters = [
        {"field": "magnitude", "op": "between", "value": "2.0", "value2": "10.0"}
    ]
    sql, params, _, _ = build_query(table=table, filters=filters)
    assert '"magnitude" BETWEEN ? AND ?' in sql
    assert "2.0" in params
    assert "10.0" in params
