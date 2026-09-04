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
    const contentType = r.headers.get('content-type') || '';
    const response = contentType.includes('application/json') ? await r.json() : await r.text();
    if (!r.ok) {
      const detail = typeof response === 'object' && response?.error ? response.error : `POST ${path} → ${r.status}`;
      throw new Error(detail);
    }
    if (typeof response === 'string') throw new Error(`POST ${path} returned a non-JSON response`);
    return response;
  },
  async upload(path, formData) {
    const r = await fetch(path, { method: 'POST', body: formData });
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  },
  async delete(path) {
    const r = await fetch(path, { method: 'DELETE' });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || `DELETE ${path} → ${r.status}`);
    return body;
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
  expression: null,
  filterTargetGroup: 'root',
  sortField: '',
  sortDir: 'ASC',
  dateField: '',
  dateFrom: '',
  dateTo: '',
  searchResults: [],
  analysisResults: [],
  analysisLoading: false,
  analysisRequestId: 0,
  searchRequestId: 0,
  searchTotal: 0,
  searchOffset: 0,
  searchLimit: 200,
  queryMs: 0,
  hasExecutedSearch: false,
  resultChain: [],
  resultChainIndex: 0,
  sublistSteps: [],
  pendingSublistSteps: [],
  selectedFilterIds: new Set(),
  columnOrder: [],
  visibleColumns: [],
  columnPrefs: {},
  columnTransformations: {},
  resultSubview: 'results',
  analysisField: '',
  panelSplitRatio: 0.5,

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
  queryTabs: [],
  activeQueryId: null,
  analysisTabs: [],
  activeAnalysisId: null,
  debugQuery: null,
  editingFilterId: null,
  draggedFilterId: null,
};

const UI_STORAGE_KEY = 'magnetar-finder-ui-state-v1';

let queryIdSequence = 0;

function createQueryId() {
  queryIdSequence += 1;
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `query-${Date.now()}-${queryIdSequence}-${randomPart}`;
}

function createAnalysisId() {
  queryIdSequence += 1;
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `analysis-${Date.now()}-${queryIdSequence}-${randomPart}`;
}

function normalizeQueryTabs(tabs) {
  const usedIds = new Set();
  return tabs.map((tab, index) => {
    const normalized = tab && typeof tab === 'object' ? { ...tab } : {};
    let id = normalized.id == null ? '' : String(normalized.id).trim();
    if (!id || usedIds.has(id)) {
      id = createQueryId();
    }
    usedIds.add(id);
    normalized.id = id;
    normalized.label = typeof normalized.label === 'string' && normalized.label.trim()
      ? normalized.label
      : `Query ${index + 1}`;
    return normalized;
  });
}

function normalizeAnalysisTabs(tabs) {
  const usedIds = new Set();
  return tabs.map((analysis, index) => {
    const normalized = analysis && typeof analysis === 'object' ? { ...analysis } : {};
    let id = normalized.id == null ? '' : String(normalized.id).trim();
    if (!id || usedIds.has(id)) id = createAnalysisId();
    usedIds.add(id);
    normalized.id = id;
    normalized.label = typeof normalized.label === 'string' && normalized.label.trim()
      ? normalized.label : `Analysis ${index + 1}`;
    normalized.queryTabs = normalizeQueryTabs(Array.isArray(normalized.queryTabs) && normalized.queryTabs.length
      ? normalized.queryTabs : [freshQueryState('Query 1')]);
    const activeId = String(normalized.activeQueryId || '').trim();
    normalized.activeQueryId = normalized.queryTabs.some(tab => tab.id === activeId)
      ? activeId : normalized.queryTabs[0].id;
    normalized.activeDbs = Array.isArray(normalized.activeDbs)
      ? normalized.activeDbs.map(Number)
      : [...(normalized.queryTabs.find(tab => tab.id === normalized.activeQueryId)?.activeDbs || [])].map(Number);
    normalized.queryTabs.forEach(tab => { tab.activeDbs = [...normalized.activeDbs]; });
    return normalized;
  });
}

function normalizedIdList(value) {
  return Array.isArray(value) ? value.map(Number).sort((a, b) => a - b) : [];
}

function inferLegacyActiveQueryId(saved, tabs) {
  const savedDbs = JSON.stringify(normalizedIdList(saved.activeDbs));
  const savedFilters = JSON.stringify(saved.filters || []);
  const savedExpression = JSON.stringify(saved.expression || null);
  let best = null;

  tabs.forEach(tab => {
    let score = 0;
    if ((tab.currentTable || '') === (saved.currentTable || '')) score += 4;
    if (JSON.stringify(normalizedIdList(tab.activeDbs)) === savedDbs) score += 3;
    if (JSON.stringify(tab.filters || []) === savedFilters) score += 3;
    if (JSON.stringify(tab.expression || null) === savedExpression) score += 3;
    if ((tab.logic || 'AND') === (saved.logic || 'AND')) score += 1;
    if ((tab.sortDir || 'ASC') === (saved.sortDir || 'ASC')) score += 1;
    if ((tab.dateField || '') === (saved.dateField || '')) score += 1;
    if (!best || score > best.score) best = { id: tab.id, score };
  });

  return best?.score ? best.id : tabs[0]?.id || null;
}

function queryTabForStorage(tab) {
  // Results are transient. The query definition is enough to run it again.
  const {
    columns, searchResults, analysisResults, searchTotal, searchOffset, queryMs,
    resultChain, resultChainIndex, debugQuery, ...queryDefinition
  } = tab;
  return queryDefinition;
}

function persistUiState() {
  try {
    syncActiveQueryTab();
    syncActiveAnalysis();
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({
      activeDbs: [...State.activeDbs],
      currentTable: State.currentTable,
      filters: State.filters,
      logic: State.logic,
      expression: State.expression,
      sortField: document.getElementById('sort-field-select')?.value || '',
      sortDir: State.sortDir,
      dateField: document.getElementById('date-field-select')?.value || '',
      dateFrom: document.getElementById('date-from')?.value || '',
      dateTo: document.getElementById('date-to')?.value || '',
      hasSearch: State.hasExecutedSearch,
      columnPrefs: State.columnPrefs,
      columnTransformations: State.columnTransformations,
      sublistSteps: State.sublistSteps,
      selectedFilterIds: [...State.selectedFilterIds],
      queryTabs: State.queryTabs.map(queryTabForStorage),
      activeQueryId: State.activeQueryId,
      analysisTabs: State.analysisTabs.map(analysis => ({
        ...analysis,
        queryTabs: analysis.queryTabs.map(queryTabForStorage),
      })),
      activeAnalysisId: State.activeAnalysisId,
    }));
  } catch (e) {
    // Local storage may be disabled; the application remains usable in-memory.
  }
}

function restoreUiState() {
  try {
    const saved = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || 'null');
    if (!saved) {
      const firstQuery = freshQueryState('Query 1');
      const firstAnalysis = { id: createAnalysisId(), label: 'Analysis 1', queryTabs: [firstQuery], activeQueryId: firstQuery.id };
      State.analysisTabs = [firstAnalysis];
      applyAnalysisSnapshot(firstAnalysis);
      return null;
    }
    State.currentTable = saved.currentTable || '';
    State.filters = Array.isArray(saved.filters) ? saved.filters : [];
    State.logic = saved.logic === 'OR' ? 'OR' : 'AND';
    State.expression = saved.expression && saved.expression.type === 'group'
      ? saved.expression : null;
    State.sortDir = saved.sortDir === 'DESC' ? 'DESC' : 'ASC';
    State.hasExecutedSearch = saved.hasSearch === true;
    State.columnPrefs = saved.columnPrefs && typeof saved.columnPrefs === 'object' ? saved.columnPrefs : {};
    State.columnTransformations = saved.columnTransformations && typeof saved.columnTransformations === 'object'
      ? saved.columnTransformations : {};
    State.pendingSublistSteps = Array.isArray(saved.sublistSteps) ? saved.sublistSteps : [];
    State.activeDbs = new Set(Array.isArray(saved.activeDbs) ? saved.activeDbs.map(Number) : []);
    const storedTabs = Array.isArray(saved.queryTabs) && saved.queryTabs.length
      ? saved.queryTabs
      : [snapshotQueryState('Query 1')];
    State.queryTabs = normalizeQueryTabs(storedTabs);
    const storedActiveQueryId = saved.activeQueryId == null ? '' : String(saved.activeQueryId).trim();
    State.activeQueryId = State.queryTabs.some(tab => tab.id === storedActiveQueryId)
      ? storedActiveQueryId
      : inferLegacyActiveQueryId(saved, State.queryTabs);
    const activeTab = State.queryTabs.find(tab => tab.id === State.activeQueryId) || State.queryTabs[0];
    if (activeTab) {
      applyQuerySnapshot(activeTab);
      // The active query is rerun after the database/table controls are ready.
      State.pendingSublistSteps = Array.isArray(activeTab.sublistSteps) ? activeTab.sublistSteps : [];
    }
    const storedAnalyses = Array.isArray(saved.analysisTabs) && saved.analysisTabs.length
      ? saved.analysisTabs
      : [{ id: createAnalysisId(), label: 'Analysis 1', queryTabs: State.queryTabs, activeQueryId: State.activeQueryId, activeDbs: [...State.activeDbs] }];
    State.analysisTabs = normalizeAnalysisTabs(storedAnalyses);
    const storedAnalysisId = saved.activeAnalysisId == null ? '' : String(saved.activeAnalysisId).trim();
    State.activeAnalysisId = State.analysisTabs.some(analysis => analysis.id === storedAnalysisId)
      ? storedAnalysisId : State.analysisTabs[0]?.id || null;
    const activeAnalysis = State.analysisTabs.find(analysis => analysis.id === State.activeAnalysisId);
    if (activeAnalysis) applyAnalysisSnapshot(activeAnalysis);
    return saved;
  } catch (e) {
    return null;
  }
}

function snapshotQueryState(label = 'Query', id = null) {
  return {
    id: id || createQueryId(),
    label,
    activeDbs: [...State.activeDbs], currentTable: State.currentTable,
    columns: State.columns, filters: State.filters, logic: State.logic,
    expression: State.expression, filterTargetGroup: State.filterTargetGroup,
    sortField: document.getElementById('sort-field-select')?.value || '',
    sortDir: State.sortDir, dateField: document.getElementById('date-field-select')?.value || '',
    dateFrom: document.getElementById('date-from')?.value || '', dateTo: document.getElementById('date-to')?.value || '',
    searchResults: State.searchResults, analysisResults: State.analysisResults, searchTotal: State.searchTotal,
    searchOffset: State.searchOffset, queryMs: State.queryMs,
    hasExecutedSearch: State.hasExecutedSearch, resultChain: State.resultChain,
    resultChainIndex: State.resultChainIndex, sublistSteps: State.sublistSteps,
    columnOrder: State.columnOrder, visibleColumns: State.visibleColumns,
    selectedFilterIds: [...State.selectedFilterIds],
    columnTransformations: State.columnTransformations,
    debugQuery: State.debugQuery,
    resultSubview: State.resultSubview,
    analysisField: State.analysisField,
    panelSplitRatio: State.panelSplitRatio,
  };
}

