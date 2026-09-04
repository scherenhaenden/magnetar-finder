# Magnetar Finder

**Precision multi-database SQLite explorer with advanced search, unique analysis, saved findings, and notes.**

---

## What is this?

Magnetar Finder is a local web application that lets you explore one or more SQLite databases from a clean, dark-mode interface. It runs entirely on your machine — no cloud, no subscriptions.

---

## What it can do (v0.2.0)

### 🔍 Exploration — Advanced Search
- Connect multiple SQLite databases simultaneously
- Filter results using **chip-based query builder**:
  - `CONTAINS`, `NOT CONTAINS`
  - `EQUALS`, `NOT EQUALS`
  - `STARTS WITH`, `ENDS WITH`
  - `GT`, `LT`, `BETWEEN`
  - `IS NULL`, `IS NOT NULL`
- Combine filters with **AND / OR** logic
- Filter by **date ranges** on any date field
- Sort results by any column, ascending or descending
- Paginate through large result sets (200 rows/page)
- Auto-saved search history

### 📊 Analysis — Unique Values
- Select any field and see all distinct values grouped by frequency
- Visual bar chart of value distribution
- Click a value → see its **chronological timeline** (all records with that value, ordered by date)
- Add analytical notes to any unique value

### 📁 Archives — Saved Findings
- Save individual rows from search results
- Organise into **result groups**
- Add **notes** to any saved result
- Create **crosslinks** between results and notes

### 🗄️ Databases
- Add/remove SQLite files at any time (`.sqlite`, `.db`)
- Inspect tables and row counts
- Read-only access to your external databases (your data is never modified)

### 🔭 Internal Database
All your saved results, notes, groups and crosslinks are stored in `data/magnetar_finder.db` — a local SQLite file you own completely.

---

## How to launch

### One click (recommended)
```bash
bash build/run.sh
```
Opens the browser automatically at an available port starting from **7474**.

### Custom port
```bash
bash build/run.sh --port 8080
```

### Without auto-opening browser
```bash
bash build/run.sh --no-browser
```

### Linux desktop executable

The packaged Linux build is written to `builds/linux/magnetar-finder`. Build it
from the project root with the project virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt pyinstaller
mkdir -p builds/linux builds/.pyinstaller
pyinstaller --noconfirm --clean --onefile \
  --name magnetar-finder \
  --distpath "$PWD/builds/linux" \
  --workpath "$PWD/builds/.pyinstaller/work" \
  --specpath "$PWD/builds/.pyinstaller" \
  --add-data "$PWD/build/angular:angular_assets" \
  "$PWD/desktop_launcher.py"
```

Run it with:

```bash
./builds/linux/magnetar-finder
```

The executable targets Linux x86-64 and requires a compatible Linux system;
the build machine's Python runtime is bundled into the executable.

### Manual (if you prefer)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.py
```

`run.py` is a Python entry point, so run it with `./run.py` (or
`python3 run.py`), not with `bash ./run.py`.

---

## Project structure

```
magnetar-finder/
├── app/                  # Flask backend
│   ├── __init__.py       # App factory
│   ├── api/              # REST endpoints
│   │   ├── databases.py  # DB connection management
│   │   ├── search.py     # Query engine + antecedents
│   │   ├── results.py    # Saved results, notes, crosslinks
│   │   ├── unique.py     # Unique value analysis
│   │   └── settings.py   # Server info
│   └── core/
│       ├── db_manager.py    # Read-only external DB connections
│       ├── query_builder.py # Dynamic SQL filter builder
│       └── results_db.py    # Internal DB (findings + notes)
├── frontend/             # SPA (HTML + CSS + vanilla JS)
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
├── build/
│   └── run.sh            # One-click launcher
├── data/                 # Internal SQLite (auto-created)
├── run.py                # Entry point
├── requirements.txt
└── README.md
```

---

## Keyboard shortcut

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` / `Cmd + Enter` | Execute search |

---

## Requirements

- Python 3.10+
- Internet connection (only for first run, to download Google Fonts via CDN)

---

## Roadmap

- [ ] Export results to CSV / JSON
- [ ] PostgreSQL and MySQL support
- [ ] Full-text search index
- [ ] Custom column aliases
- [ ] Crosslink graph visualisation
- [ ] Dark/light theme toggle
- [ ] Offline font bundle

---

*Part of the Magnetar ecosystem.*
