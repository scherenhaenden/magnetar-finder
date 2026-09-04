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


def _parse_list_value(value: Any) -> list[str]:
    """Parse ('a','b'), (\"a\",\"b\") or comma-separated input."""
    text = str(value or "").strip()
    if text.startswith("(") and text.endswith(")"):
        text = text[1:-1].strip()
    if not text:
        return []
    values = []
    for item in text.split(","):
        item = item.strip()
        if len(item) >= 2 and item[0] == item[-1] and item[0] in "'\"":
            item = item[1:-1]
        if item:
            values.append(item)
    return values


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
    expression: dict | None = None,
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

    def filter_clause(f: dict) -> tuple[str, list[Any]]:
        field = f.get("field", "")
        op = f.get("op", "contains")
        value = f.get("value", "")
        value2 = f.get("value2", "")
        case_sensitive = f.get("case_sensitive", False) is True

        if not isinstance(field, str) or not field:
            raise ValueError("Each filter needs a field")
        if op not in OPERATORS and op not in ("between", "contains_in", "not_contains_in"):
            raise ValueError(f"Unsupported filter operator: {op}")

        if op == "between":
            return f'"{field}" BETWEEN ? AND ?', [value, value2]

        if op in ("contains_in", "not_contains_in"):
            values = _parse_list_value(value)
            if not values:
                return ("1 = 1" if op == "not_contains_in" else "1 = 0"), []
            if case_sensitive:
                matches = " OR ".join(f'instr(CAST("{field}" AS TEXT), ?) > 0' for _ in values)
            else:
                matches = " OR ".join(f'instr(lower(CAST("{field}" AS TEXT)), lower(?)) > 0' for _ in values)
            clause = f"({matches})"
            if op == "not_contains_in":
                clause = f"NOT {clause}"
            return clause, values

        if op in ("contains", "not_contains"):
            expression = 'instr(CAST("{field}" AS TEXT), ?) > 0' if case_sensitive else 'instr(lower(CAST("{field}" AS TEXT)), lower(?)) > 0'
            clause = expression.format(field=field)
            if op == "not_contains":
                clause = f"NOT ({clause})"
            return clause, [value]

        if op in ("equals", "not_equals") and not case_sensitive:
            clause = f'lower(CAST("{field}" AS TEXT)) {"=" if op == "equals" else "!="} lower(?)'
            return clause, [value]

        if op in ("starts_with", "ends_with"):
            if op == "starts_with":
                expression = f'substr(CAST("{field}" AS TEXT), 1, length(?))'
            else:
                expression = f'substr(CAST("{field}" AS TEXT), -length(?))'
            if case_sensitive:
                return f'{expression} = ?', [value, value]
            return f'lower({expression}) = lower(?)', [value, value]

        builder = OPERATORS.get(op)
        if not builder:
            raise ValueError(f"Unsupported filter operator: {op}")
        clause_tpl, param_fn = builder(field, None)
        return clause_tpl, [param_fn(value)] if param_fn is not None else []

    def expression_sql(node: dict) -> tuple[str | None, list[Any]]:
        if node.get("type") == "filter":
            return filter_clause(node)
        if node.get("type") != "group":
            raise ValueError("Each expression node must be a filter or group")
        node_children = node.get("children", [])
        if not isinstance(node_children, list):
            raise ValueError("A filter group must contain a list of conditions")
        children = []
        child_params: list[Any] = []
        for index, child in enumerate(node_children):
            if not isinstance(child, dict):
                raise ValueError("A filter group contains an invalid condition")
            child_sql, params_for_child = expression_sql(child)
            if child_sql:
                if children:
                    join = child.get("join", node.get("logic", "AND")).upper()
                    if join not in ("AND", "OR"):
                        join = "AND"
                    children.append(f"{join} {child_sql}")
                else:
                    children.append(child_sql)
                child_params.extend(params_for_child)
        if not children:
            return None, []
        return f"({' '.join(children)})", child_params

    # A supplied grouped expression is authoritative. Never fall back to flat
    # filters (or an unfiltered query) when it cannot be compiled.
    if expression:
        if not isinstance(expression, dict):
            raise ValueError("The filter expression must be an object")
        expression_clause, expression_params = expression_sql(expression)
        if expression_clause:
            clauses.append(expression_clause)
            params.extend(expression_params)
    else:
        for f in filters:
            clause, filter_params = filter_clause(f)
            if clause:
                clauses.append(clause)
                params.extend(filter_params)

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