function freshQueryState(label = 'Query') {
  return {
    id: createQueryId(),
    label,
    activeDbs: [], currentTable: '', columns: [], filters: [], logic: 'AND',
    expression: { type: 'group', id: 'root', logic: 'AND', children: [] },
    filterTargetGroup: 'root', sortField: '', sortDir: 'ASC', dateField: '', dateFrom: '', dateTo: '',
    searchResults: [], analysisResults: [], searchTotal: 0, searchOffset: 0, queryMs: 0,
    hasExecutedSearch: false, resultChain: [], resultChainIndex: 0, sublistSteps: [],
    columnOrder: [], visibleColumns: [], debugQuery: null,
    columnTransformations: {},
    resultSubview: 'results', analysisField: '', selectedFilterIds: [], panelSplitRatio: 0.5,
  };
}

function syncActiveQueryTab() {
  const tab = State.queryTabs.find(item => item.id === State.activeQueryId);
  if (!tab) return;
  // A tab identity is persistent. Never let a state snapshot replace it.
  Object.assign(tab, snapshotQueryState(tab.label, tab.id));
}

function syncActiveAnalysis() {
  const analysis = State.analysisTabs.find(item => item.id === State.activeAnalysisId);
  if (!analysis) return;
  analysis.queryTabs = State.queryTabs;
  analysis.activeQueryId = State.activeQueryId;
  analysis.activeDbs = [...State.activeDbs];
}

function applyAnalysisSnapshot(analysis) {
  State.activeAnalysisId = analysis.id;
  State.queryTabs = analysis.queryTabs;
  State.activeQueryId = analysis.activeQueryId;
  State.activeDbs = new Set((analysis.activeDbs || []).map(Number));
  const activeQuery = State.queryTabs.find(tab => tab.id === State.activeQueryId) || State.queryTabs[0];
  if (activeQuery) {
    applyQuerySnapshot(activeQuery);
    State.activeDbs = new Set((analysis.activeDbs || []).map(Number));
    activeQuery.activeDbs = [...State.activeDbs];
  }
}

function renderAnalysisTabs() {
  const container = document.getElementById('analysis-tabs');
  if (!container) return;
  container.innerHTML = State.analysisTabs.map(analysis => `
    <button type="button" class="analysis-tab ${analysis.id === State.activeAnalysisId ? 'active' : ''}" data-analysis-id="${analysis.id}">
      <span class="material-symbols-outlined" style="font-size:16px">analytics</span>
      <span class="analysis-tab-label">${escapeHtml(analysis.label)}</span>
      <span class="analysis-tab-count">${analysis.queryTabs.length}</span>
    </button>`).join('');
  container.querySelectorAll('.analysis-tab').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    switchAnalysis(button.dataset.analysisId);
  }));
}

async function switchAnalysis(id) {
  if (id === State.activeAnalysisId) return;
  syncActiveQueryTab(); syncActiveAnalysis();
  const analysis = State.analysisTabs.find(item => item.id === id);
  if (!analysis) return;
  applyAnalysisSnapshot(analysis);
  // Update the selected analysis immediately; table metadata can load asynchronously.
  renderAnalysisTabs();
  await refreshQueryView();
  persistUiState();
}

async function createNewAnalysis() {
  syncActiveQueryTab(); syncActiveAnalysis();
  const analysis = {
    id: createAnalysisId(), label: `Analysis ${State.analysisTabs.length + 1}`,
    queryTabs: [freshQueryState('Query 1')], activeQueryId: null, activeDbs: [],
  };
  analysis.activeQueryId = analysis.queryTabs[0].id;
  State.analysisTabs.push(analysis);
  applyAnalysisSnapshot(analysis);
  switchView('exploration');
  renderAnalysisTabs();
  await refreshQueryView();
  persistUiState();
}

function applyQuerySnapshot(tab) {
  State.activeQueryId = tab.id;
  State.activeDbs = new Set((tab.activeDbs || []).map(Number));
  State.currentTable = tab.currentTable || ''; State.columns = tab.columns || [];
  State.filters = tab.filters || []; State.logic = tab.logic === 'OR' ? 'OR' : 'AND';
  State.expression = tab.expression || null; State.filterTargetGroup = tab.filterTargetGroup || 'root';
  State.sortDir = tab.sortDir === 'DESC' ? 'DESC' : 'ASC'; State.searchResults = tab.searchResults || [];
  State.searchTotal = tab.searchTotal || 0; State.analysisResults = tab.analysisResults || [];
  State.searchOffset = tab.searchOffset || 0;
  State.queryMs = tab.queryMs || 0; State.hasExecutedSearch = tab.hasExecutedSearch === true;
  State.debugQuery = tab.debugQuery || null;
  State.resultChain = tab.resultChain || []; State.resultChainIndex = tab.resultChainIndex || 0;
  State.sublistSteps = tab.sublistSteps || []; State.pendingSublistSteps = [];
  State.selectedFilterIds = new Set(tab.selectedFilterIds || []);
  State.columnOrder = tab.columnOrder || []; State.visibleColumns = tab.visibleColumns || [];
  State.columnTransformations = tab.columnTransformations && typeof tab.columnTransformations === 'object'
    ? tab.columnTransformations : {};
  State.resultSubview = tab.resultSubview === 'analysis' ? 'analysis' : 'results';
  State.analysisField = tab.analysisField || '';
  State.panelSplitRatio = Number.isFinite(Number(tab.panelSplitRatio)) ? Number(tab.panelSplitRatio) : 0.5;
  applyResultsPanelSplit();
}

function applyResultsPanelSplit() {
  const panels = document.getElementById('exploration-panels');
  if (!panels) return;
  const availableHeight = panels.clientHeight - 10;
  const minPanelHeight = 170;
  const minRatio = availableHeight > minPanelHeight * 2
    ? minPanelHeight / availableHeight : 0.25;
  const maxRatio = availableHeight > minPanelHeight * 2
    ? 1 - (minPanelHeight / availableHeight) : 0.75;
  const ratio = Math.min(maxRatio, Math.max(minRatio, Number(State.panelSplitRatio) || 0.5));
  State.panelSplitRatio = ratio;
  panels.style.setProperty('--search-panel-size', `${ratio * 100}%`);
}

function setupResultsPanelSplitter() {
  const splitter = document.getElementById('results-panel-splitter');
  const panels = document.getElementById('exploration-panels');
  if (!splitter || !panels || splitter.dataset.bound === 'true') return;
  splitter.dataset.bound = 'true';

  const moveTo = clientY => {
    const bounds = panels.getBoundingClientRect();
    const availableHeight = bounds.height - splitter.offsetHeight;
    if (availableHeight <= 0) return;
    const minPanelHeight = 170;
    const minRatio = minPanelHeight / availableHeight;
    const maxRatio = 1 - (minPanelHeight / availableHeight);
    State.panelSplitRatio = Math.min(maxRatio, Math.max(minRatio, (clientY - bounds.top) / availableHeight));
    panels.style.setProperty('--search-panel-size', `${State.panelSplitRatio * 100}%`);
  };

  splitter.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    splitter.classList.add('dragging');
    splitter.setPointerCapture?.(event.pointerId);
    moveTo(event.clientY);
  });
  splitter.addEventListener('pointermove', event => {
    if (splitter.hasPointerCapture?.(event.pointerId)) moveTo(event.clientY);
  });
  const finishDrag = event => {
    if (splitter.hasPointerCapture?.(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    splitter.classList.remove('dragging');
    persistUiState();
  };
  splitter.addEventListener('pointerup', finishDrag);
  splitter.addEventListener('pointercancel', finishDrag);
  splitter.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') State.panelSplitRatio = 0.25;
    else if (event.key === 'End') State.panelSplitRatio = 0.75;
    else State.panelSplitRatio += event.key === 'ArrowUp' ? -0.03 : 0.03;
    applyResultsPanelSplit();
    persistUiState();
  });
  window.addEventListener('resize', applyResultsPanelSplit);
  applyResultsPanelSplit();
}

function renderQueryTabs() {
  const container = document.getElementById('query-tabs');
  if (!container) return;
  container.innerHTML = State.queryTabs.map(tab => `
    <button class="query-tab ${tab.id === State.activeQueryId ? 'active' : ''}" data-query-id="${tab.id}">
      <span class="material-symbols-outlined" style="font-size:14px">manage_search</span>
      <span class="query-tab-label">${escapeHtml(tab.label || 'Query')}</span>
      <span class="query-tab-copy" data-copy-query="${tab.id}" title="Copy query" aria-label="Copy query">⧉</span>
      <span class="query-tab-close" data-close-query="${tab.id}" title="Close query">×</span>
    </button>`).join('');
  container.querySelectorAll('.query-tab').forEach(button => button.addEventListener('click', event => {
    if (event.target.closest('[data-close-query]')) return;
    switchQuery(button.dataset.queryId);
  }));
  container.querySelectorAll('[data-close-query]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); closeQuery(button.dataset.closeQuery);
  }));
  container.querySelectorAll('[data-copy-query]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); copyQuery(button.dataset.copyQuery);
  }));
}

async function refreshQueryView() {
  setupResultsPanelSplitter();
  applyResultsPanelSplit();
  renderQueryTabs(); renderDbSidebar(); renderFilterChips();
  const activeTab = State.queryTabs.find(tab => tab.id === State.activeQueryId);
  const queryContext = document.getElementById('query-context-label');
  if (queryContext) queryContext.textContent = `QUERY: ${activeTab?.label || '—'}`;
  await populateTableSelect();
  document.getElementById('sort-field-select').value = activeTab?.sortField || '';
  document.getElementById('date-field-select').value = activeTab?.dateField || '';
  document.getElementById('date-from').value = activeTab?.dateFrom || '';
  document.getElementById('date-to').value = activeTab?.dateTo || '';
  document.getElementById('logic-and').classList.toggle('active', State.logic === 'AND');
  document.getElementById('logic-or').classList.toggle('active', State.logic === 'OR');
  renderResultsTable(); renderSublistControls(); renderColumnControls(); renderQueryDebug(); renderResultSubview();
}

