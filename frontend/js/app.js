/* ============================================================
   Magnetar Finder — Main JavaScript SPA
   Handles: navigation, search, unique analysis, archives,
   databases CRUD, modals, notes, crosslinks
   ============================================================ */

// ── API ────────────────────────────────────────────────────────────────────────
const API = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async delete(path) {
    const r = await fetch(path, { method: 'DELETE' });
    return r.json();
  },
};

// ── State ──────────────────────────────────────────────────────────────────────
const State = {
  databases: [],
  activeDbs: new Set(),
  currentTable: '',
  columns: [],
  filters: [],
  logic: 'AND',
  sortField: '',
  sortDir: 'ASC',
  dateField: '',
  dateFrom: '',
  dateTo: '',
  searchResults: [],
  searchTotal: 0,
  searchOffset: 0,
  searchLimit: 200,
  queryMs: 0,

  // Uniques
  uniqDbId: null,
  uniqTable: '',
  uniqField: '',
  uniqDateField: '',
  uniqRows: [],
  selectedUniqValue: null,

  // Archives
  savedResults: [],
  selectedArchiveId: null,
};

// ── Toast ──────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  icon.textContent = type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info';
  icon.className = `material-symbols-outlined ${type === 'error' ? 'text-error' : 'text-primary-fixed-dim'}`;
  icon.style.fontSize = '18px';
  msgEl.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  const target = document.getElementById(`view-${viewId}`);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === viewId);
  });

  // Dynamically update TopBar tabs active state
  document.querySelectorAll('.top-tab-link').forEach(a => {
    const isActive = a.dataset.view === viewId;
    a.classList.toggle('text-primary-fixed', isActive);
    a.classList.toggle('border-b-2', isActive);
    a.classList.toggle('border-primary-fixed', isActive);
    a.classList.toggle('font-bold', isActive);
    a.classList.toggle('opacity-80', isActive);
    a.classList.toggle('text-on-surface-variant', !isActive);
  });

  // Trigger data loads
  if (viewId === 'archives') loadArchives();
  if (viewId === 'databases') renderDbCards();
  if (viewId === 'settings') loadSettings();
}

document.querySelectorAll('.nav-link').forEach(a => {
  if (a.id !== 'nav-support') {
    a.addEventListener('click', e => { e.preventDefault(); switchView(a.dataset.view); });
  }
});

document.querySelectorAll('.top-tab-link').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); switchView(a.dataset.view); });
});

document.getElementById('nav-support')?.addEventListener('click', e => {
  e.preventDefault();
  toast('Support channel online — Status: stable', 'success');
});

// ── Databases ──────────────────────────────────────────────────────────────────
async function loadDatabases() {
  try {
    State.databases = await API.get('/api/databases/');
    renderDbSidebar();
    renderDbCards();
  } catch (e) {
    toast('Failed to load databases', 'error');
  }
}

function renderDbSidebar() {
  const list = document.getElementById('db-list');
  const filter = document.getElementById('db-filter-input').value.toLowerCase();
  const dbs = State.databases.filter(d => d.alias.toLowerCase().includes(filter) || d.path.toLowerCase().includes(filter));

  if (!dbs.length) {
    list.innerHTML = `<p class="text-center text-on-surface-variant text-[12px] py-4">No databases connected.</p>`;
    return;
  }

  list.innerHTML = dbs.map(db => `
    <label class="flex items-center gap-3 p-2 rounded hover:bg-surface-container-highest cursor-pointer group transition-colors">
      <input type="checkbox" class="sr-only peer db-checkbox" value="${db.id}" ${State.activeDbs.has(db.id) ? 'checked' : ''}/>
      <div class="w-4 h-4 rounded-sm border border-outline-variant bg-surface-container-lowest peer-checked:bg-primary-fixed-dim peer-checked:border-primary-fixed-dim flex items-center justify-center transition-all shrink-0">
        <span class="material-symbols-outlined text-on-primary-fixed text-[12px] ${State.activeDbs.has(db.id) ? '' : 'hidden'}" style="font-weight:bold;">check</span>
      </div>
      <div class="flex-1 overflow-hidden">
        <div class="font-mono text-[12px] text-on-surface truncate group-hover:text-primary-fixed transition-colors">${db.alias}</div>
        <div class="text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">SQLite${!db.active ? ' • Inactive' : ''}</div>
      </div>
    </label>
  `).join('');

  list.querySelectorAll('.db-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.value);
      if (cb.checked) State.activeDbs.add(id); else State.activeDbs.delete(id);
      // Update checkmark visibility
      const checkmark = cb.parentElement.querySelector('.material-symbols-outlined');
      if (checkmark) checkmark.classList.toggle('hidden', !cb.checked);
      // Reload table selector
      populateTableSelect();
    });
  });
}

