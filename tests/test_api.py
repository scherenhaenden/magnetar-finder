import os
import json
import pytest
from app.core.results_db import get_connection

def test_settings_api(client):
    response = client.get("/api/settings/info")
    assert response.status_code == 200
    data = response.get_json()
    assert "version" in data
    assert "status" in data

def test_databases_crud(client, temp_external_db):
    # 1. Add database
    payload = {
        "path": temp_external_db,
        "alias": "Test External DB"
    }
    response = client.post("/api/databases/", json=payload)
    assert response.status_code == 201
    db_info = response.get_json()
    assert db_info["alias"] == "Test External DB"
    assert db_info["path"] == temp_external_db
    db_id = db_info["id"]

    # 2. List databases
    response = client.get("/api/databases/")
    assert response.status_code == 200
    dbs = response.get_json()
    assert len(dbs) >= 1
    assert any(d["id"] == db_id for d in dbs)

    # 3. Update database
    patch_payload = {"alias": "Updated Test DB", "active": False}
    response = client.patch(f"/api/databases/{db_id}", json=patch_payload)
    assert response.status_code == 200
    assert response.get_json()["ok"] is True

    # Check update was applied
    response = client.get("/api/databases/")
    db_item = next(d for d in response.get_json() if d["id"] == db_id)
    assert db_item["alias"] == "Updated Test DB"
    assert db_item["active"] == 0

    # Toggle back to active for downstream tests
    client.patch(f"/api/databases/{db_id}", json={"active": True})

    # 4. Tables inspection
    response = client.get(f"/api/databases/{db_id}/tables")
    assert response.status_code == 200
    tables = response.get_json()
    assert any(t["name"] == "detections" for t in tables)

    # 5. Columns inspection
    response = client.get(f"/api/databases/{db_id}/tables/detections/columns")
    assert response.status_code == 200
    cols = response.get_json()
    assert any(c["name"] == "status" for c in cols)
    assert any(c["name"] == "magnitude" for c in cols)

    # 6. Preview table
    response = client.get(f"/api/databases/{db_id}/tables/detections/preview")
    assert response.status_code == 200
    preview = response.get_json()
    assert len(preview) == 3

    # Clean up and delete
    response = client.delete(f"/api/databases/{db_id}")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_search_and_filter(client, temp_external_db):
    # Register the database
    payload = {
        "path": temp_external_db,
        "alias": "Search Test DB"
    }
    db_info = client.post("/api/databases/", json=payload).get_json()
    db_id = db_info["id"]

    # Execute a search without filters
    search_payload = {
        "db_ids": [db_id],
        "table": "detections",
        "filters": [],
        "logic": "AND"
    }
    response = client.post("/api/search/", json=search_payload)
    assert response.status_code == 200
    results = response.get_json()
    assert len(results["rows"]) == 3
    assert results["total"] == 3

    # Search with contains filter
    search_payload = {
        "db_ids": [db_id],
        "table": "detections",
        "filters": [{"field": "content", "op": "contains", "value": "harmonic"}],
        "logic": "AND"
    }
    response = client.post("/api/search/", json=search_payload)
    assert response.status_code == 200
    results = response.get_json()
    assert len(results["rows"]) == 1
    assert "Pre-burst harmonic resonance" in results["rows"][0]["content"]

    # Search with comparison filter
    search_payload = {
        "db_ids": [db_id],
        "table": "detections",
        "filters": [{"field": "magnitude", "op": "gt", "value": "5.0"}],
        "logic": "AND"
    }
    response = client.post("/api/search/", json=search_payload)
    assert response.status_code == 200
    results = response.get_json()
    assert len(results["rows"]) == 2  # 15.4 and 5.9

    # Clean up
    client.delete(f"/api/databases/{db_id}")


