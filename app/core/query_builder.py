"""
Query Builder — dynamically constructs parameterised SQL queries
from a list of filter descriptors supplied by the frontend.

Filter descriptor shape:
{
    "field":    str,          # column name
    "op":       str,          # "contains" | "not_contains" | "equals" | "not_equals"
                              # | "starts_with" | "ends_with"
                              # | "gt" | "gte" | "lt" | "lte"
                              # | "between" | "is_null" | "is_not_null"
    "value":    str | None,   # primary value
    "value2":   str | None,   # used by "between"
}

Logic combinator: "AND" | "OR"
"""
from typing import Any


OPERATORS = {
    "contains":     lambda f, _: (f'"{f}" LIKE ?',   lambda v: f"%{v}%"),
    "not_contains": lambda f, _: (f'"{f}" NOT LIKE ?', lambda v: f"%{v}%"),
    "equals":       lambda f, _: (f'"{f}" = ?',        lambda v: v),
    "not_equals":   lambda f, _: (f'"{f}" != ?',       lambda v: v),
    "starts_with":  lambda f, _: (f'"{f}" LIKE ?',   lambda v: f"{v}%"),
    "ends_with":    lambda f, _: (f'"{f}" LIKE ?',   lambda v: f"%{v}"),
    "gt":           lambda f, _: (f'"{f}" > ?',        lambda v: v),
    "gte":          lambda f, _: (f'"{f}" >= ?',       lambda v: v),
    "lt":           lambda f, _: (f'"{f}" < ?',        lambda v: v),
    "lte":          lambda f, _: (f'"{f}" <= ?',       lambda v: v),
    "is_null":      lambda f, _: (f'"{f}" IS NULL',    None),
    "is_not_null":  lambda f, _: (f'"{f}" IS NOT NULL', None),
}


def build_query(
    table: str,
    filters: list[dict],
    logic: str = "AND",
    sort_field: str | None = None,
    sort_dir: str = "ASC",
    limit: int = 200,
    offset: int = 0,
    date_field: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[str, list[Any]]:
    """
    Returns (sql, params) for the query described by the given filters.
    """
    clauses: list[str] = []
    params: list[Any] = []

    # Date range filter
    if date_field and (date_from or date_to):
        if date_from and date_to:
            clauses.append(f'"{date_field}" BETWEEN ? AND ?')
            params += [date_from, date_to]
        elif date_from:
            clauses.append(f'"{date_field}" >= ?')
            params.append(date_from)
        elif date_to:
            clauses.append(f'"{date_field}" <= ?')
            params.append(date_to)

    # Field filters
    for f in filters:
        field = f.get("field", "")
        op = f.get("op", "contains")
        value = f.get("value", "")
        value2 = f.get("value2", "")

        if not field or op not in OPERATORS and op != "between":
            continue

        if op == "between":
            clauses.append(f'"{field}" BETWEEN ? AND ?')
            params += [value, value2]
            continue

        builder = OPERATORS.get(op)
        if not builder:
            continue
        clause_tpl, param_fn = builder(field, None)
        clauses.append(clause_tpl)
        if param_fn is not None:
            params.append(param_fn(value))

    # Assemble WHERE
    glue = f" {logic.upper()} " if logic.upper() in ("AND", "OR") else " AND "
    where = f"WHERE {glue.join(clauses)}" if clauses else ""

    # Sort
    order = ""
    if sort_field:
        direction = "DESC" if sort_dir.upper() == "DESC" else "ASC"
        order = f'ORDER BY "{sort_field}" {direction}'

    sql = f'SELECT * FROM "{table}" {where} {order} LIMIT ? OFFSET ?'
    params += [limit, offset]

    # Count query (no limit)
    count_sql = f'SELECT COUNT(*) as total FROM "{table}" {where}'
    count_params = params[:-2]  # Remove limit/offset

    return sql, params, count_sql, count_params