document.getElementById('db-filter-input').addEventListener('input', renderDbSidebar);

function renderDbCards() {
  const container = document.getElementById('db-cards');
  if (!State.databases.length) {
    container.innerHTML = `
      <div class="col-span-3 flex flex-col items-center justify-center py-16 gap-4 text-on-surface-variant">
        <span class="material-symbols-outlined text-outline" style="font-size:48px">storage</span>
        <p class="text-[14px]">No databases connected yet.</p>
        <button onclick="openModal('modal-connect-db')" class="primary-btn py-2 px-4 text-[11px]">Connect SQLite</button>
      </div>`;
    return;
  }
  container.innerHTML = State.databases.map(db => `
    <div class="db-card">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary-fixed-dim" style="font-size:20px;font-variation-settings:'FILL' 1">dataset</span>
          <h3 class="font-body font-semibold text-[14px] text-on-surface truncate max-w-[180px]" title="${db.path}">${db.alias}</h3>
        </div>
        <span class="${db.active ? 'status-dot-live' : 'status-dot-offline'}"></span>
      </div>
      <div class="font-mono text-[11px] text-on-surface-variant flex flex-col gap-1 mb-4">
        <span class="truncate" title="${db.path}">${db.path}</span>
        <span>SQLite ${db.active ? '• Online' : '• Inactive'}</span>
        <span>Added: ${db.created_at?.slice(0,10) || '—'}</span>
      </div>
      <div class="flex gap-2 border-t border-outline-variant pt-3">
        <button class="flex-1 text-center py-1 text-on-surface hover:text-primary-fixed-dim label-caps transition-colors" onclick="inspectDb(${db.id})">Inspect</button>
        <button class="flex-1 text-center py-1 text-on-surface hover:text-error label-caps transition-colors" onclick="disconnectDb(${db.id})">Disconnect</button>
      </div>
    </div>
  `).join('');
}

async function inspectDb(dbId) {
  try {
    const tables = await API.get(`/api/databases/${dbId}/tables`);
    const db = State.databases.find(d => d.id === dbId);
    toast(`${db?.alias}: ${tables.length} tables found`, 'info');
  } catch(e) { toast('Could not inspect database', 'error'); }
}

async function disconnectDb(dbId) {
  await API.delete(`/api/databases/${dbId}`);
  State.activeDbs.delete(dbId);
  await loadDatabases();
  toast('Database disconnected', 'success');
}

// ── Connect DB Modal ───────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.showModal(); }
function closeModal(id) { document.getElementById(id)?.close(); }

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.close(); });
});

['btn-connect-db-sidebar', 'btn-connect-db-main'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('conn-alias').value = '';
    document.getElementById('conn-path').value = '';
    document.getElementById('conn-error').classList.add('hidden');
    openModal('modal-connect-db');
  });
});

document.getElementById('btn-new-analysis')?.addEventListener('click', () => {
  switchView('exploration');
  openModal('modal-connect-db');
});