async function switchQuery(id) {
  if (id === State.activeQueryId) return;
  syncActiveQueryTab();
  const tab = State.queryTabs.find(item => item.id === id);
  if (!tab) return;
  const needsRerun = tab.hasExecutedSearch === true && !Array.isArray(tab.searchResults);
  applyQuerySnapshot(tab);
  const currentAnalysis = State.analysisTabs.find(analysis => analysis.id === State.activeAnalysisId);
  if (currentAnalysis) {
    State.activeDbs = new Set((currentAnalysis.activeDbs || []).map(Number));
    tab.activeDbs = [...State.activeDbs];
  }
  await refreshQueryView(); persistUiState();
  // Persisted tabs deliberately omit rows, so rebuild a non-active tab when it
  // is opened after a reload. In-memory tabs already have their transient rows.
  if (needsRerun && State.currentTable && State.activeDbs.size) await runSearch(0);
}

function closeQuery(id) {
  if (State.queryTabs.length === 1) { toast('Keep at least one query open', 'info'); return; }
  const index = State.queryTabs.findIndex(tab => tab.id === id);
  State.queryTabs = State.queryTabs.filter(tab => tab.id !== id);
  if (id === State.activeQueryId) {
    applyQuerySnapshot(State.queryTabs[Math.max(0, index - 1)]);
    refreshQueryView().then(() => persistUiState());
  } else {
    renderQueryTabs();
    persistUiState();
  }
}

async function createNewQuery({ openDatabase = false } = {}) {
  syncActiveQueryTab();
  const next = freshQueryState(`Query ${State.queryTabs.length + 1}`);
  next.activeDbs = [...State.activeDbs];
  State.queryTabs.push(next);
  applyQuerySnapshot(next);
  await refreshQueryView();
  persistUiState();
  if (openDatabase) openModal('modal-connect-db');
}

async function copyQuery(id) {
  syncActiveQueryTab();
  const source = State.queryTabs.find(tab => tab.id === id);
  if (!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = createQueryId();
  copy.label = `Copy of ${source.label || 'Query'}`;
  State.queryTabs.push(copy);
  applyQuerySnapshot(copy);
  await refreshQueryView();
  persistUiState();
  toast('Query copied', 'success');
}

document.getElementById('btn-new-query')?.addEventListener('click', () => createNewQuery());

function ensureFilterExpression() {
  if (!State.expression || State.expression.type !== 'group') {
    State.expression = { type: 'group', id: 'root', logic: State.logic, children: State.filters.map((f, i) => ({ ...f, type: 'filter', id: `filter-${i}` })) };
  }
  State.expression.id = 'root';
  return State.expression;
}

function expressionGroups(node = ensureFilterExpression(), result = []) {
  result.push(node);
  (node.children || []).filter(child => child.type === 'group').forEach(child => expressionGroups(child, result));
  return result;
}

function findExpressionNode(id, node = ensureFilterExpression()) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = child.type === 'group' ? findExpressionNode(id, child) : null;
    if (found) return found;
  }
  return null;
}

function findFilterParent(id, node = ensureFilterExpression()) {
  for (const child of node.children || []) {
    if (child.type === 'filter' && child.id === id) return node;
    if (child.type === 'group') {
      const found = findFilterParent(id, child);
      if (found) return found;
    }
  }
  return null;
}

function clearFilterDragState() {
  State.draggedFilterId = null;
  document.querySelectorAll('.filter-chip.dragging, .filter-chip.drop-before, .filter-chip.drop-after, .filter-group.drag-over, .filter-expression-root.drag-over')
    .forEach(element => element.classList.remove('dragging', 'drop-before', 'drop-after', 'drag-over'));
}

function moveFilterByDrop(filterId, targetGroupId, targetFilterId = null, placeAfter = false) {
  const root = ensureFilterExpression();
  const filter = findFilterById(filterId);
  const sourceGroup = findFilterParent(filterId, root);
  const targetGroup = findExpressionNode(targetGroupId, root);
  if (!filter || !sourceGroup || !targetGroup || filter === targetGroup) return false;

  const sourceIndex = sourceGroup.children.indexOf(filter);
  if (sourceIndex < 0) return false;
  sourceGroup.children.splice(sourceIndex, 1);

  let targetIndex = targetGroup.children.length;
  if (targetFilterId) {
    const targetIndexBeforeRemoval = targetGroup.children.findIndex(child => child.id === targetFilterId);
    if (targetIndexBeforeRemoval >= 0) targetIndex = targetIndexBeforeRemoval + (placeAfter ? 1 : 0);
  }
  targetGroup.children.splice(Math.max(0, targetIndex), 0, filter);
  syncLegacyFilters();
  renderFilterChips();
  persistUiState();
  return true;
}

function filterDropData(event) {
  const id = event.dataTransfer?.getData('text/plain') || State.draggedFilterId;
  return id ? String(id) : null;
}

function bindFilterDragAndDrop(container) {
  const clearChipIndicators = () => container.querySelectorAll('.filter-chip.drop-before, .filter-chip.drop-after')
    .forEach(chip => chip.classList.remove('drop-before', 'drop-after'));

  container.querySelectorAll('.filter-chip[data-filter-edit]').forEach(chip => {
    chip.setAttribute('draggable', 'true');
    chip.setAttribute('role', 'listitem');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-grabbed', 'false');
    chip.setAttribute('aria-label', `Filter ${chip.dataset.filterEdit}. Drag to reorder or move to another group`);
    chip.addEventListener('dragstart', event => {
      if (event.target.closest('button, input, select')) {
        event.preventDefault();
        return;
      }
      State.draggedFilterId = chip.dataset.filterEdit;
      chip.classList.add('dragging');
      chip.setAttribute('aria-grabbed', 'true');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', chip.dataset.filterEdit);
    });
    chip.addEventListener('dragover', event => {
      const draggedId = filterDropData(event);
      if (!draggedId || draggedId === chip.dataset.filterEdit) return;
      event.preventDefault();
      event.stopPropagation();
      clearChipIndicators();
      const rect = chip.getBoundingClientRect();
      chip.classList.add(event.clientX < rect.left + rect.width / 2 ? 'drop-before' : 'drop-after');
      event.dataTransfer.dropEffect = 'move';
    });
    chip.addEventListener('dragleave', event => {
      if (!chip.contains(event.relatedTarget)) chip.classList.remove('drop-before', 'drop-after');
    });
    chip.addEventListener('drop', event => {
      const draggedId = filterDropData(event);
      if (!draggedId || draggedId === chip.dataset.filterEdit) return;
      event.preventDefault();
      event.stopPropagation();
      const placeAfter = chip.classList.contains('drop-after');
      const targetParent = findFilterParent(chip.dataset.filterEdit);
      clearFilterDragState();
      if (targetParent) moveFilterByDrop(draggedId, targetParent.id, chip.dataset.filterEdit, placeAfter);
    });
    chip.addEventListener('dragend', clearFilterDragState);
  });

  const dropTargets = [
    ...container.querySelectorAll('.filter-expression-root[data-drop-group-id], .filter-group[data-drop-group-id]'),
  ];
  dropTargets.forEach(target => {
    target.setAttribute('role', 'list');
    target.setAttribute('aria-dropeffect', 'move');
    target.addEventListener('dragover', event => {
      const draggedId = filterDropData(event);
      if (!draggedId || event.target.closest('.filter-chip')) return;
      event.preventDefault();
      event.stopPropagation();
      target.classList.add('drag-over');
      event.dataTransfer.dropEffect = 'move';
    });
    target.addEventListener('dragleave', event => {
      if (!target.contains(event.relatedTarget)) target.classList.remove('drag-over');
    });
    target.addEventListener('drop', event => {
      const draggedId = filterDropData(event);
      if (!draggedId || event.target.closest('.filter-chip, button, select, input')) return;
      event.preventDefault();
      event.stopPropagation();
      const targetGroupId = target.dataset.dropGroupId;
      clearFilterDragState();
      moveFilterByDrop(draggedId, targetGroupId);
    });
  });
}

function syncLegacyFilters() {
  const root = ensureFilterExpression();
  State.filters = (root.children || []).filter(child => child.type === 'filter').map(({ type, id, ...filter }) => filter);
  State.logic = root.logic === 'OR' ? 'OR' : 'AND';
}

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
    const saved = restoreUiState();
    const availableIds = new Set(State.databases.filter(db => db.active).map(db => db.id));
    State.activeDbs = new Set([...State.activeDbs].filter(id => availableIds.has(id)));
    renderAnalysisTabs();
    renderQueryTabs();
    renderDbSidebar();
    renderDbCards();
    renderFilterChips();
    await populateTableSelect();
    if (saved) {
      document.getElementById('logic-and').classList.toggle('active', State.logic === 'AND');
      document.getElementById('logic-or').classList.toggle('active', State.logic === 'OR');
      document.getElementById('sort-asc').classList.toggle('active', State.sortDir === 'ASC');
      document.getElementById('sort-desc').classList.toggle('active', State.sortDir === 'DESC');
      document.getElementById('sort-field-select').value = saved.sortField || '';
      document.getElementById('date-field-select').value = saved.dateField || '';
      document.getElementById('date-from').value = saved.dateFrom || '';
      document.getElementById('date-to').value = saved.dateTo || '';
      persistUiState();
      if (saved.hasSearch && State.currentTable && State.activeDbs.size) await runSearch(0);
    }
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
    <div class="db-source-row flex items-center gap-1 p-1 rounded hover:bg-surface-container-highest group transition-colors">
      <label class="flex items-center gap-3 p-1 flex-1 min-w-0 cursor-pointer">
        <input type="checkbox" class="sr-only peer db-checkbox" value="${db.id}" ${State.activeDbs.has(db.id) ? 'checked' : ''}/>
        <div class="w-4 h-4 rounded-sm border border-outline-variant bg-surface-container-lowest peer-checked:bg-primary-fixed-dim peer-checked:border-primary-fixed-dim flex items-center justify-center transition-all shrink-0">
          <span class="material-symbols-outlined text-on-primary-fixed text-[12px] ${State.activeDbs.has(db.id) ? '' : 'hidden'}" style="font-weight:bold;">check</span>
        </div>
        <div class="flex-1 overflow-hidden">
          <div class="font-mono text-[12px] text-on-surface truncate group-hover:text-primary-fixed transition-colors">${db.alias}</div>
          <div class="text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-wider">SQLite${!db.active ? ' • Inactive' : ''}</div>
        </div>
      </label>
      <button class="db-remove-btn ghost-btn p-1 shrink-0" data-db-id="${db.id}" title="Remove database" aria-label="Remove ${db.alias}">
        <span class="material-symbols-outlined" style="font-size:16px">delete</span>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.db-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = parseInt(cb.value);
      if (cb.checked) State.activeDbs.add(id); else State.activeDbs.delete(id);
      persistUiState();
      // Update checkmark visibility
      const checkmark = cb.parentElement.querySelector('.material-symbols-outlined');
      if (checkmark) checkmark.classList.toggle('hidden', !cb.checked);
      // Reload table selector
      populateTableSelect();
    });
  });

  list.querySelectorAll('.db-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeDatabase(parseInt(btn.dataset.dbId, 10)));
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
        <button class="flex-1 text-center py-1 text-error hover:text-error label-caps transition-colors" onclick="removeDatabase(${db.id})">Remove</button>
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

async function removeDatabase(dbId) {
  const db = State.databases.find(item => item.id === dbId);
  if (!db) return;
  if (!window.confirm(`Remove database “${db.alias}” from Magnetar Finder?`)) return;

  try {
    await API.delete(`/api/databases/${dbId}`);
    State.activeDbs.delete(dbId);
    await loadDatabases();
    toast('Database removed', 'success');
  } catch (e) {
    toast(e.message || 'Could not remove database', 'error');
  }
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

['btn-connect-db-sidebar', 'btn-add-database', 'btn-connect-db-main'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    document.getElementById('conn-alias').value = '';
    document.getElementById('conn-files').value = '';
    document.getElementById('conn-file-list').innerHTML = '';
    document.getElementById('conn-error').classList.add('hidden');
    openModal('modal-connect-db');
  });
});

