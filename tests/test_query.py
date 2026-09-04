"""Unit tests for the parameterised SQLite query builder."""

import pytest

from app.core.query_builder import build_query


def build(**kwargs):
    """Keep individual tests focused on the inputs they exercise."""
    return build_query(table="detections", filters=[], **kwargs)


def test_build_query_without_filters_has_pagination_and_count_contract():
    sql, params, count_sql, count_params = build(limit=50, offset=10)

    assert sql.startswith('SELECT * FROM "detections"')
    assert sql.endswith("LIMIT ? OFFSET ?")
    assert params == [50, 10]
    assert count_sql.startswith('SELECT COUNT(*) as total FROM "detections"')
    assert count_params == []


def test_flat_filters_preserve_order_and_parameterise_values():
    sql, params, count_sql, count_params = build_query(
        table="detections",
        filters=[
            {"field": "status", "op": "equals", "value": "active", "case_sensitive": True},
            {"field": "content", "op": "contains", "value": "burst"},
        ],
        logic="AND",
        sort_field="timestamp",
        sort_dir="DESC",
    )

    expected_where = 'WHERE "status" = ? AND instr(lower(CAST("content" AS TEXT)), lower(?)) > 0'
    assert expected_where in sql
    assert 'ORDER BY "timestamp" DESC' in sql
    assert params == ["active", "burst", 200, 0]
    assert expected_where in count_sql
    assert count_params == ["active", "burst"]


@pytest.mark.parametrize(
    ("date_from", "date_to", "expected", "expected_params"),
    [
        ("2023-01-01", "2023-12-31", '"timestamp" BETWEEN ? AND ?', ["2023-01-01", "2023-12-31"]),
        ("2023-01-01", None, '"timestamp" >= ?', ["2023-01-01"]),
        (None, "2023-12-31", '"timestamp" <= ?', ["2023-12-31"]),
    ],
)
def test_date_boundaries_are_parameterised(date_from, date_to, expected, expected_params):
    sql, params, count_sql, count_params = build(
        date_field="timestamp", date_from=date_from, date_to=date_to
    )

    assert expected in sql
    assert params == expected_params + [200, 0]
    assert expected in count_sql
    assert count_params == expected_params


def test_between_and_null_operators_do_not_add_spurious_values():
    sql, params, count_sql, count_params = build_query(
        table="detections",
        filters=[
            {"field": "magnitude", "op": "between", "value": "2.0", "value2": "10.0"},
            {"field": "retired_at", "op": "is_null"},
            {"field": "published_at", "op": "is_not_null"},
        ],
    )

    expected_where = (
        'WHERE "magnitude" BETWEEN ? AND ? AND "retired_at" IS NULL '
        'AND "published_at" IS NOT NULL'
    )
    assert expected_where in sql
    assert params == ["2.0", "10.0", 200, 0]
    assert expected_where in count_sql
    assert count_params == ["2.0", "10.0"]


@pytest.mark.parametrize(
    ("op", "expected"),
    [("gt", ">"), ("gte", ">="), ("lt", "<"), ("lte", "<=")],
)
def test_numeric_comparison_operators_keep_values_parameterised(op, expected):
    sql, params, count_sql, count_params = build_query(
        table="detections",
        filters=[{"field": "magnitude", "op": op, "value": "5.0"}],
    )

    assert f'"magnitude" {expected} ?' in sql
    assert params == ["5.0", 200, 0]
    assert f'"magnitude" {expected} ?' in count_sql
    assert count_params == ["5.0"]


@pytest.mark.parametrize(
    ("op", "case_sensitive", "expected_sql", "expected_params"),
    [
        ("contains", False, 'instr(lower(CAST("content" AS TEXT)), lower(?)) > 0', ["Burst"]),
        ("contains", True, 'instr(CAST("content" AS TEXT), ?) > 0', ["Burst"]),
        ("not_contains", False, 'NOT (instr(lower(CAST("content" AS TEXT)), lower(?)) > 0)', ["Burst"]),
        ("not_contains", True, 'NOT (instr(CAST("content" AS TEXT), ?) > 0)', ["Burst"]),
        ("equals", False, 'lower(CAST("status" AS TEXT)) = lower(?)', ["ACTIVE"]),
        ("not_equals", False, 'lower(CAST("status" AS TEXT)) != lower(?)', ["ACTIVE"]),
        ("equals", True, '"status" = ?', ["ACTIVE"]),
        ("not_equals", True, '"status" != ?', ["ACTIVE"]),
    ],
)
def test_case_mode_is_compiled_per_filter(op, case_sensitive, expected_sql, expected_params):
    field = "content" if "contain" in op else "status"
    value = "Burst" if "contain" in op else "ACTIVE"
    sql, params, _, _ = build_query(
        table="detections",
        filters=[{"field": field, "op": op, "value": value, "case_sensitive": case_sensitive}],
    )

    assert expected_sql in sql
    assert params == expected_params + [200, 0]