document.getElementById('btn-conn-submit')?.addEventListener('click', async () => {
  const alias = document.getElementById('conn-alias').value.trim();
  const path = document.getElementById('conn-path').value.trim();
  const errEl = document.getElementById('conn-error');
  errEl.classList.add('hidden');
  if (!path) { errEl.textContent = 'Path is required'; errEl.classList.remove('hidden'); return; }
  try {
    const res = await API.post('/api/databases/', { alias, path });
    if (res.error) { errEl.textContent = res.error; errEl.classList.remove('hidden'); return; }
    closeModal('modal-connect-db');
    await loadDatabases();
    State.activeDbs.add(res.id);
    renderDbSidebar();
    toast(`Connected: ${res.alias}`, 'success');
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
});

// ── Table & Column selector ────────────────────────────────────────────────────
async function populateTableSelect() {
  const sel = document.getElementById('table-select');
  const colSels = [
    document.getElementById('new-filter-field'),
    document.getElementById('sort-field-select'),
    document.getElementById('date-field-select'),
  ];

  if (!State.activeDbs.size) {
    sel.innerHTML = '<option value="">— Select a database first —</option>';
    colSels.forEach(s => { s.innerHTML = '<option value="">—</option>'; });
    return;
  }

  // Collect tables from all active DBs
  const allTables = new Set();
  for (const dbId of State.activeDbs) {
    try {
      const tables = await API.get(`/api/databases/${dbId}/tables`);
      tables.forEach(t => allTables.add(t.name));
    } catch(e) {}
  }

  sel.innerHTML = '<option value="">— Select Table —</option>' +
    [...allTables].map(t => `<option value="${t}">${t}</option>`).join('');

  if (State.currentTable && allTables.has(State.currentTable)) {
    sel.value = State.currentTable;
    await populateColumnSelects();
  }
}

async function populateColumnSelects() {
  const table = document.getElementById('table-select').value;
  if (!table || !State.activeDbs.size) return;
  const dbId = [...State.activeDbs][0];
  const cols = await API.get(`/api/databases/${dbId}/tables/${encodeURIComponent(table)}/columns`);
  State.columns = cols;
  State.currentTable = table;

  const opts = '<option value="">—</option>' + cols.map(c => `<option value="${c.name}">${c.name} (${c.type || 'TEXT'})</option>`).join('');
  document.getElementById('new-filter-field').innerHTML = opts;
  document.getElementById('sort-field-select').innerHTML = '<option value="">Sort by…</option>' + cols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  document.getElementById('date-field-select').innerHTML = '<option value="">No date field</option>' + cols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

document.getElementById('table-select')?.addEventListener('change', populateColumnSelects);

document.getElementById('new-filter-op')?.addEventListener('change', function() {
  const v2 = document.getElementById('new-filter-value2');
  v2.classList.toggle('hidden', this.value !== 'between');
  const v1 = document.getElementById('new-filter-value');
  v1.classList.toggle('hidden', this.value === 'is_null' || this.value === 'is_not_null');
});

// ── Filters ────────────────────────────────────────────────────────────────────
function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  container.innerHTML = State.filters.map((f, i) => {
    const isNeg = f.op.includes('not') || f.op === 'lt' || f.op === 'is_null';
    const opLabel = f.op.replace(/_/g, ' ').toUpperCase();
    const val = f.op === 'between' ? `${f.value} ↔ ${f.value2}` : f.value || '';
    return `
      <div class="filter-chip">
        <span class="chip-op ${isNeg ? 'negative' : ''}">${opLabel}</span>
        <span class="font-mono text-[10px] text-on-surface-variant">${f.field}</span>
        ${val ? `<span class="chip-value">"${val}"</span>` : ''}
        <button class="chip-remove" data-idx="${i}">
          <span class="material-symbols-outlined" style="font-size:13px">close</span>
        </button>
      </div>`;
  }).join('');

  container.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      State.filters.splice(parseInt(btn.dataset.idx), 1);
      renderFilterChips();
    });
  });
}

document.getElementById('btn-add-filter')?.addEventListener('click', () => {
  const field = document.getElementById('new-filter-field').value;
  const op = document.getElementById('new-filter-op').value;
  const value = document.getElementById('new-filter-value').value;
  const value2 = document.getElementById('new-filter-value2').value;
  if (!field) { toast('Select a field first', 'error'); return; }
  State.filters.push({ field, op, value, value2 });
  renderFilterChips();
  document.getElementById('new-filter-value').value = '';
  document.getElementById('new-filter-value2').value = '';
});

document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
  State.filters = [];
  renderFilterChips();
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
});

// Logic toggle
['logic-and', 'logic-or'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    State.logic = id === 'logic-and' ? 'AND' : 'OR';
    document.getElementById('logic-and').classList.toggle('active', State.logic === 'AND');
    document.getElementById('logic-or').classList.toggle('active', State.logic === 'OR');
  });
});

// Sort toggle
['sort-asc', 'sort-desc'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    State.sortDir = id === 'sort-asc' ? 'ASC' : 'DESC';
    document.getElementById('sort-asc').classList.toggle('active', State.sortDir === 'ASC');
    document.getElementById('sort-desc').classList.toggle('active', State.sortDir === 'DESC');
  });
});

