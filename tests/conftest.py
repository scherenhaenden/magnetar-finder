import os
import tempfile
import sqlite3
import pytest
from unittest import mock

# Create directories and mock DB_PATH before app imports
@pytest.fixture(autouse=True)
def mock_db_path(tmp_path):
    test_db_path = str(tmp_path / "test_magnetar_finder.db")

    # Patch the DB_PATH inside results_db module
    with mock.patch("app.core.results_db.DB_PATH", test_db_path):
        yield test_db_path

@pytest.fixture
def app(mock_db_path):
    # Patch DB_PATH inside any imported module
    from app.core import results_db
    results_db.DB_PATH = mock_db_path

    from app import create_app
    app = create_app()
    app.config.update({
        "TESTING": True,
    })

    # Initialize the test internal database
    from app.core.results_db import init_db
    init_db()

    yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def temp_external_db():
    """Create a temporary SQLite database representing an external DB."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            content TEXT NOT NULL,
            magnitude REAL,
            source_url TEXT
        )
    """)
    conn.executemany(
        "INSERT INTO detections (status, timestamp, content, magnitude, source_url) VALUES (?, ?, ?, ?, ?)",
        [
            ("active", "2023-10-12 04:22:19", "Detection of intense gamma ray burst correlating with magnetic anomaly...", 15.4, "http://magnetar-flux.gov"),
            ("offline", "2023-10-11 18:45:02", "Minor fluctuation recorded in lower band frequencies. Below threshold...", 2.1, "http://solar-flares.org"),
            ("active", "2023-10-10 09:12:44", "Pre-burst harmonic resonance observed. Data aligns with model A-4.", 5.9, "http://magnetar-flux.gov"),
        ]
    )
    conn.commit()
    conn.close()

    yield path

    if os.path.exists(path):
        os.remove(path)