document.getElementById('conn-files')?.addEventListener('change', function() {
  const list = document.getElementById('conn-file-list');
  list.innerHTML = [...this.files].map(file => `<div>• ${file.name}</div>`).join('');
});

document.getElementById('btn-new-analysis')?.addEventListener('click', () => createNewAnalysis());

document.getElementById('btn-conn-submit')?.addEventListener('click', async () => {
  const alias = document.getElementById('conn-alias').value.trim();
  const files = document.getElementById('conn-files').files;
  const errEl = document.getElementById('conn-error');
  errEl.classList.add('hidden');
  if (!files.length) { errEl.textContent = 'Select at least one SQLite file'; errEl.classList.remove('hidden'); return; }
  try {
    const form = new FormData();
    [...files].forEach(file => form.append('files', file));
    form.append('alias', alias);
    const res = await API.upload('/api/databases/upload', form);
    if (res.errors?.length) errEl.textContent = res.errors.map(e => `${e.filename}: ${e.error}`).join('; ');
    if (!res.imported?.length) { errEl.classList.remove('hidden'); return; }
    closeModal('modal-connect-db');
    await loadDatabases();
    res.imported.forEach(db => State.activeDbs.add(db.id));
    persistUiState();
    renderDbSidebar();
    toast(`Connected ${res.imported.length} database(s)`, 'success');
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
    State.currentTable = '';
    sel.innerHTML = '<option value="">— Select a database first —</option>';
    colSels.forEach(s => { s.innerHTML = '<option value="">—</option>'; });
    return;
  }

  // A shared search can only use tables present in every active database.
  const tablesByDb = [];
  for (const dbId of State.activeDbs) {
    try {
      const tables = await API.get(`/api/databases/${dbId}/tables`);
      tablesByDb.push(new Set(tables.map(t => t.name)));
    } catch(e) { tablesByDb.push(new Set()); }
  }
  const allTables = tablesByDb.reduce((shared, tables) =>
    new Set([...shared].filter(name => tables.has(name))), tablesByDb[0] || new Set());

  const tableHint = State.activeDbs.size > 1 ? ' (shared by all active DBs)' : '';
  if (!allTables.size) {
    State.currentTable = '';
    sel.innerHTML = `<option value="">— No common tables across ${State.activeDbs.size} active DBs —</option>`;
    colSels.forEach(s => { s.innerHTML = '<option value="">—</option>'; });
    return;
  }
  sel.innerHTML = `<option value="">— Select Table${tableHint} —</option>` +
    [...allTables].sort().map(t => `<option value="${t}">${t}</option>`).join('');

  if (State.currentTable && allTables.has(State.currentTable)) {
    sel.value = State.currentTable;
    await populateColumnSelects();
  } else {
    State.currentTable = '';
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

document.getElementById('table-select')?.addEventListener('change', async () => {
  await populateColumnSelects();
  persistUiState();
});

document.getElementById('new-filter-op')?.addEventListener('change', function() {
  const v2 = document.getElementById('new-filter-value2');
  v2.classList.toggle('hidden', this.value !== 'between');
  const v1 = document.getElementById('new-filter-value');
  v1.classList.toggle('hidden', this.value === 'is_null' || this.value === 'is_not_null');
  v1.placeholder = ['contains_in', 'not_contains_in'].includes(this.value)
    ? "('der','die','das')"
    : 'Value…';
});

// ── Filters ────────────────────────────────────────────────────────────────────
function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  const root = ensureFilterExpression();
  const renderNode = node => {
    const children = (node.children || []).map((child, index) => {
      const join = child.join || node.logic || 'AND';
      const connector = index ? `<select id="join-${child.id}" class="expression-logic" data-join-id="${child.id}" title="This join is independent"><option value="AND" ${join === 'AND' ? 'selected' : ''}>AND</option><option value="OR" ${join === 'OR' ? 'selected' : ''}>OR</option></select>` : '';
      if (child.type === 'group') return `${connector}<div class="filter-group" data-drop-group-id="${child.id}" aria-label="Filter group ${child.id}"><div class="filter-group-title"><span>( group )</span><select class="expression-logic" data-node-logic="${child.id}"><option ${child.logic === 'AND' ? 'selected' : ''}>AND</option><option ${child.logic === 'OR' ? 'selected' : ''}>OR</option></select><button class="group-remove" data-group-id="${child.id}">remove group</button></div>${renderNode(child)}</div>`;
      const isNeg = child.op.includes('not') || child.op === 'lt' || child.op === 'is_null';
      const opLabel = child.op.replace(/_/g, ' ').toUpperCase();
      const val = child.op === 'between' ? `${child.value} ↔ ${child.value2}` : child.value || '';
      const caseLabel = child.case_sensitive === true ? 'Aa' : 'aa';
      return `${connector}<div class="filter-chip ${State.editingFilterId === child.id ? 'editing' : ''}" data-filter-edit="${child.id}" title="Double-click to edit this filter"><input type="checkbox" class="filter-select-checkbox" data-filter-select="${child.id}" ${State.selectedFilterIds.has(child.id) ? 'checked' : ''} title="Select filter for bulk editing"/><span class="chip-op ${isNeg ? 'negative' : ''}">${opLabel}</span><span class="filter-case-indicator" title="${child.case_sensitive === true ? 'Case sensitive' : 'Case insensitive'}">${caseLabel}</span><span class="font-mono text-[10px] text-on-surface-variant">${child.field}</span>${val ? `<span class="chip-value">"${val}"</span>` : ''}<button class="chip-remove" data-node-id="${child.id}"><span class="material-symbols-outlined" style="font-size:13px">close</span></button></div>`;
    }).join('');
    return children || '<span class="text-on-surface-variant text-[11px]">No conditions yet</span>';
  };
  container.innerHTML = `<div class="filter-expression-root" data-drop-group-id="root" role="list" aria-label="Root filter group">${renderNode(root)}</div>`;
  renderExpressionPreview(root);
  const groupSelect = document.getElementById('filter-target-group');
  if (groupSelect) groupSelect.innerHTML = expressionGroups().map(group => `<option value="${group.id}" ${State.filterTargetGroup === group.id ? 'selected' : ''}>${group.id === 'root' ? 'Root group' : 'Nested group'} (${group.logic})</option>`).join('');

  container.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      State.selectedFilterIds.delete(btn.dataset.nodeId);
      const removeFrom = (node) => { node.children = (node.children || []).filter(child => child.id !== btn.dataset.nodeId); node.children.forEach(child => child.type === 'group' && removeFrom(child)); };
      removeFrom(ensureFilterExpression()); syncLegacyFilters();
      renderFilterChips();
      persistUiState();
    });
  });
  container.querySelectorAll('.filter-select-checkbox').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) State.selectedFilterIds.add(input.dataset.filterSelect);
      else State.selectedFilterIds.delete(input.dataset.filterSelect);
      renderBulkFilterEditor();
      persistUiState();
    });
    input.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      beginFilterEdit(input.dataset.filterSelect);
    });
  });
  container.querySelectorAll('[data-filter-edit]').forEach(chip => {
    chip.addEventListener('dblclick', event => {
      if (event.target.closest('button, input')) return;
      beginFilterEdit(chip.dataset.filterEdit);
    });
  });
  renderBulkFilterEditor();
  container.querySelectorAll('.expression-logic').forEach(select => select.addEventListener('change', () => {
    if (select.dataset.joinId) {
      const filterOrGroup = findFilterById(select.dataset.joinId) || findExpressionNode(select.dataset.joinId);
      if (filterOrGroup) filterOrGroup.join = select.value === 'OR' ? 'OR' : 'AND';
    } else {
      const group = findExpressionNode(select.dataset.nodeLogic);
      if (group) group.logic = select.value === 'OR' ? 'OR' : 'AND';
    }
    syncLegacyFilters(); persistUiState(); renderFilterChips();
  }));
  container.querySelectorAll('.group-remove').forEach(btn => btn.addEventListener('click', () => {
    const removeGroup = node => { node.children = (node.children || []).filter(child => child.id !== btn.dataset.groupId); node.children.forEach(child => child.type === 'group' && removeGroup(child)); };
    removeGroup(ensureFilterExpression()); State.filterTargetGroup = 'root'; syncLegacyFilters(); renderFilterChips(); persistUiState();
  }));
  bindFilterDragAndDrop(container);
}

function findFilterById(id) {
  return findFilterNodes().find(filter => filter.id === id) || null;
}