// ── Search ─────────────────────────────────────────────────────────────────────
async function runSearch(offset = 0) {
  const table = document.getElementById('table-select').value;
  if (!table) { toast('Select a table first', 'error'); return; }
  if (!State.activeDbs.size) { toast('Activate at least one database', 'error'); return; }

  const sortField = document.getElementById('sort-field-select').value;
  const dateField = document.getElementById('date-field-select').value;
  const dateFrom = document.getElementById('date-from').value;
  const dateTo = document.getElementById('date-to').value;

  document.getElementById('status-count').innerHTML = `<span class="loader-bar"><span></span><span></span><span></span><span></span></span>`;

  try {
    const res = await API.post('/api/search/', {
      db_ids: [...State.activeDbs],
      table,
      filters: State.filters,
      logic: State.logic,
      sort_field: sortField || null,
      sort_dir: State.sortDir,
      limit: State.searchLimit,
      offset,
      date_field: dateField || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    });

    State.searchResults = res.rows || [];
    State.searchTotal = res.total || 0;
    State.searchOffset = offset;
    State.queryMs = res.query_ms || 0;

    renderResultsTable();
    document.getElementById('status-count').textContent = `${State.searchTotal.toLocaleString()} total — showing ${offset + 1}–${Math.min(offset + State.searchResults.length, State.searchTotal)}`;
    document.getElementById('status-timing').innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim inline-block mr-1"></span> ${State.queryMs}ms`;
    document.getElementById('status-page').textContent = `Page ${Math.floor(offset / State.searchLimit) + 1}`;
    document.getElementById('btn-prev-page').disabled = offset === 0;
    document.getElementById('btn-next-page').disabled = offset + State.searchResults.length >= State.searchTotal;

    if (res.errors?.length) toast(`Some databases failed: ${res.errors.map(e => e.error).join(', ')}`, 'error');
  } catch(e) {
    toast('Search failed: ' + e.message, 'error');
    document.getElementById('status-count').textContent = 'Error';
  }
}

document.getElementById('btn-search')?.addEventListener('click', () => runSearch(0));
document.getElementById('btn-execute')?.addEventListener('click', () => runSearch(0));
document.getElementById('btn-prev-page')?.addEventListener('click', () => runSearch(Math.max(0, State.searchOffset - State.searchLimit)));
document.getElementById('btn-next-page')?.addEventListener('click', () => runSearch(State.searchOffset + State.searchLimit));

function renderResultsTable() {
  const header = document.getElementById('results-header');
  const body = document.getElementById('results-body');
  const empty = document.getElementById('results-empty');

  if (!State.searchResults.length) {
    header.classList.add('hidden');
    body.innerHTML = '';
    empty.classList.remove('hidden');
    body.appendChild(empty);
    return;
  }

  // Collect columns from first row (excluding __db_id__)
  const cols = Object.keys(State.searchResults[0]).filter(k => k !== '__db_id__');

  header.classList.remove('hidden');
  header.innerHTML = `<div class="grid gap-3" style="grid-template-columns: 20px ${cols.map(() => '1fr').join(' ')} 120px">
    <div></div>
    ${cols.map(c => `<div class="truncate cursor-pointer hover:text-primary-fixed transition-colors" title="${c}">${c}</div>`).join('')}
    <div class="text-right">ACTIONS</div>
  </div>`;

  body.innerHTML = State.searchResults.map((row, i) => {
    const dbId = row.__db_id__;
    const cells = cols.map(c => {
      const val = row[c];
      return `<div class="truncate font-mono text-[11px] text-on-surface-variant" title="${String(val ?? '').replace(/"/g,'&quot;')}">${val ?? '<null>'}</div>`;
    }).join('');
    return `
      <div class="result-row grid gap-3 px-5 py-2 border-b border-outline-variant/20 items-center"
           style="grid-template-columns: 20px ${cols.map(() => '1fr').join(' ')} 120px"
           data-idx="${i}">
        <div class="status-dot-live shrink-0"></div>
        ${cells}
        <div class="row-actions flex items-center justify-end gap-1">
          <button class="btn-antecedents ghost-btn py-0.5 px-2 text-[10px]" data-idx="${i}" title="View antecedents">
            <span class="material-symbols-outlined" style="font-size:13px">history</span>
          </button>
          <button class="btn-save-result primary-btn py-0.5 px-2 text-[10px]" data-idx="${i}" title="Save result">
            <span class="material-symbols-outlined" style="font-size:13px">bookmark_add</span>
          </button>
        </div>
      </div>`;
  }).join('');

  // Events
  body.querySelectorAll('.btn-antecedents').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); showAntecedents(parseInt(btn.dataset.idx)); });
  });
  body.querySelectorAll('.btn-save-result').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); saveResult(parseInt(btn.dataset.idx)); });
  });
}

