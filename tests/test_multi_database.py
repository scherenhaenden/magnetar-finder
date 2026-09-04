"""API contract tests for searching the same table across multiple databases."""

import sqlite3


def _create_database(tmp_path, filename, tables, rows):
    path = tmp_path / filename
    with sqlite3.connect(path) as connection:
        for table_name, columns in tables.items():
            connection.execute(
                f'CREATE TABLE "{table_name}" ({columns})'
            )
        for table_name, table_rows in rows.items():
            for row in table_rows:
                placeholders = ", ".join("?" for _ in row)
                connection.execute(
                    f'INSERT INTO "{table_name}" VALUES ({placeholders})',
                    row,
                )
    return str(path)


def _register(client, path, alias):
    response = client.post(
        "/api/databases/",
        json={"path": path, "alias": alias},
    )
    assert response.status_code == 201
    return response.get_json()


def test_common_tables_returns_only_the_table_intersection(
    client, tmp_path
):
    tables = {
        "objects": "id INTEGER PRIMARY KEY, value TEXT",
        "shared_only": "id INTEGER PRIMARY KEY, value TEXT",
    }
    first = _register(
        client,
        _create_database(
            tmp_path,
            "first.sqlite",
            tables,
            {"objects": [], "shared_only": []},
        ),
        "First",
    )
    second = _register(
        client,
        _create_database(
            tmp_path,
            "second.sqlite",
            {
                "objects": "id INTEGER PRIMARY KEY, value TEXT",
                "second_only": "id INTEGER PRIMARY KEY, value TEXT",
            },
            {"objects": [], "second_only": []},
        ),
        "Second",
    )
    third = _register(
        client,
        _create_database(
            tmp_path,
            "third.sqlite",
            {
                "objects": "id INTEGER PRIMARY KEY, value TEXT",
                "third_only": "id INTEGER PRIMARY KEY, value TEXT",
            },
            {"objects": [], "third_only": []},
        ),
        "Third",
    )

    response = client.get(
        "/api/databases/common-tables",
        query_string={
            "db_ids": ",".join(
                str(database["id"]) for database in (first, second, third)
            )
        },
    )

    assert response.status_code == 200
    assert response.get_json() == ["objects"]


def test_multi_database_search_deduplicates_equal_rows_and_keeps_sources(
    client, tmp_path
):
    schema = {"objects": "id INTEGER PRIMARY KEY, value TEXT, kind TEXT"}
    identical_row = (1, "same value", "shared")
    first_only_row = (2, "first only", "unique")
    second_only_row = (3, "second only", "unique")

    first = _register(
        client,
        _create_database(
            tmp_path,
            "first.sqlite",
            schema,
            {"objects": [identical_row, first_only_row]},
        ),
        "First",
    )
    second = _register(
        client,
        _create_database(
            tmp_path,
            "second.sqlite",
            schema,
            {"objects": [identical_row, second_only_row]},
        ),
        "Second",
    )

    response = client.post(
        "/api/search/",
        json={
            "db_ids": [first["id"], second["id"]],
            "table": "objects",
            "filters": [],
            "logic": "AND",
            "deduplicate": True,
        },
    )

    assert response.status_code == 200
    result = response.get_json()
    assert result["total"] == 3
    assert len(result["rows"]) == 3

    shared = next(row for row in result["rows"] if row["value"] == "same value")
    assert shared["__sources__"] == [
        {"id": first["id"], "alias": "First", "path": first["path"]},
        {"id": second["id"], "alias": "Second", "path": second["path"]},
    ]
    assert shared["__db_id__"] == first["id"]


def test_multi_database_search_keeps_rows_present_in_only_one_database(
    client, tmp_path
):
    schema = {"objects": "id INTEGER PRIMARY KEY, value TEXT"}
    first = _register(
        client,
        _create_database(
            tmp_path,
            "first.sqlite",
            schema,
            {"objects": [(1, "only first")]},
        ),
        "First",
    )
    second = _register(
        client,
        _create_database(
            tmp_path,
            "second.sqlite",
            schema,
            {"objects": [(2, "only second")]},
        ),
        "Second",
    )

    response = client.post(
        "/api/search/",
        json={
            "db_ids": [first["id"], second["id"]],
            "table": "objects",
            "filters": [],
            "deduplicate": True,
        },
    )

    assert response.status_code == 200
    rows = response.get_json()["rows"]
    assert {row["value"] for row in rows} == {"only first", "only second"}
    assert all(len(row["__sources__"]) == 1 for row in rows)
    assert {
        row["__sources__"][0]["id"] for row in rows
    } == {first["id"], second["id"]}