def test_unique_and_timeline(client, temp_external_db):
    # Register the database
    db_info = client.post("/api/databases/", json={"path": temp_external_db}).get_json()
    db_id = db_info["id"]

    # Load uniques grouped by source_url
    response = client.get(f"/api/unique/?db_id={db_id}&table=detections&field=source_url")
    assert response.status_code == 200
    uniques_data = response.get_json()
    assert uniques_data["total_unique"] == 2
    rows = uniques_data["rows"]
    assert len(rows) == 2
    gov_item = next(item for item in rows if "gov" in item["value"])
    assert gov_item["count"] == 2

    # Get timeline for magnetar-flux.gov
    timeline_url = f"/api/unique/timeline?db_id={db_id}&table=detections&field=source_url&value=http://magnetar-flux.gov&date_field=timestamp"
    response = client.get(timeline_url)
    assert response.status_code == 200
    timeline = response.get_json()
    assert len(timeline) == 2
    # Check chronological order (ascending)
    assert timeline[0]["timestamp"] < timeline[1]["timestamp"]

    # Clean up
    client.delete(f"/api/databases/{db_id}")


def test_findings_notes_and_groups(client, temp_external_db):
    # Register the database
    db_info = client.post("/api/databases/", json={"path": temp_external_db}).get_json()
    db_id = db_info["id"]

    # 1. Save a result
    save_payload = {
        "db_id": db_id,
        "table_name": "detections",
        "row_pk": "1",
        "row_data": {"status": "active", "content": "Sample saved finding"},
        "label": "My Important Finding"
    }
    response = client.post("/api/results/", json=save_payload)
    assert response.status_code == 201
    saved_item = response.get_json()
    assert "id" in saved_item
    saved_result_id = saved_item["id"]

    # 2. List saved results
    response = client.get("/api/results/")
    assert response.status_code == 200
    results = response.get_json()
    assert len(results) >= 1
    assert any(r["id"] == saved_result_id for r in results)

    # 3. Create Note for the saved finding
    note_payload = {
        "title": "Anomaly observation",
        "content": "This detection is highly anomalous.",
        "target_type": "result",
        "target_id": str(saved_result_id)
    }
    response = client.post("/api/results/notes", json=note_payload)
    assert response.status_code == 201
    note_item = response.get_json()
    assert "id" in note_item
    note_id = note_item["id"]

    # 4. List notes for target
    response = client.get(f"/api/results/notes?target_type=result&target_id={saved_result_id}")
    assert response.status_code == 200
    notes = response.get_json()
    assert len(notes) == 1
    assert notes[0]["id"] == note_id

    # 5. Create Group
    group_payload = {
        "name": "Gamma Burst Group",
        "description": "Group for tracking gamma burst findings"
    }
    response = client.post("/api/results/groups", json=group_payload)
    assert response.status_code == 201
    group_item = response.get_json()
    assert "id" in group_item
    group_id = group_item["id"]

    # 6. Add result to group
    response = client.post(f"/api/results/groups/{group_id}/members", json={"result_id": saved_result_id})
    assert response.status_code == 200

    # 7. List members of group (via GET /api/results/groups)
    response = client.get("/api/results/groups")
    assert response.status_code == 200
    groups_list = response.get_json()
    assert len(groups_list) >= 1
    target_group = next(g for g in groups_list if g["id"] == group_id)
    assert len(target_group["members"]) == 1
    assert target_group["members"][0]["id"] == saved_result_id

    # 8. Add Crosslink
    crosslink_payload = {
        "from_type": "group",
        "from_id": str(group_id),
        "to_type": "note",
        "to_id": str(note_id),
        "label": "Group reference note"
    }
    response = client.post("/api/results/crosslinks", json=crosslink_payload)
    assert response.status_code == 201
    crosslink_item = response.get_json()
    assert "id" in crosslink_item

    # 9. List crosslinks
    response = client.get(f"/api/results/crosslinks?from_type=group&from_id={group_id}")
    assert response.status_code == 200
    links = response.get_json()
    assert len(links) == 1
    assert links[0]["to_id"] == str(note_id)

    # 10. Clean up
    # Delete saved result first to avoid foreign key violation
    client.delete(f"/api/results/{saved_result_id}")
    # Delete database connection
    client.delete(f"/api/databases/{db_id}")