// ── Antecedents ────────────────────────────────────────────────────────────────
async function showAntecedents(idx) {
  const row = State.searchResults[idx];
  const dateField = document.getElementById('date-field-select').value;
  if (!dateField) { toast('Set a date field in the search panel first', 'error'); return; }
  const dateVal = row[dateField];
  if (!dateVal) { toast(`Row has no value in "${dateField}"`, 'error'); return; }

  document.getElementById('antecedent-subtitle').textContent =
    `Showing all records on ${String(dateVal).slice(0,10)} — field: ${dateField}`;

  const list = document.getElementById('antecedent-list');
  list.innerHTML = '<div class="loader-bar"><span></span><span></span><span></span><span></span></div>';
  openModal('modal-antecedents');

  try {
    const table = document.getElementById('table-select').value;
    const rows = await API.get(
      `/api/search/antecedents?db_id=${row.__db_id__}&table=${encodeURIComponent(table)}&date_field=${encodeURIComponent(dateField)}&date_value=${encodeURIComponent(String(dateVal).slice(0,10))}&limit=100`
    );

    if (!rows.length) { list.innerHTML = '<p class="text-center text-on-surface-variant">No records found for this date.</p>'; return; }

    const cols = Object.keys(rows[0]).filter(k => k !== '__db_id__');
    list.innerHTML = rows.map(r => {
      const timeVal = r[dateField] || '';
      const preview = cols.filter(c => c !== dateField).map(c => `<span class="text-on-surface-variant">${c}:</span> ${r[c] ?? '—'}`).join('  ·  ');
      return `
        <div class="timeline-item group">
          <div class="w-10 pt-0.5 shrink-0 text-right font-mono text-[10px] text-on-surface-variant">${String(timeVal).slice(11,16) || String(timeVal).slice(0,10)}</div>
          <div class="timeline-diamond shrink-0"></div>
          <div class="flex-1 bg-surface-container-low border border-outline-variant/50 p-2.5 rounded hover:border-primary-fixed-dim/50 transition-colors">
            <div class="font-mono text-[11px] text-primary-fixed-dim mb-1">${String(timeVal)}</div>
            <div class="font-body text-[12px] text-on-surface-variant truncate">${preview}</div>
          </div>
        </div>`;
    }).join('');
  } catch(e) { list.innerHTML = `<p class="text-error">${e.message}</p>`; }
}

// ── Save result ────────────────────────────────────────────────────────────────
async function saveResult(idx) {
  const row = State.searchResults[idx];
  const table = document.getElementById('table-select').value;
  const dbId = row.__db_id__;
  const cols = Object.keys(row).filter(k => k !== '__db_id__');
  const pk = cols[0];
  await API.post('/api/results/', {
    db_id: dbId,
    table_name: table,
    row_pk: String(row[pk]),
    row_data: row,
    label: '',
  });
  toast('Result saved to Archives', 'success');
}

// ── Unique Analysis ────────────────────────────────────────────────────────────
async function loadUniqDbs() {
  const sel = document.getElementById('uniq-db-select');
  sel.innerHTML = '<option value="">— Database —</option>' +
    State.databases.filter(d => d.active).map(d => `<option value="${d.id}">${d.alias}</option>`).join('');
}

document.getElementById('uniq-db-select')?.addEventListener('change', async function() {
  const dbId = parseInt(this.value);
  State.uniqDbId = dbId || null;
  const tSel = document.getElementById('uniq-table-select');
  tSel.innerHTML = '<option value="">— Table —</option>';
  document.getElementById('uniq-field-select').innerHTML = '<option value="">Field…</option>';
  document.getElementById('uniq-date-field-select').innerHTML = '<option value="">Timeline…</option>';
  if (!dbId) return;
  const tables = await API.get(`/api/databases/${dbId}/tables`);
  tSel.innerHTML = '<option value="">— Table —</option>' + tables.map(t => `<option value="${t.name}">${t.name} (${t.row_count?.toLocaleString()})</option>`).join('');
});