@pytest.mark.parametrize(
    ("op", "case_sensitive", "expected_sql"),
    [
        ("starts_with", False, 'lower(substr(CAST("content" AS TEXT), 1, length(?))) = lower(?)'),
        ("starts_with", True, 'substr(CAST("content" AS TEXT), 1, length(?)) = ?'),
        ("ends_with", False, 'lower(substr(CAST("content" AS TEXT), -length(?))) = lower(?)'),
        ("ends_with", True, 'substr(CAST("content" AS TEXT), -length(?)) = ?'),
    ],
)
def test_prefix_and_suffix_case_mode_reuses_value_for_length_and_comparison(op, case_sensitive, expected_sql):
    sql, params, _, _ = build_query(
        table="detections",
        filters=[{"field": "content", "op": op, "value": "Burst", "case_sensitive": case_sensitive}],
    )

    assert expected_sql in sql
    assert params == ["Burst", "Burst", 200, 0]


@pytest.mark.parametrize(
    ("value", "op", "case_sensitive", "expected_sql", "expected_params"),
    [
        ("('der', 'die', 'das')", "contains_in", False,
         'instr(lower(CAST("content" AS TEXT)), lower(?)) > 0 OR instr(lower(CAST("content" AS TEXT)), lower(?)) > 0 OR instr(lower(CAST("content" AS TEXT)), lower(?)) > 0',
         ["der", "die", "das"]),
        ('"DER", die', "contains_in", True,
         'instr(CAST("content" AS TEXT), ?) > 0 OR instr(CAST("content" AS TEXT), ?) > 0',
         ["DER", "die"]),
        ("one,two", "not_contains_in", False,
         'NOT (instr(lower(CAST("content" AS TEXT)), lower(?)) > 0 OR instr(lower(CAST("content" AS TEXT)), lower(?)) > 0)',
         ["one", "two"]),
    ],
)
def test_contains_in_and_not_contains_in_parse_values_and_keep_each_parameter(value, op, case_sensitive, expected_sql, expected_params):
    sql, params, count_sql, count_params = build_query(
        table="detections",
        filters=[{"field": "content", "op": op, "value": value, "case_sensitive": case_sensitive}],
    )

    assert expected_sql in sql
    assert params == expected_params + [200, 0]
    assert expected_sql in count_sql
    assert count_params == expected_params


@pytest.mark.parametrize(
    ("op", "expected_clause"),
    [("contains_in", "1 = 0"), ("not_contains_in", "1 = 1")],
)
def test_empty_contains_in_has_explicit_identity_condition(op, expected_clause):
    sql, params, count_sql, count_params = build_query(
        table="detections", filters=[{"field": "content", "op": op, "value": " ( ) "}]
    )

    assert expected_clause in sql
    assert params == [200, 0]
    assert expected_clause in count_sql
    assert count_params == []


def test_nested_expression_keeps_parentheses_joins_and_parameter_order():
    expression = {
        "type": "group",
        "logic": "AND",
        "children": [
            {
                "type": "group",
                "logic": "OR",
                "children": [
                    {"type": "filter", "field": "url", "op": "contains", "value": "martin"},
                    {"type": "filter", "field": "description", "op": "contains", "value": "martin", "join": "OR"},
                ],
            },
            {"type": "filter", "field": "status", "op": "equals", "value": "active", "case_sensitive": True, "join": "AND"},
        ],
    }

    sql, params, count_sql, count_params = build_query(
        table="detections", filters=[{"field": "ignored", "op": "equals", "value": "ignored"}], expression=expression
    )

    expected = (
        'WHERE ((instr(lower(CAST("url" AS TEXT)), lower(?)) > 0 OR '
        'instr(lower(CAST("description" AS TEXT)), lower(?)) > 0) AND "status" = ?)'
    )
    assert expected in sql
    assert "ignored" not in params
    assert params == ["martin", "martin", "active", 200, 0]
    assert expected in count_sql
    assert count_params == ["martin", "martin", "active"]


@pytest.mark.parametrize(
    "invalid_filter",
    [
        {"type": "filter", "field": "", "op": "contains", "value": "ignored"},
        {"type": "filter", "field": "status", "op": "unknown", "value": "ignored"},
    ],
)
def test_invalid_expression_filters_are_rejected_instead_of_broadening_a_search(invalid_filter):
    expression = {"type": "group", "logic": "AND", "children": [invalid_filter]}

    with pytest.raises(ValueError):
        build_query(table="detections", filters=[], expression=expression)


def test_invalid_joins_are_safely_normalised_to_and():
    expression = {
        "type": "group",
        "logic": "DROP TABLE",
        "children": [
            {"type": "filter", "field": "status", "op": "equals", "value": "active"},
            {"type": "filter", "field": "kind", "op": "equals", "value": "burst", "join": "unexpected"},
        ],
    }

    sql, params, _, _ = build_query(table="detections", filters=[], expression=expression, logic="unexpected")

    assert 'WHERE (lower(CAST("status" AS TEXT)) = lower(?) AND lower(CAST("kind" AS TEXT)) = lower(?))' in sql
    assert params == ["active", "burst", 200, 0]


def test_invalid_sort_direction_defaults_to_ascending_and_count_has_no_order_or_pagination():
    sql, params, count_sql, count_params = build(sort_field="timestamp", sort_dir="sideways", limit=1, offset=9)

    assert 'ORDER BY "timestamp" ASC' in sql
    assert sql.endswith("LIMIT ? OFFSET ?")
    assert params == [1, 9]
    assert "ORDER BY" not in count_sql
    assert "LIMIT" not in count_sql
    assert count_params == []