function beginFilterEdit(id) {
  const filter = findFilterById(id);
  if (!filter) return;
  State.editingFilterId = id;
  const field = document.getElementById('new-filter-field');
  const op = document.getElementById('new-filter-op');
  field.value = filter.field || '';
  field.dispatchEvent(new Event('change', { bubbles: true }));
  op.value = filter.op || 'contains';
  op.dispatchEvent(new Event('change', { bubbles: true }));
  document.getElementById('new-filter-case').value = filter.case_sensitive === true ? 'sensitive' : 'insensitive';
  document.getElementById('new-filter-value').value = filter.value || '';
  document.getElementById('new-filter-value2').value = filter.value2 || '';
  document.getElementById('btn-add-filter').textContent = 'UPDATE FILTER';
  document.getElementById('btn-cancel-filter-edit').classList.remove('hidden');
  document.getElementById('new-filter-value').focus();
  document.getElementById('new-filter-value').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelFilterEdit() {
  State.editingFilterId = null;
  document.getElementById('btn-add-filter').textContent = '+ Add Filter';
  document.getElementById('btn-cancel-filter-edit').classList.add('hidden');
  document.getElementById('new-filter-value').value = '';
  document.getElementById('new-filter-value2').value = '';
  renderFilterChips();
}

function findFilterNodes(node = ensureFilterExpression(), result = []) {
  (node.children || []).forEach(child => {
    if (child.type === 'filter') result.push(child);
    else if (child.type === 'group') findFilterNodes(child, result);
  });
  return result;
}

function renderBulkFilterEditor() {
  const editor = document.getElementById('filter-bulk-editor');
  const count = document.getElementById('filter-selected-count');
  if (!editor || !count) return;
  const available = new Set(findFilterNodes().map(filter => filter.id));
  State.selectedFilterIds = new Set([...State.selectedFilterIds].filter(id => available.has(id)));
  const selected = State.selectedFilterIds.size;
  count.textContent = `${selected} SELECTED`;
  editor.classList.toggle('hidden', selected === 0);
  const target = document.getElementById('bulk-move-target');
  if (target) {
    const currentTarget = target.value || 'root';
    target.innerHTML = expressionGroups().map(group => `<option value="${group.id}">${group.id === 'root' ? 'Root group' : 'Nested group'} (${group.logic})</option>`).join('');
    target.value = [...target.options].some(option => option.value === currentTarget) ? currentTarget : 'root';
  }
}

document.getElementById('btn-apply-bulk-filter')?.addEventListener('click', () => {
  const value = document.getElementById('bulk-filter-value').value;
  const operator = document.getElementById('bulk-filter-op').value;
  const caseMode = document.getElementById('bulk-filter-case').value;
  if (!State.selectedFilterIds.size) { toast('Select at least one filter', 'info'); return; }
  if (!value.trim() && !operator && !caseMode) { toast('Choose a change to apply', 'error'); return; }
  findFilterNodes().filter(filter => State.selectedFilterIds.has(filter.id)).forEach(filter => {
    if (value.trim()) filter.value = value;
    if (operator) filter.op = operator;
    if (caseMode) filter.case_sensitive = caseMode === 'sensitive';
  });
  renderFilterChips();
  persistUiState();
  toast(`Updated ${State.selectedFilterIds.size} filters`, 'success');
});

document.getElementById('btn-clear-filter-selection')?.addEventListener('click', () => {
  State.selectedFilterIds.clear();
  renderFilterChips();
  persistUiState();
});

document.getElementById('btn-apply-case-all')?.addEventListener('click', () => {
  const mode = document.getElementById('global-case-mode').value;
  if (!mode) { toast('Choose a case mode first', 'info'); return; }
  const filters = findFilterNodes();
  if (!filters.length) { toast('Add filters first', 'info'); return; }
  filters.forEach(filter => { filter.case_sensitive = mode === 'sensitive'; });
  renderFilterChips(); persistUiState();
  toast(`Applied case mode to ${filters.length} filters`, 'success');
});

document.getElementById('btn-move-selected-filters')?.addEventListener('click', () => {
  const root = ensureFilterExpression();
  const selected = findFilterNodes().filter(filter => State.selectedFilterIds.has(filter.id));
  const targetId = document.getElementById('bulk-move-target').value || 'root';
  const target = findExpressionNode(targetId);
  if (!selected.length || !target) { toast('Select filters and a destination group', 'info'); return; }
  const selectedIds = new Set(selected.map(filter => filter.id));
  const removeSelected = node => {
    node.children = (node.children || []).filter(child => !selectedIds.has(child.id));
    node.children.filter(child => child.type === 'group').forEach(removeSelected);
  };
  removeSelected(root);
  selected.forEach((filter, index) => {
    filter.join = target.children.length || index ? (target.logic || 'AND') : null;
    target.children.push(filter);
  });
  State.filterTargetGroup = target.id;
  renderFilterChips();
  persistUiState();
  toast(`Moved ${selected.length} filters`, 'success');
});

function expressionPreview(node) {
  const parts = (node.children || []).map(child => {
    if (child.type === 'group') return expressionPreview(child);
    const value = child.op === 'between' ? `${child.value}..${child.value2}` : child.value;
    const suffix = ['is_null', 'is_not_null'].includes(child.op) ? '' : ` "${value || ''}"`;
    return `${child.field} ${child.op.replace(/_/g, ' ')}${suffix}`;
  }).filter(Boolean);
  const expression = parts.map((part, index) => {
    if (!index) return part;
    const join = node.children[index]?.join || node.logic || 'AND';
    return `${join} ${part}`;
  }).join(' ');
  return parts.length ? `( ${expression} )` : '( empty )';
}

function renderExpressionPreview(root = ensureFilterExpression()) {
  const preview = document.getElementById('filter-expression-preview');
  if (!preview) return;
  const hasOrNot = node => (node.children || []).some((child, index) => {
    const join = (child.join || node.logic || 'AND').toUpperCase();
    if (index > 0 && join === 'OR' && child.type === 'filter' && child.op.startsWith('not_')) return true;
    return child.type === 'group' && hasOrNot(child);
  });
  const warning = hasOrNot(root)
    ? ' Warning: OR + NOT matches every row that does not meet that condition.'
    : '';
  preview.textContent = `Expression: ${expressionPreview(root)}${warning}`;
  preview.classList.toggle('hidden', !(root.children || []).length);
}

function renderQueryDebug() {
  const meta = document.getElementById('query-debug-meta');
  const code = document.getElementById('query-debug-sql');
  if (!meta || !code) return;
  if (!State.debugQuery) {
    meta.textContent = 'Run a search to inspect the generated query.';
    code.textContent = 'No query executed.';
    return;
  }
  const debug = State.debugQuery;
  meta.textContent = `Table: ${debug.table} · Databases: ${(debug.db_ids || []).join(', ')}`;
  code.textContent = [
    'DATA QUERY', debug.sql,
    `PARAMETERS: ${JSON.stringify(debug.params)}`,
    '', 'COUNT QUERY', debug.count_sql,
    `PARAMETERS: ${JSON.stringify(debug.count_params)}`,
  ].join('\n');
}

function analysisFields(rows) {
  return [...new Set(rows.flatMap(row => Object.keys(row).filter(key => !key.startsWith('__'))))];
}

function analysisSourceEntries(row) {
  const sources = Array.isArray(row.__sources__) && row.__sources__.length
    ? row.__sources__
    : (row.__db_id__ != null ? [{ id: row.__db_id__ }] : []);
  const seen = new Set();
  return sources.filter(source => {
    const key = String(source.id ?? source.alias ?? source.path ?? 'unknown');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(source => {
    const db = State.databases.find(item => String(item.id) === String(source.id));
    return { key: String(source.id ?? source.alias ?? source.path ?? 'unknown'), label: source.alias || db?.alias || `Database ${source.id ?? 'unknown'}` };
  });
}

function renderAnalysisBars(container, entries, emptyMessage) {
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = `<div class="analysis-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  const max = Math.max(...entries.map(entry => entry.count), 1);
  container.innerHTML = entries.map(entry => {
    const percent = Math.max(2, Math.round((entry.count / max) * 100));
    return `<div class="analysis-bar-row" title="${escapeHtml(entry.label)}: ${entry.count.toLocaleString()}">
      <span class="analysis-bar-label">${escapeHtml(entry.label)}</span>
      <span class="analysis-bar-track"><span class="analysis-bar-fill" style="width:${percent}%"></span></span>
      <span class="analysis-bar-count">${entry.count.toLocaleString()}</span>
    </div>`;
  }).join('');
}

function renderMatchAnalysis() {
  // Never fall back to searchResults here: that array is deliberately only
  // the current grid page. The analysis dataset is fetched independently.
  const rows = State.analysisResults || [];
  const fieldSelect = document.getElementById('analysis-field-select');
  const summary = document.getElementById('analysis-summary');
  const frequency = document.getElementById('analysis-frequency-chart');
  const sources = document.getElementById('analysis-source-chart');
  const loading = document.getElementById('match-analysis-loading');
  if (!fieldSelect || !summary || !frequency || !sources) return;

  loading?.classList.toggle('hidden', !State.analysisLoading);
  if (State.analysisLoading) {
    summary.innerHTML = '';
    frequency.innerHTML = '';
    sources.innerHTML = '';
    return;
  }

  // Analysis rows are deliberately transient. While a saved query is waiting
  // for its full analysis dataset to arrive, do not overwrite the field the
  // user selected previously with the empty-state fallback.
  if (!rows.length) {
    const savedField = State.analysisField;
    fieldSelect.innerHTML = savedField
      ? `<option value="${escapeHtml(savedField)}">${escapeHtml(savedField)}</option>`
      : '<option value="">Select a field…</option>';
    fieldSelect.value = savedField || '';
    summary.innerHTML = '';
    renderAnalysisBars(frequency, [], 'Run the query to analyse its matches.');
    renderAnalysisBars(sources, [], 'Run the query to analyse its matches.');
    return;
  }

  const fields = analysisFields(rows);
  const selectedField = fields.includes(State.analysisField) ? State.analysisField : (fields[0] || '');
  State.analysisField = selectedField;
  fieldSelect.innerHTML = '<option value="">Select a field…</option>' +
    fields.map(field => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join('');
  fieldSelect.value = selectedField;

  const valueCounts = new Map();
  if (selectedField) rows.forEach(row => {
    const value = row[selectedField] == null || row[selectedField] === '' ? '<null>' : String(row[selectedField]);
    valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
  });
  const frequencyEntries = [...valueCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 12);
  const sourceCounts = new Map();
  rows.forEach(row => analysisSourceEntries(row).forEach(source => {
    const existing = sourceCounts.get(source.key) || { label: source.label, count: 0 };
    existing.count += 1;
    sourceCounts.set(source.key, existing);
  }));
  const sourceEntries = [...sourceCounts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const uniqueSourceCount = sourceCounts.size;
  summary.innerHTML = [
    ['ROWS IN VIEW', rows.length.toLocaleString()],
    [selectedField ? `UNIQUE ${selectedField}` : 'UNIQUE VALUES', valueCounts.size.toLocaleString()],
    ['DATABASE SOURCES', uniqueSourceCount.toLocaleString()],
  ].map(([label, value]) => `<div class="analysis-summary-card"><div class="analysis-summary-label">${escapeHtml(label)}</div><div class="analysis-summary-value">${escapeHtml(value)}</div></div>`).join('');
  document.getElementById('analysis-frequency-meta').textContent = selectedField
    ? `${valueCounts.size.toLocaleString()} unique · top ${frequencyEntries.length}` : 'Choose a field';
  document.getElementById('analysis-source-meta').textContent = uniqueSourceCount
    ? `${uniqueSourceCount.toLocaleString()} source${uniqueSourceCount === 1 ? '' : 's'}` : 'No source metadata';
  renderAnalysisBars(frequency, frequencyEntries, rows.length ? 'Select a field to count values.' : 'Run the query to analyse its matches.');
  renderAnalysisBars(sources, sourceEntries, rows.length ? 'No database source metadata is available.' : 'Run the query to analyse its matches.');
}

function renderResultSubview() {
  const analysis = State.resultSubview === 'analysis';
  document.querySelectorAll('[data-result-subview]').forEach(button => {
    const active = button.dataset.resultSubview === State.resultSubview;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.getElementById('results-view')?.classList.toggle('hidden', analysis);
  document.getElementById('match-analysis-view')?.classList.toggle('hidden', !analysis);
  if (analysis) renderMatchAnalysis();
}

document.querySelectorAll('[data-result-subview]').forEach(button => button.addEventListener('click', () => {
  State.resultSubview = button.dataset.resultSubview === 'analysis' ? 'analysis' : 'results';
  renderResultSubview();
  persistUiState();
}));

document.getElementById('analysis-field-select')?.addEventListener('change', event => {
  State.analysisField = event.target.value;
  renderMatchAnalysis();
  persistUiState();
});

document.getElementById('btn-add-filter')?.addEventListener('click', () => {
  const field = document.getElementById('new-filter-field').value;
  const op = document.getElementById('new-filter-op').value;
  const value = document.getElementById('new-filter-value').value;
  const value2 = document.getElementById('new-filter-value2').value;
  const caseSensitive = document.getElementById('new-filter-case').value === 'sensitive';
  if (!field) { toast('Select a field first', 'error'); return; }
  const editing = State.editingFilterId ? findFilterById(State.editingFilterId) : null;
  if (editing) {
    editing.field = field; editing.op = op; editing.value = value; editing.value2 = value2; editing.case_sensitive = caseSensitive;
    State.editingFilterId = null;
    document.getElementById('btn-add-filter').textContent = '+ Add Filter';
    document.getElementById('btn-cancel-filter-edit').classList.add('hidden');
  } else {
    const target = findExpressionNode(document.getElementById('filter-target-group')?.value || 'root');
    const targetChildren = target?.children || [];
    const filter = { type: 'filter', id: `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`, field, op, value, value2, case_sensitive: caseSensitive, join: targetChildren.length ? (target.logic || 'AND') : null };
    (target || ensureFilterExpression()).children.push(filter);
  }
  syncLegacyFilters();
  renderFilterChips();
  persistUiState();
  document.getElementById('new-filter-value').value = '';
  document.getElementById('new-filter-value2').value = '';
});

document.getElementById('btn-cancel-filter-edit')?.addEventListener('click', cancelFilterEdit);

document.getElementById('filter-target-group')?.addEventListener('change', e => { State.filterTargetGroup = e.target.value; persistUiState(); });
document.getElementById('btn-add-filter-group')?.addEventListener('click', () => {
  const parent = findExpressionNode(document.getElementById('filter-target-group')?.value || 'root') || ensureFilterExpression();
  const group = { type: 'group', id: `group-${Date.now()}`, logic: 'AND', join: parent.children.length ? (parent.logic || 'AND') : null, children: [] };
  parent.children.push(group); State.filterTargetGroup = group.id; renderFilterChips(); persistUiState();
});

document.getElementById('btn-wrap-filters')?.addEventListener('click', () => {
  const root = ensureFilterExpression();
  const looseFilters = (root.children || []).filter(child => child.type === 'filter');
  if (!looseFilters.length) { toast('Add ungrouped filters before grouping them', 'info'); return; }
  const group = {
    type: 'group', id: `group-${Date.now()}`,
    logic: root.logic === 'OR' ? 'OR' : 'AND', join: root.children.length > looseFilters.length ? (root.logic || 'AND') : null, children: looseFilters,
  };
  // Keep existing groups at the root; only wrap the loose conditions.
  root.children = (root.children || []).filter(child => child.type !== 'filter');
  root.children.push(group);
  root.logic = 'AND';
  State.logic = 'AND';
  State.filterTargetGroup = group.id;
  renderFilterChips();
  persistUiState();
  toast('Current filters wrapped in parentheses', 'success');
});

document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
  State.filters = []; State.expression = { type: 'group', id: 'root', logic: State.logic, children: [] }; State.filterTargetGroup = 'root';
  renderFilterChips();
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  persistUiState();
});

// Logic toggle
['logic-and', 'logic-or'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    State.logic = id === 'logic-and' ? 'AND' : 'OR';
    ensureFilterExpression().logic = State.logic;
    document.getElementById('logic-and').classList.toggle('active', State.logic === 'AND');
    document.getElementById('logic-or').classList.toggle('active', State.logic === 'OR');
    persistUiState();
  });
});

// Sort toggle
['sort-asc', 'sort-desc'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => {
    State.sortDir = id === 'sort-asc' ? 'ASC' : 'DESC';
    document.getElementById('sort-asc').classList.toggle('active', State.sortDir === 'ASC');
    document.getElementById('sort-desc').classList.toggle('active', State.sortDir === 'DESC');
    persistUiState();
  });
});

['date-from', 'date-to'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', persistUiState);
});
document.getElementById('date-field-select')?.addEventListener('change', persistUiState);
document.getElementById('sort-field-select')?.addEventListener('change', persistUiState);

// ── Search ─────────────────────────────────────────────────────────────────────
function setSearchLoading(loading) {
  const button = document.getElementById('btn-search');
  const icon = button?.querySelector('.material-symbols-outlined');
  if (button) button.disabled = loading;
  if (icon) {
    icon.classList.toggle('loading-spinner', loading);
    icon.textContent = loading ? '' : 'search';
  }
  if (loading) document.getElementById('status-count').innerHTML = '<span class="flex items-center gap-2"><span class="loading-spinner"></span> Loading all results…</span>';
}

async function runSearch(offset = 0) {
  const table = document.getElementById('table-select').value;
  if (!table) { toast('Select a table first', 'error'); return; }
  if (!State.activeDbs.size) { toast('Activate at least one database', 'error'); return; }

  const sortField = document.getElementById('sort-field-select').value;
  const dateField = document.getElementById('date-field-select').value;
  const dateFrom = document.getElementById('date-from').value;
  const dateTo = document.getElementById('date-to').value;
  const queryId = State.activeQueryId;
  const requestId = ++State.searchRequestId;
  // The expression is a mutable UI tree. Freeze the exact tree shown to the
  // user before the request starts so another tab can never alter this query.
  const expression = JSON.parse(JSON.stringify(ensureFilterExpression()));
  const filters = JSON.parse(JSON.stringify(State.filters));

  setSearchLoading(true);

  try {
    const res = await API.post('/api/search/', {
      db_ids: [...State.activeDbs],
      table,
      filters,
      expression,
      logic: State.logic,
      sort_field: sortField || null,
      sort_dir: State.sortDir,
      limit: State.searchLimit,
      offset,
      date_field: dateField || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    });
    // Give the browser one frame to paint the loading state before a large
    // result set is inserted into the grid.
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Ignore a response if the user has changed query while it was in flight.
    // Applying it would make one tab display another tab's result set.
    if (requestId !== State.searchRequestId || State.activeQueryId !== queryId) return;

    // Keep the grid lightweight and paginated. MATCH ANALYSIS loads its own
    // complete dataset after this response, so changing pages remains cheap.
    State.searchResults = res.rows || [];
    const shouldRefreshAnalysis = offset === 0;
    if (shouldRefreshAnalysis) {
      State.analysisResults = [];
      State.analysisLoading = false;
    }
    State.searchOffset = offset;
    State.searchTotal = res.total || 0;
    State.queryMs = res.query_ms || 0;
    State.debugQuery = res.debug || null;
    State.hasExecutedSearch = true;
    persistUiState();
    State.resultChain = [{ label: 'Query result', rows: [...State.searchResults] }];
    State.resultChainIndex = 0;
    const pendingSublistSteps = State.pendingSublistSteps;
    State.pendingSublistSteps = [];
    State.sublistSteps = [];
    setupColumnPreferences(State.searchResults, table);

    renderResultsTable();
    renderColumnControls();
    renderSublistControls();
    renderQueryDebug();
    pendingSublistSteps.forEach(step => applySublistFilter(step.field, step.op, step.value, true));
    renderResultSubview();
    if (shouldRefreshAnalysis) loadMatchAnalysis({
      db_ids: [...State.activeDbs], table, filters,
      expression, logic: State.logic,
      sort_field: sortField || null, sort_dir: State.sortDir,
      date_field: dateField || null, date_from: dateFrom || null, date_to: dateTo || null,
    }, queryId);
    document.getElementById('status-count').textContent = `${State.searchTotal.toLocaleString()} total — showing ${offset + 1}–${Math.min(offset + State.searchResults.length, State.searchTotal)}`;
    document.getElementById('status-timing').innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim inline-block mr-1"></span> ${State.queryMs}ms`;
    document.getElementById('status-page').textContent = `Page ${Math.floor(offset / State.searchLimit) + 1}`;
    document.getElementById('btn-prev-page').disabled = offset === 0;
    document.getElementById('btn-next-page').disabled = offset + State.searchResults.length >= State.searchTotal;

    if (res.errors?.length) toast(`Some databases failed: ${res.errors.map(e => e.error).join(', ')}`, 'error');
  } catch(e) {
    toast('Search failed: ' + e.message, 'error');
    document.getElementById('status-count').textContent = 'Error';
  } finally {
    setSearchLoading(false);
  }
}

async function loadMatchAnalysis(body, queryId = State.activeQueryId) {
  const requestId = ++State.analysisRequestId;
  State.analysisLoading = true;
  renderMatchAnalysis();
  try {
    const res = await API.post('/api/search/analysis', body);
    if (requestId !== State.analysisRequestId || State.activeQueryId !== queryId) return;
    if (res.error) throw new Error(res.error);
    State.analysisResults = res.analysis_rows || [];
    State.analysisLoading = false;
    if (State.resultSubview === 'analysis') renderMatchAnalysis();
  } catch (error) {
    if (requestId !== State.analysisRequestId || State.activeQueryId !== queryId) return;
    State.analysisResults = [];
    State.analysisLoading = false;
    if (State.resultSubview === 'analysis') renderMatchAnalysis();
    toast('Match analysis failed: ' + error.message, 'error');
  }
}

document.getElementById('btn-search')?.addEventListener('click', () => runSearch(0));
document.getElementById('btn-execute')?.addEventListener('click', () => runSearch(0));
document.getElementById('btn-prev-page')?.addEventListener('click', () => runSearch(Math.max(0, State.searchOffset - State.searchLimit)));
document.getElementById('btn-next-page')?.addEventListener('click', () => runSearch(State.searchOffset + State.searchLimit));

const COLUMN_TRANSFORMATIONS = {
  unix_to_human: 'Unix timestamp → yyyy.MM.dd HH:mm:ss',
  date_to_unix: 'Human date → Unix timestamp',
  url_decode: 'URL decode',
  url_encode: 'URL encode',
};

function currentResultTable() {
  return document.getElementById('table-select')?.value || State.currentTable || '';
}

function currentColumnTransformation(column) {
  const table = currentResultTable();
  const transformation = State.columnTransformations?.[table]?.[column];
  return COLUMN_TRANSFORMATIONS[transformation] ? transformation : '';
}

function rawCellText(value) {
  return value == null ? '<null>' : String(value);
}

function formatHumanDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function unixTimestampToHuman(value) {
  const text = String(value ?? '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  // Unix values are normally seconds; large values are milliseconds.
  const magnitude = Math.abs(number);
  const milliseconds = magnitude >= 100000000000000 ? number / 1000
    : magnitude >= 100000000000 ? number : number * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : formatHumanDate(date);
}

function humanDateToUnix(value) {
  const text = String(value ?? '').trim();
  if (!text || /^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const normalized = text.replace(/\./g, '-');
  const parts = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  let timestamp;
  if (parts) {
    const date = new Date(
      Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]),
      Number(parts[4] || 0), Number(parts[5] || 0), Number(parts[6] || 0),
    );
    if (date.getFullYear() !== Number(parts[1]) || date.getMonth() !== Number(parts[2]) - 1 || date.getDate() !== Number(parts[3])
      || date.getHours() !== Number(parts[4] || 0) || date.getMinutes() !== Number(parts[5] || 0) || date.getSeconds() !== Number(parts[6] || 0)) return null;
    timestamp = date.getTime();
  } else if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) {
    timestamp = Date.parse(text);
  } else {
    return null;
  }
  if (!Number.isFinite(timestamp)) return null;
  return String(Math.floor(timestamp / 1000));
}

function transformCellValue(value, transformation) {
  if (value == null || value === '') return rawCellText(value);
  try {
    if (transformation === 'unix_to_human') return unixTimestampToHuman(value) ?? rawCellText(value);
    if (transformation === 'date_to_unix') return humanDateToUnix(value) ?? rawCellText(value);
    if (transformation === 'url_decode') return decodeURIComponent(String(value));
    if (transformation === 'url_encode') return encodeURI(String(value));
  } catch (error) {
    // Malformed dates/URLs remain visible in their original form.
  }
  return rawCellText(value);
}

function setColumnTransformation(column, transformation) {
  const table = currentResultTable();
  if (!table || !column) return;
  State.columnTransformations[table] ||= {};
  if (transformation && COLUMN_TRANSFORMATIONS[transformation]) {
    State.columnTransformations[table][column] = transformation;
  } else {
    delete State.columnTransformations[table][column];
    if (!Object.keys(State.columnTransformations[table]).length) delete State.columnTransformations[table];
  }
  persistUiState();
  renderResultsTable();
}

function showColumnTransformationMenu(column, event, rawValue) {
  const menu = document.getElementById('cell-transform-menu');
  if (!menu) return;
  document.getElementById('row-sources-menu')?.classList.add('hidden');
  const selected = currentColumnTransformation(column);
  const hasCell = arguments.length >= 3;
  const raw = hasCell ? rawCellText(rawValue) : 'Applies to every displayed cell in this column.';
  menu.innerHTML = `
    <div class="cell-transform-title">AUTO TRANSFORMATION</div>
    <div class="cell-transform-context"><strong>${escapeHtml(column)}</strong><span>${escapeHtml(raw)}</span></div>
    <div class="cell-transform-options" role="menu">
      ${Object.entries(COLUMN_TRANSFORMATIONS).map(([id, label]) => `
        <button type="button" class="cell-transform-option ${selected === id ? 'active' : ''}" data-transform="${id}" role="menuitem">
          ${escapeHtml(label)}${selected === id ? ' ✓' : ''}
        </button>`).join('')}
      <button type="button" class="cell-transform-option clear" data-transform="" role="menuitem">Clear transformation</button>
    </div>
    <div class="cell-transform-note">Raw value stays unchanged and is available in the cell title.</div>`;
  menu.classList.remove('hidden');
  const x = event?.clientX || 24;
  const y = event?.clientY || 24;
  menu.style.left = `${Math.min(window.innerWidth - 370, Math.max(8, x))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 260, Math.max(8, y))}px`;
  menu.querySelectorAll('[data-transform]').forEach(button => button.addEventListener('click', clickEvent => {
    clickEvent.stopPropagation();
    setColumnTransformation(column, button.dataset.transform);
    menu.classList.add('hidden');
  }));
}

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

  const allCols = Object.keys(State.searchResults[0]).filter(k => !k.startsWith('__'));
  const cols = (State.columnOrder.length ? State.columnOrder : allCols)
    .filter(column => allCols.includes(column) && State.visibleColumns.includes(column));
  if (!cols.length) return;

  const widths = getColumnWidths(cols);
  const gridTemplate = `20px ${cols.map(column => `${widths[column]}px`).join(' ')} 120px`;

  header.classList.remove('hidden');
  header.innerHTML = `<div class="results-grid grid gap-3" style="grid-template-columns: ${gridTemplate}">
    <div></div>
    ${cols.map(c => `<div draggable="true" class="result-column-header relative truncate cursor-grab active:cursor-grabbing hover:text-primary-fixed transition-colors" data-column-index="${State.columnOrder.indexOf(c)}" data-column="${escapeHtml(c)}" title="Right-click for column transformation; drag to reorder: ${escapeHtml(c)}">${escapeHtml(c)}<span class="column-resize-handle" data-column="${escapeHtml(c)}" title="Resize ${escapeHtml(c)}" aria-label="Resize ${escapeHtml(c)}"></span></div>`).join('')}
    <div class="text-right">ACTIONS</div>
  </div>`;

  let draggedHeaderIndex = null;
  header.querySelectorAll('.result-column-header').forEach(cell => {
    cell.addEventListener('dragstart', event => {
      draggedHeaderIndex = parseInt(cell.dataset.columnIndex, 10);
      cell.classList.add('opacity-50');
      event.dataTransfer.effectAllowed = 'move';
    });
    cell.addEventListener('dragover', event => {
      event.preventDefault();
      cell.classList.add('text-primary-fixed');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('text-primary-fixed'));
    cell.addEventListener('drop', event => {
      event.preventDefault();
      const targetIndex = parseInt(cell.dataset.columnIndex, 10);
      if (draggedHeaderIndex === null || draggedHeaderIndex === targetIndex) return;
      const [moved] = State.columnOrder.splice(draggedHeaderIndex, 1);
      State.columnOrder.splice(targetIndex, 0, moved);
      saveColumnPreferences();
      renderResultsTable();
      renderColumnControls();
    });
    cell.addEventListener('dragend', () => {
      draggedHeaderIndex = null;
      cell.classList.remove('opacity-50', 'text-primary-fixed');
    });
    cell.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      showColumnTransformationMenu(cell.dataset.column, event);
    });
  });

  setupColumnResizers(header, cols);

  body.innerHTML = State.searchResults.map((row, i) => {
    const dbId = row.__db_id__;
    const cells = cols.map(c => {
      const val = row[c];
      const raw = rawCellText(val);
      const display = transformCellValue(val, currentColumnTransformation(c));
      return `<div class="result-cell truncate font-mono text-[11px] text-on-surface-variant" data-column="${escapeHtml(c)}" title="Raw value: ${escapeHtml(raw)}">${escapeHtml(display)}</div>`;
    }).join('');
    return `
      <div class="result-row results-grid grid gap-3 px-5 py-2 border-b border-outline-variant/20 items-center"
           style="grid-template-columns: ${gridTemplate}"
           data-idx="${i}">
        <div class="status-dot-live shrink-0"></div>
        ${cells}
        <div class="row-actions flex items-center justify-end gap-1">
          ${row.__sources__?.length > 1 ? `<button class="btn-sources ghost-btn py-0.5 px-2 text-[10px]" data-idx="${i}" title="View source databases"><span class="material-symbols-outlined" style="font-size:13px">account_tree</span></button>` : ''}
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
  body.querySelectorAll('.btn-sources').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); showRowSources(parseInt(btn.dataset.idx, 10), e); });
  });
  body.querySelectorAll('.result-row').forEach(rowEl => {
    rowEl.addEventListener('contextmenu', event => {
      event.preventDefault();
      showRowSources(parseInt(rowEl.dataset.idx, 10), event);
    });
  });
  body.querySelectorAll('.result-cell').forEach(cell => {
    cell.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      const row = State.searchResults[parseInt(cell.closest('.result-row')?.dataset.idx, 10)];
      showColumnTransformationMenu(cell.dataset.column, event, row?.[cell.dataset.column]);
    });
  });
}

function showRowSources(index, event) {
  const row = State.searchResults[index];
  const menu = document.getElementById('row-sources-menu');
  if (!row || !menu) return;
  document.getElementById('cell-transform-menu')?.classList.add('hidden');
  const sources = Array.isArray(row.__sources__) ? row.__sources__ : [];
  menu.innerHTML = `<div class="font-bold text-primary-fixed mb-2">SOURCE DATABASES (${sources.length})</div>` +
    (sources.length ? sources.map(source => `<div class="row-source-item"><strong>${escapeHtml(source.alias || `Database ${source.id}`)}</strong><span>ID: ${escapeHtml(String(source.id))}</span><span title="${escapeHtml(source.path || '')}">${escapeHtml(source.path || 'Path unavailable')}</span></div>`).join('') : '<div>Source metadata unavailable.</div>');
  menu.classList.remove('hidden');
  const x = event?.clientX || 24;
  const y = event?.clientY || 24;
  menu.style.left = `${Math.min(window.innerWidth - 360, Math.max(8, x))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 180, Math.max(8, y))}px`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

document.addEventListener('click', () => {
  document.getElementById('row-sources-menu')?.classList.add('hidden');
  document.getElementById('cell-transform-menu')?.classList.add('hidden');
});

function getColumnWidths(cols) {
  const table = document.getElementById('table-select')?.value || State.currentTable;
  const saved = State.columnPrefs[table]?.widths || {};
  return Object.fromEntries(cols.map(column => [column, Math.max(80, Number(saved[column]) || 160)]));
}

function applyColumnWidths(cols) {
  const widths = getColumnWidths(cols);
  const gridTemplate = `20px ${cols.map(column => `${widths[column]}px`).join(' ')} 120px`;
  document.querySelectorAll('#results-header .results-grid, #results-body .results-grid')
    .forEach(grid => { grid.style.gridTemplateColumns = gridTemplate; });
}

function setupColumnResizers(header, cols) {
  header.querySelectorAll('.column-resize-handle').forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const column = handle.dataset.column;
      const startX = event.clientX;
      const startWidth = getColumnWidths(cols)[column];
      handle.setPointerCapture?.(event.pointerId);
      handle.classList.add('active');

      const move = moveEvent => {
        const nextWidth = Math.max(80, Math.round(startWidth + moveEvent.clientX - startX));
        const table = document.getElementById('table-select')?.value || State.currentTable;
        State.columnPrefs[table] ||= {};
        State.columnPrefs[table].widths ||= {};
        State.columnPrefs[table].widths[column] = nextWidth;
        applyColumnWidths(cols);
      };
      const finish = () => {
        handle.classList.remove('active');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', finish);
        saveColumnPreferences();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', finish, { once: true });
    });
  });
}

function setupColumnPreferences(rows, table) {
  const allCols = rows.length ? Object.keys(rows[0]).filter(k => !k.startsWith('__')) : [];
  const saved = State.columnPrefs[table] || {};
  State.columnOrder = [
    ...(Array.isArray(saved.order) ? saved.order : []),
    ...allCols,
  ].filter((column, index, columns) => allCols.includes(column) && columns.indexOf(column) === index);
  State.visibleColumns = (Array.isArray(saved.visible) ? saved.visible : allCols)
    .filter(column => allCols.includes(column));
  if (!State.visibleColumns.length && allCols.length) State.visibleColumns = [...allCols];
}

function saveColumnPreferences() {
  const table = document.getElementById('table-select').value;
  if (!table) return;
  State.columnPrefs[table] = {
    order: [...State.columnOrder],
    visible: [...State.visibleColumns],
    widths: { ...(State.columnPrefs[table]?.widths || {}) },
  };
  persistUiState();
}

function renderColumnControls() {
  const toolbar = document.getElementById('column-toolbar');
  const container = document.getElementById('column-controls');
  if (!toolbar || !container) return;
  if (!State.columnOrder.length) {
    toolbar.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  toolbar.classList.remove('hidden');
  container.innerHTML = State.columnOrder.map((column, index) => `
    <span class="column-control inline-flex items-center gap-1 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1">
      <label class="inline-flex items-center gap-1.5 cursor-pointer text-on-surface">
        <input type="checkbox" class="column-visible accent-cyan-400" data-column="${column}" ${State.visibleColumns.includes(column) ? 'checked' : ''}/>
        <span>${column}</span>
      </label>
    </span>
  `).join('');

  container.querySelectorAll('.column-visible').forEach(input => {
    input.addEventListener('change', () => {
      const column = input.dataset.column;
      if (!input.checked && State.visibleColumns.length === 1) {
        input.checked = true;
        toast('At least one column must remain visible', 'error');
        return;
      }
      State.visibleColumns = input.checked
        ? [...State.visibleColumns, column]
        : State.visibleColumns.filter(item => item !== column);
      saveColumnPreferences();
      renderResultsTable();
      renderColumnControls();
    });
  });
}

// ── Chained result lists ──────────────────────────────────────────────────────
function sublistFields(rows = State.searchResults) {
  return rows.length ? Object.keys(rows[0]).filter(k => !k.startsWith('__')) : [];
}

function renderSublistControls() {
  const panel = document.getElementById('sublist-panel');
  if (!panel) return;
  if (!State.resultChain.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');

  const chainSelect = document.getElementById('sublist-select');
  chainSelect.innerHTML = State.resultChain.map((entry, i) =>
    `<option value="${i}">${i + 1}. ${entry.label} (${entry.rows.length.toLocaleString()})</option>`
  ).join('');
  chainSelect.value = String(State.resultChainIndex);
  document.getElementById('sublist-count').textContent = `${State.searchResults.length.toLocaleString()} rows active`;

  const fields = sublistFields(State.resultChain[State.resultChainIndex].rows);
  const options = fields.map(field => `<option value="${field}">${field}</option>`).join('');
  document.getElementById('sublist-field').innerHTML = options || '<option value="">No fields</option>';
  document.getElementById('sublist-group-field').innerHTML = options || '<option value="">No fields</option>';
}

function renderActiveSublist() {
  const rows = State.resultChain[State.resultChainIndex]?.rows || [];
  State.searchResults = [...rows];
  State.searchTotal = rows.length;
  State.searchOffset = 0;
  renderResultsTable();
  renderSublistControls();
  renderResultSubview();
  document.getElementById('status-count').textContent = `${rows.length.toLocaleString()} rows in active sublist`;
  document.getElementById('status-page').textContent = 'Sublist';
  document.getElementById('btn-prev-page').disabled = true;
  document.getElementById('btn-next-page').disabled = true;
}

function valueMatches(value, op, expected) {
  const text = value == null ? '' : String(value);
  const needle = String(expected ?? '');
  switch (op) {
    case 'contains': return text.toLowerCase().includes(needle.toLowerCase());
    case 'not_contains': return !text.toLowerCase().includes(needle.toLowerCase());
    case 'equals': return text === needle;
    case 'not_equals': return text !== needle;
    case 'starts_with': return text.toLowerCase().startsWith(needle.toLowerCase());
    case 'ends_with': return text.toLowerCase().endsWith(needle.toLowerCase());
    case 'is_null': return value == null || text === '';
    case 'is_not_null': return value != null && text !== '';
    default: return false;
  }
}

document.getElementById('sublist-select')?.addEventListener('change', function() {
  State.resultChainIndex = parseInt(this.value, 10);
  State.sublistSteps = State.sublistSteps.slice(0, State.resultChainIndex);
  renderActiveSublist();
});

function applySublistFilter(field, op, expected, silent = false) {
  const current = State.resultChain[State.resultChainIndex];
  if (!current || !field) { toast('Select a field for the sublist', 'error'); return; }
  if (!['is_null', 'is_not_null'].includes(op) && !expected) { toast('Enter a value for the sublist filter', 'error'); return; }

  const rows = current.rows.filter(row => valueMatches(row[field], op, expected));
  State.resultChain = State.resultChain.slice(0, State.resultChainIndex + 1);
  State.resultChain.push({ label: `${field} ${op.replaceAll('_', ' ')}${expected ? ` "${expected}"` : ''}`, rows });
  State.resultChainIndex = State.resultChain.length - 1;
  State.sublistSteps.push({ field, op, value: expected });
  renderActiveSublist();
  if (!silent) toast(`Sublist created: ${rows.length.toLocaleString()} rows`, 'success');
}

document.getElementById('btn-sublist-filter')?.addEventListener('click', () => {
  applySublistFilter(
    document.getElementById('sublist-field').value,
    document.getElementById('sublist-op').value,
    document.getElementById('sublist-value').value,
  );
});

document.getElementById('btn-sublist-reset')?.addEventListener('click', () => {
  if (!State.resultChain.length) return;
  State.resultChain = [State.resultChain[0]];
  State.resultChainIndex = 0;
  State.sublistSteps = [];
  renderActiveSublist();
});

document.getElementById('btn-sublist-group')?.addEventListener('click', () => {
  const field = document.getElementById('sublist-group-field').value;
  const rows = State.searchResults;
  if (!field || !rows.length) { toast('The active sublist has no data', 'error'); return; }
  const counts = new Map();
  rows.forEach(row => {
    const key = row[field] == null || row[field] === '' ? '<null>' : String(row[field]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  document.getElementById('sublist-group-summary').textContent = `${groups.length.toLocaleString()} unique values`;
  const container = document.getElementById('sublist-groups');
  container.classList.remove('hidden');
  container.innerHTML = groups.slice(0, 40).map(([value, count]) =>
    `<div class="p-2 rounded border border-outline-variant bg-surface-container font-mono text-[11px] flex justify-between gap-2"><span class="truncate" title="${value.replace(/"/g, '&quot;')}">${value}</span><strong class="text-primary-fixed">${count.toLocaleString()}</strong></div>`
  ).join('');
});

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

    const cols = Object.keys(rows[0]).filter(k => !k.startsWith('__'));
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
  const cols = Object.keys(row).filter(k => !k.startsWith('__'));
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