document.getElementById('uniq-table-select')?.addEventListener('change', async function() {
  State.uniqTable = this.value;
  const fSel = document.getElementById('uniq-field-select');
  const dfSel = document.getElementById('uniq-date-field-select');
  fSel.innerHTML = '<option value="">Field…</option>';
  dfSel.innerHTML = '<option value="">Timeline…</option>';
  if (!this.value || !State.uniqDbId) return;
  const cols = await API.get(`/api/databases/${State.uniqDbId}/tables/${encodeURIComponent(this.value)}/columns`);
  const opts = cols.map(c => `<option value="${c.name}">${c.name} (${c.type || 'TEXT'})</option>`).join('');
  fSel.innerHTML = '<option value="">Field…</option>' + opts;
  dfSel.innerHTML = '<option value="">Timeline…</option>' + opts;
});

document.getElementById('btn-load-uniques')?.addEventListener('click', loadUniques);

async function loadUniques() {
  const dbId = State.uniqDbId;
  const table = document.getElementById('uniq-table-select').value;
  const field = document.getElementById('uniq-field-select').value;
  State.uniqField = field;
  State.uniqDateField = document.getElementById('uniq-date-field-select').value;

  if (!dbId || !table || !field) { toast('Select database, table and field', 'error'); return; }

  const search = document.getElementById('uniq-search').value;
  const data = await API.get(`/api/unique/?db_id=${dbId}&table=${encodeURIComponent(table)}&field=${encodeURIComponent(field)}&limit=500${search ? '&search=' + encodeURIComponent(search) : ''}`);
  State.uniqRows = data.rows || [];
  document.getElementById('uniq-total').textContent = `Total Unique: ${(data.total_unique || 0).toLocaleString()}`;
  renderUniqTable();
}

document.getElementById('uniq-search')?.addEventListener('input', debounce(loadUniques, 400));

function renderUniqTable() {
  const tbody = document.getElementById('uniq-table-body');
  if (!State.uniqRows.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="px-4 py-6 text-center text-on-surface-variant text-[13px]">No data.</td></tr>';
    return;
  }
  const maxCount = State.uniqRows[0]?.count || 1;
  tbody.innerHTML = State.uniqRows.map((r, i) => `
    <tr class="uniq-row" data-idx="${i}">
      <td class="py-2 px-4 font-mono text-[12px] text-on-surface-variant truncate max-w-[180px]" title="${String(r.value ?? '')}">${r.value ?? '<null>'}</td>
      <td class="py-2 px-4 font-mono text-[12px] text-on-surface text-right">${Number(r.count).toLocaleString()}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.uniq-row').forEach(row => {
    row.addEventListener('click', () => selectUniqValue(parseInt(row.dataset.idx)));
  });
}

async function selectUniqValue(idx) {
  const item = State.uniqRows[idx];
  State.selectedUniqValue = item.value;

  document.querySelectorAll('.uniq-row').forEach((r, i) => r.classList.toggle('active', i === idx));
  document.getElementById('uniq-selected-value').textContent = String(item.value ?? '—');

  // Bar chart (relative frequency)
  const maxCount = State.uniqRows[0]?.count || 1;
  const bars = State.uniqRows.slice(0, 30);
  document.getElementById('uniq-bars').innerHTML = bars.map(b => {
    const pct = Math.max(4, Math.round((b.count / maxCount) * 100));
    const isSelected = b.value === item.value;
    return `<div class="flex-1 transition-colors cursor-pointer"
                 style="height:${pct}%;background:${isSelected ? '#00dbe7' : 'rgba(0,219,231,0.25)'}"
                 title="${b.value}: ${b.count}"></div>`;
  }).join('');

  // Timeline
  if (State.uniqDateField) {
    const rows = await API.get(
      `/api/unique/timeline?db_id=${State.uniqDbId}&table=${encodeURIComponent(State.uniqTable)}&field=${encodeURIComponent(State.uniqField)}&value=${encodeURIComponent(String(item.value ?? ''))}&date_field=${encodeURIComponent(State.uniqDateField)}&limit=50`
    );
    renderUniqTimeline(rows);
  } else {
    document.getElementById('uniq-timeline').innerHTML = '<p class="text-center text-on-surface-variant text-[12px] mt-4">Set a timeline field to view chronological events.</p>';
  }

  // Notes
  loadUniqNotes();
}

function renderUniqTimeline(rows) {
  const container = document.getElementById('uniq-timeline');
  if (!rows.length) { container.innerHTML = '<p class="text-center text-on-surface-variant text-[12px] mt-4">No records for this value.</p>'; return; }
  const dateField = State.uniqDateField;
  const trackHtml = `<div class="absolute left-[19px] top-0 bottom-0 w-px bg-outline-variant/50"></div>`;
  const items = rows.map(r => {
    const ts = r[dateField] || '';
    const cols = Object.keys(r).filter(k => k !== dateField);
    const preview = cols.slice(0, 3).map(c => `${c}: ${String(r[c] ?? '').slice(0, 40)}`).join('  ·  ');
    return `
      <div class="timeline-item group">
        <div class="w-10 shrink-0 text-right font-mono text-[10px] text-on-surface-variant pt-1">${String(ts).slice(11,16) || String(ts).slice(0,10)}</div>
        <div class="timeline-diamond shrink-0"></div>
        <div class="flex-1 bg-surface-container-low border border-outline-variant/50 p-2.5 rounded hover:border-primary-fixed-dim/50 transition-colors">
          <div class="font-mono text-[11px] text-primary-fixed-dim mb-0.5">${String(ts)}</div>
          <div class="font-body text-[12px] text-on-surface-variant">${preview}</div>
        </div>
      </div>`;
  }).join('');
  container.innerHTML = `<div class="relative">${trackHtml}<div class="flex flex-col gap-4 relative z-10">${items}</div></div>`;
}

async function loadUniqNotes() {
  const list = document.getElementById('uniq-notes-list');
  if (!State.selectedUniqValue) { list.innerHTML = ''; return; }
  const notes = await API.get(`/api/results/notes?target_type=value&target_id=${encodeURIComponent(String(State.selectedUniqValue))}`);
  list.innerHTML = notes.map(n => `
    <div class="note-card">
      ${n.title ? `<div class="note-title">${n.title}</div>` : ''}
      <div class="note-body">${n.content}</div>
      <div class="note-date">${n.created_at}</div>
    </div>`).join('') || '<p class="text-center text-on-surface-variant text-[12px] mt-2">No notes yet.</p>';
}

document.getElementById('btn-save-uniq-note')?.addEventListener('click', async () => {
  if (!State.selectedUniqValue) { toast('Select a value first', 'error'); return; }
  const content = document.getElementById('uniq-note-input').value.trim();
  if (!content) return;
  await API.post('/api/results/notes', {
    content,
    target_type: 'value',
    target_id: String(State.selectedUniqValue),
  });
  document.getElementById('uniq-note-input').value = '';
  loadUniqNotes();
  toast('Note saved', 'success');
});

document.getElementById('btn-link-note-uniq')?.addEventListener('click', () => {
  if (!State.selectedUniqValue) { toast('Select a value first', 'error'); return; }
  openNoteModal('value', String(State.selectedUniqValue));
});

// ── Archives ───────────────────────────────────────────────────────────────────
async function loadArchives() {
  const rows = await API.get('/api/results/');
  State.savedResults = rows;
  const tbody = document.getElementById('archives-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-on-surface-variant">No saved findings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr class="archive-row border-b border-outline-variant/30" data-id="${r.id}">
      <td class="px-4 py-2.5 text-center"><span class="material-symbols-outlined text-primary-fixed-dim" style="font-size:16px;font-variation-settings:'FILL' 1">bookmark</span></td>
      <td class="px-4 py-2.5 font-mono text-[12px] text-primary-fixed-dim">#${r.id}</td>
      <td class="px-4 py-2.5 font-mono text-[11px] text-on-surface-variant">${r.db_alias || '—'}</td>
      <td class="px-4 py-2.5 font-mono text-[11px] text-on-surface-variant">${r.table_name}</td>
      <td class="px-4 py-2.5 font-body text-[13px] text-on-surface max-w-[200px] truncate">${r.label || '—'}</td>
      <td class="px-4 py-2.5 font-mono text-[11px] text-on-surface-variant">${r.saved_at?.slice(0,16) || '—'}</td>
      <td class="px-4 py-2.5 text-right">
        <button class="ghost-btn py-0.5 px-2 text-[10px] btn-archive-note" data-id="${r.id}">Note</button>
        <button class="ghost-btn py-0.5 px-2 text-[10px] ml-1 btn-archive-delete" data-id="${r.id}">Del</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.archive-row').forEach(row => {
    row.addEventListener('click', () => selectArchiveRow(parseInt(row.dataset.id)));
  });
  tbody.querySelectorAll('.btn-archive-note').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openNoteModal('result', btn.dataset.id); });
  });
  tbody.querySelectorAll('.btn-archive-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await API.delete(`/api/results/${btn.dataset.id}`);
      loadArchives();
      toast('Result deleted', 'success');
    });
  });
}

async function selectArchiveRow(id) {
  State.selectedArchiveId = id;
  document.querySelectorAll('.archive-row').forEach(r => r.classList.toggle('active', parseInt(r.dataset.id) === id));
  document.getElementById('archives-note-target').textContent = `#${id}`;
  const notes = await API.get(`/api/results/notes?target_type=result&target_id=${id}`);
  const list = document.getElementById('archives-notes-list');
  list.innerHTML = notes.map(n => `
    <div class="note-card">
      ${n.title ? `<div class="note-title">${n.title}</div>` : ''}
      <div class="note-body">${n.content}</div>
      <div class="note-date">${n.created_at}</div>
    </div>`).join('') || '<p class="text-center text-on-surface-variant text-[12px] mt-2">No notes for this result.</p>';
}

document.getElementById('btn-save-archives-note')?.addEventListener('click', async () => {
  if (!State.selectedArchiveId) { toast('Select a result first', 'error'); return; }
  const content = document.getElementById('archives-note-input').value.trim();
  if (!content) return;
  await API.post('/api/results/notes', {
    content,
    target_type: 'result',
    target_id: String(State.selectedArchiveId),
  });
  document.getElementById('archives-note-input').value = '';
  selectArchiveRow(State.selectedArchiveId);
  toast('Note saved', 'success');
});

document.getElementById('btn-refresh-archives')?.addEventListener('click', loadArchives);
document.getElementById('btn-create-group')?.addEventListener('click', async () => {
  const name = prompt('Group name:');
  if (!name) return;
  await API.post('/api/results/groups', { name });
  toast('Group created', 'success');
});

// ── Note modal ─────────────────────────────────────────────────────────────────
function openNoteModal(targetType, targetId, noteId = null, title = '', content = '') {
  document.getElementById('note-target-type').value = targetType;
  document.getElementById('note-target-id').value = targetId;
  document.getElementById('note-id').value = noteId || '';
  document.getElementById('note-title').value = title;
  document.getElementById('note-content').value = content;
  openModal('modal-note');
}

document.getElementById('btn-note-submit')?.addEventListener('click', async () => {
  const noteId = document.getElementById('note-id').value;
  const payload = {
    title: document.getElementById('note-title').value,
    content: document.getElementById('note-content').value,
    target_type: document.getElementById('note-target-type').value,
    target_id: document.getElementById('note-target-id').value,
  };
  if (noteId) {
    await API.patch(`/api/results/notes/${noteId}`, payload);
  } else {
    await API.post('/api/results/notes', payload);
  }
  closeModal('modal-note');
  toast('Note saved', 'success');
  if (payload.target_type === 'result') selectArchiveRow(parseInt(payload.target_id));
  if (payload.target_type === 'value') loadUniqNotes();
});

// ── Settings ───────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const info = await API.get('/api/settings/info');
    document.getElementById('settings-info').innerHTML = Object.entries(info).map(([k,v]) =>
      `<div class="flex gap-4"><span class="text-on-surface-variant w-24">${k}</span><span class="text-primary-fixed">${v}</span></div>`
    ).join('');
  } catch(e) {}
}

// ── Server status ──────────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    await API.get('/api/settings/info');
    document.getElementById('status-text').textContent = 'Online';
    document.getElementById('server-status').querySelector('span').classList.remove('bg-error');
    document.getElementById('server-status').querySelector('span').classList.add('bg-primary-fixed-dim');
  } catch(e) {
    document.getElementById('status-text').textContent = 'Offline';
    document.getElementById('server-status').querySelector('span').classList.add('bg-error');
    document.getElementById('server-status').querySelector('span').classList.remove('bg-primary-fixed-dim');
  }
}

// ── Utility ────────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Boot ───────────────────────────────────────────────────────────────────────
(async function init() {
  await checkStatus();
  await loadDatabases();
  loadUniqDbs();

  // Keyboard shortcut: Ctrl/Cmd+Enter → search
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runSearch(0);
  });
})();