// Searchable facade for native selects. The native select remains authoritative
// so existing change handlers and persisted values keep working.
function enhanceAutocompleteSelect(select) {
  if (!select || select.dataset.autocompleteReady === 'true') return;
  select.dataset.autocompleteReady = 'true';
  const visibleInputClasses = select.className;
  const wrapper = document.createElement('div');
  wrapper.className = 'autocomplete-select';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('autocomplete-native');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = `${visibleInputClasses} autocomplete-input`;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.placeholder = select.options[0]?.textContent?.trim() || 'Search…';
  wrapper.appendChild(input);

  const menu = document.createElement('div');
  menu.className = 'autocomplete-menu hidden';
  menu.setAttribute('role', 'listbox');
  wrapper.appendChild(menu);
  let highlighted = -1;

  const getOptions = () => [...select.options].filter(option => !option.disabled);
  const syncInput = () => {
    const selected = select.options[select.selectedIndex];
    input.value = selected && selected.value ? selected.textContent.trim() : '';
  };
  const close = () => {
    menu.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    highlighted = -1;
  };
  const render = (query = '') => {
    const needle = query.trim().toLocaleLowerCase();
    const matching = getOptions().filter(option => !needle || option.textContent.toLocaleLowerCase().includes(needle));
    menu.innerHTML = '';
    matching.forEach((option, index) => {
      const item = document.createElement('div');
      item.className = `autocomplete-option${index === highlighted ? ' active' : ''}`;
      item.textContent = option.textContent.trim();
      item.setAttribute('role', 'option');
      item.addEventListener('mousedown', event => {
        event.preventDefault();
        select.value = option.value;
        syncInput();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      menu.appendChild(item);
    });
    if (!matching.length) {
      const empty = document.createElement('div');
      empty.className = 'autocomplete-empty';
      empty.textContent = 'No matching options';
      menu.appendChild(empty);
    }
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  };

  select.addEventListener('change', syncInput);
  input.addEventListener('focus', () => { input.select(); render(''); });
  input.addEventListener('input', () => { highlighted = -1; render(input.value); });
  input.addEventListener('keydown', event => {
    const items = [...menu.querySelectorAll('.autocomplete-option')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (menu.classList.contains('hidden')) render(input.value);
      if (!items.length) return;
      highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items.forEach((item, index) => item.classList.toggle('active', index === highlighted));
      items[highlighted]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && highlighted >= 0 && items[highlighted]) {
      event.preventDefault();
      items[highlighted].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    } else if (event.key === 'Escape') {
      syncInput();
      close();
    }
  });
  document.addEventListener('mousedown', event => { if (!wrapper.contains(event.target)) close(); });
  syncInput();
}

function enhanceAutocompleteSelects(root = document) {
  root.querySelectorAll('select.input-field').forEach(enhanceAutocompleteSelect);
}

const autocompleteOptionsObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    const select = mutation.target.closest?.('select.input-field');
    if (!select) return;
    const input = select.parentElement?.querySelector('.autocomplete-input');
    if (input && document.activeElement !== input) {
      const selected = select.options[select.selectedIndex];
      input.value = selected && selected.value ? selected.textContent.trim() : '';
    }
  });
});
autocompleteOptionsObserver.observe(document.body, { childList: true, subtree: true });
enhanceAutocompleteSelects();

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
