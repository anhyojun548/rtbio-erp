/* ══════════════════════════════════════════
   Widget Dashboard — Prototype Logic
   ══════════════════════════════════════════ */
(function () {
'use strict';

// ── Color Palette ──
const COLORS = {
  primary: '#1B3A5C',
  accent: '#00A8B5',
  success: '#2E7D32',
  warning: '#F57C00',
  danger: '#D32F2F',
  purple: '#7C3AED',
  chart: ['#1B3A5C','#00A8B5','#F57C00','#7C3AED','#2E7D32','#D32F2F','#E91E63','#3F51B5']
};

// ── 레거시 preset → prefab spec key 매핑 ──
// 2026-06-02(Phase B5): 레거시 MOCK preset 위젯을 spec 엔진으로 일원화.
//   DB 에 남아 있는 옛 mock-preset 위젯(config.spec 없음)은 이 맵으로 prefab spec 에 매핑해 렌더한다.
//   매핑 없는 키(weekly_sales/client_share/today_order_list/procurement_*/udi_status/unread_notifications 등)는 드롭.
const LEGACY_PRESET_MAP = {
  monthly_sales: 'kpi_monthly_sales',
  total_ar: 'kpi_total_ar',
  today_orders: 'kpi_open_orders',
  active_clients: 'kpi_active_clients',
};

// 기본 레이아웃에 채울 prefab spec key (순서대로) — loadDefaultLayout 에서 사용.
const DEFAULT_LAYOUT_KEYS = ['kpi_monthly_sales', 'kpi_total_ar', 'kpi_open_orders', 'kpi_active_clients'];

// widget-schema.examples(prefab spec 카탈로그) 캐시 — 1회 fetch 후 재사용.
var _prefabSpecs = null;
async function _ensurePrefabSpecs() {
  if (_prefabSpecs) return _prefabSpecs;
  try {
    var r = await fetch('/api/dashboard/widget-schema', { credentials: 'same-origin' });
    var j = await r.json();
    _prefabSpecs = (j && j.examples) || {};
  } catch (e) {
    _prefabSpecs = {};
    // eslint-disable-next-line no-console
    console.warn('[dashboard] prefab spec 카탈로그 로드 실패', e);
  }
  return _prefabSpecs;
}

// ── Grid Init ──
var grid;
var widgetCounter = 0;

// ── C-1: Global Date Range & Widget Override ──
var GLOBAL_DATE_KEY = 'rtbio_global_date';
var DATE_LABELS = {
  'today': '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
  'month': '이번 달',
  'custom': '커스텀'
};

function getGlobalDateRange() {
  try {
    var saved = localStorage.getItem(GLOBAL_DATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  // 2026-06: KST 기준 최근 7일 (이전엔 2026-04-01~04-16 하드코딩)
  var today = new Date();
  var toKst = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  var fromD = new Date(today); fromD.setDate(fromD.getDate() - 6);
  var fromKst = fromD.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return { range: '7d', from: fromKst, to: toKst };
}

function saveGlobalDateRange(obj) {
  localStorage.setItem(GLOBAL_DATE_KEY, JSON.stringify(obj));
}

function getEffectiveDateLabel(el) {
  var ovr = el && el.dataset.widgetDateOverride;
  if (ovr) return '🔶 ' + DATE_LABELS[ovr] + ' (override)';
  var g = getGlobalDateRange();
  return DATE_LABELS[g.range] || '전역';
}

function initGrid() {
  grid = GridStack.init({
    column: 12,
    cellHeight: 60,
    margin: 10,
    animate: true,
    float: false,
    removable: false,
    resizable: { handles: 'se,sw' },
  }, '#gridStack');

  grid.on('change', function () { saveDashboard(); });
}

/* ══════════════════════════════════════════
   Spec Widget Renderer (executeWidgetSpec 결과)
   ──────────────────────────────────────────
   모든 위젯은 spec 위젯(config.spec)이다. (2026-06-02 레거시 MOCK 전면 제거)
   GET /api/dashboard/widgets/{id}/data → WidgetResult { kind, value?, series?, rows?, comparison? }
   ══════════════════════════════════════════ */

var _HAS_CHART = (typeof Chart !== 'undefined');

// ── format 적용 (spec.format.value) ──
function _fmtSpecValue(n, format) {
  var v = Number(n) || 0;
  var f = (format && format.value) || {};
  var locale = f.locale || 'ko-KR';
  var decimals = (typeof f.decimals === 'number') ? f.decimals : 0;
  var out;
  if (f.compact) {
    // 큰 수 축약 (₩1.2억 / 3.4만)
    var abs = Math.abs(v);
    if (abs >= 1e8) out = (v / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
    else if (abs >= 1e4) out = (v / 1e4).toFixed(1).replace(/\.0$/, '') + '만';
    else out = v.toLocaleString(locale);
  } else if (f.type === 'percent') {
    out = v.toFixed(decimals) + '%';
  } else {
    out = v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return (f.prefix || '') + out + (f.suffix || '');
}

// ── thresholds → 색상 선택 (gauge/kpi) ──
function _pickThresholdColor(value, style, fallback) {
  if (!style || !Array.isArray(style.thresholds) || !style.thresholds.length) return fallback;
  var chosen = fallback;
  // value 이상인 threshold 중 가장 큰 것의 색
  style.thresholds
    .slice()
    .sort(function (a, b) { return a.value - b.value; })
    .forEach(function (t) { if (value >= t.value) chosen = t.color; });
  return chosen;
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── div-bar 폴백 (Chart.js 없을 때 bar/hbar/line/pie/donut) ──
function _renderBarFallback(el, series, color) {
  var max = series.reduce(function (m, p) { return Math.max(m, Number(p.value) || 0); }, 0) || 1;
  var html = '<div class="spec-bar-fallback" style="display:flex;flex-direction:column;gap:6px;padding:4px 2px;overflow:auto;flex:1;">';
  series.forEach(function (p) {
    var pct = Math.max(2, Math.round((Number(p.value) || 0) / max * 100));
    html += '' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:11px;">' +
        '<span style="flex:0 0 80px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + _escapeHtml(p.label) + '">' + _escapeHtml(p.label) + '</span>' +
        '<span style="flex:1;background:#eef1f4;border-radius:4px;height:14px;position:relative;">' +
          '<span style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;background:' + (color || COLORS.accent) + ';border-radius:4px;"></span>' +
        '</span>' +
        '<span style="flex:0 0 auto;font-variant-numeric:tabular-nums;color:var(--text);">' + (Number(p.value) || 0).toLocaleString() + '</span>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── series 차트 (bar / hbar / line / pie / donut) ──
function _renderSpecChart(el, kind, series, style) {
  var color = (style && style.color) || COLORS.accent;
  if (!series || !series.length) {
    el.innerHTML = '<div class="kpi-desc" style="padding:16px;text-align:center;">데이터 없음</div>';
    return;
  }
  if (!_HAS_CHART) { _renderBarFallback(el, series, color); return; }

  el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
  var ctx = el.querySelector('canvas').getContext('2d');
  var labels = series.map(function (p) { return p.label; });
  var values = series.map(function (p) { return Number(p.value) || 0; });

  if (kind === 'pie' || kind === 'donut') {
    new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: COLORS.chart.slice(0, labels.length), borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: kind === 'donut' ? '65%' : '0%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } }
      }
    });
  } else if (kind === 'line') {
    new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ data: values, borderColor: color, backgroundColor: 'rgba(0,168,181,0.1)', fill: true, tension: 0.3, pointRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  } else {
    // bar / hbar
    var isH = (kind === 'hbar');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: isH ? COLORS.chart.slice(0, labels.length) : color,
          borderRadius: 4, barPercentage: 0.7,
        }]
      },
      options: {
        indexAxis: isH ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: isH
          ? { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
          : { y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  }
}

// ── gauge (value = 0~100 가정, 아니면 0 으로 클램프 표시) ──
function _renderSpecGauge(el, value, style, format) {
  var pct = Math.max(0, Math.min(100, Number(value) || 0));
  var color = _pickThresholdColor(pct, style, (style && style.color) || COLORS.accent);
  el.innerHTML =
    '<div class="gauge-wrapper">' +
      '<div class="gauge-canvas-wrap"><canvas width="160" height="90"></canvas></div>' +
      '<div class="gauge-label">' + _fmtSpecValue(value, format) + '</div>' +
      '<div class="gauge-sub">달성률</div>' +
    '</div>';
  if (!_HAS_CHART) {
    // 폴백: 막대형 진행률
    el.querySelector('.gauge-canvas-wrap').innerHTML =
      '<div style="width:140px;height:14px;background:#E5E7EB;border-radius:7px;overflow:hidden;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + color + ';"></div>' +
      '</div>';
    return;
  }
  var ctx = el.querySelector('canvas').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: [color, '#E5E7EB'], borderWidth: 0 }] },
    options: { responsive: false, circumference: 180, rotation: -90, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

// ── KPI (value + comparison ▲▼ deltaPercent) ──
function _renderSpecKpi(el, result, payload) {
  var format = payload.format;
  var style = payload.style;
  var color = (style && style.color) || '';
  var valueStr = _fmtSpecValue(result.value, format);
  var html = '<div class="kpi-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + (style && style.icon ? style.icon + ' ' : '') + valueStr + '</div>';
  html += '<div class="kpi-desc">' + _escapeHtml(payload.subtitle || payload.title || '') + '</div>';

  // comparison: result.comparison.deltaPercent (null 가능)
  var cmp = result.comparison;
  if (cmp && cmp.deltaPercent != null) {
    var up = cmp.deltaPercent >= 0;
    var dp = Math.abs(cmp.deltaPercent).toFixed(1);
    html += '<div class="kpi-change ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + dp + '%</div>';
  }
  el.innerHTML = html;
}

// ── table (rows: Record<string,unknown>[]) ──
function _renderSpecTable(el, rows) {
  if (!rows || !rows.length) {
    el.innerHTML = '<div class="kpi-desc" style="padding:16px;text-align:center;">데이터 없음</div>';
    return;
  }
  // 열 = 첫 행의 키 (id/createdBy 등 잡음 제거: 최대 6열)
  var keys = Object.keys(rows[0]).filter(function (k) {
    return ['createdBy', 'updatedAt'].indexOf(k) === -1;
  }).slice(0, 6);
  var html = '<div style="overflow:auto;flex:1;"><table class="widget-table"><thead><tr>';
  keys.forEach(function (k) { html += '<th>' + _escapeHtml(k) + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function (row) {
    html += '<tr>';
    keys.forEach(function (k) {
      var v = row[k];
      if (v != null && typeof v === 'object') v = JSON.stringify(v);
      html += '<td>' + _escapeHtml(v) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ── spec 위젯 1개 렌더 (fetch → kind 분기) ──
async function renderSpecWidget(elId, widgetId) {
  var el = document.getElementById(elId);
  if (!el) return;
  try {
    var r = await fetch('/api/dashboard/widgets/' + encodeURIComponent(widgetId) + '/data', { credentials: 'same-origin' });
    var payload = await r.json();
    if (!r.ok || !payload.ok) {
      el.innerHTML = '<div class="kpi-value">—</div><div class="kpi-desc">' + _escapeHtml((payload && payload.error) || '데이터 조회 실패') + '</div>';
      return;
    }
    renderSpecResult(el, payload);
  } catch (e) {
    el.innerHTML = '<div class="kpi-value">—</div><div class="kpi-desc">데이터 조회 오류</div>';
    // eslint-disable-next-line no-console
    console.warn('[dashboard] spec 위젯 렌더 실패', widgetId, e);
  }
}

// result(payload) → DOM. 빌더 미리보기는 이미 받은 result 를 직접 그리므로 분리.
// payload = { ok, result:{kind,value?,series?,rows?,comparison?}, kind?, title?, subtitle?, format?, style? }
function renderSpecResult(el, payload) {
  var result = payload.result || {};
  var kind = result.kind || payload.kind;
  switch (kind) {
    case 'kpi':
      _renderSpecKpi(el, result, payload);
      break;
    case 'gauge':
      _renderSpecGauge(el, result.value, payload.style, payload.format);
      break;
    case 'table':
      _renderSpecTable(el, result.rows);
      break;
    case 'bar':
    case 'hbar':
    case 'line':
    case 'pie':
    case 'donut':
      _renderSpecChart(el, kind, result.series, payload.style);
      break;
    default:
      el.innerHTML = '<div class="kpi-desc">알 수 없는 위젯 종류: ' + _escapeHtml(kind) + '</div>';
  }
}

/* ══════════════════════════════════════════
   실시간 갱신 — Tier 2 (폴링) + Tier 3 (액션 후)
   ══════════════════════════════════════════ */

// 모든 위젯 data 재fetch. (모든 위젯은 spec 위젯이다 — 2026-06-02 레거시 MOCK 제거)
function refreshAllWidgets() {
  if (typeof grid === 'undefined' || !grid) return;
  grid.getGridItems().forEach(function (el) {
    var bodyEl = el.querySelector('.widget-body');
    if (!bodyEl) return;
    if (el.dataset.widgetSpec === '1' && el.dataset.widgetId) {
      renderSpecWidget(bodyEl.id, el.dataset.widgetId);
    }
  });
}

// Tier 3: 외부 액션(발주/확정 등) 후 호출 가능한 전역 함수
window.refreshDashboardWidgets = refreshAllWidgets;

// Tier 2: 60초 폴링 (페이지 visible 일 때만). visibilitychange 로 일시정지/재개.
var _pollTimer = null;
function _startWidgetPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(function () {
    if (document.visibilityState === 'visible') refreshAllWidgets();
  }, 60000);
}
function _stopWidgetPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    refreshAllWidgets();   // 복귀 즉시 1회 갱신
    _startWidgetPolling();
  } else {
    _stopWidgetPolling();  // 숨김 상태에서는 폴링 중지 (불필요한 요청 방지)
  }
});
window.addEventListener('beforeunload', _stopWidgetPolling);

function removeWidget(id) {
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    grid.removeWidget(el);
    saveDashboard();
  }
}

// spec 1개를 DB 에 저장하고 { id, spec } 반환 (실패 시 throw). 갤러리/빌더의 _saveSpec 와 동일 경로.
async function _saveSpecToDb(spec) {
  var r = await fetch('/api/dashboard/widgets/spec', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec: spec }),
  });
  var j = await r.json();
  if (!r.ok || !j || !j.ok) {
    var msg = (j && j.validationErrors && j.validationErrors[0] && (j.validationErrors[0].hint || j.validationErrors[0].message)) ||
      (j && j.error) || '저장 실패';
    throw new Error(msg);
  }
  return { id: j.id, spec: j.spec };
}

// ── Default Layout ──
// 2026-06-02(Phase B5): prefab spec 4종(KPI)을 순차 저장 후 그리드에 추가. (레거시 addWidget 제거)
async function loadDefaultLayout() {
  grid.removeAll();
  var examples = await _ensurePrefabSpecs();
  for (var i = 0; i < DEFAULT_LAYOUT_KEYS.length; i++) {
    var spec = examples[DEFAULT_LAYOUT_KEYS[i]];
    if (!spec) continue; // 카탈로그에 없으면 건너뜀
    try {
      var res = await _saveSpecToDb(spec);
      addSpecWidgetToGrid(res.spec, res.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] 기본 위젯 저장 실패', DEFAULT_LAYOUT_KEYS[i], e);
    }
  }
}

// ── Save / Load Dashboard ──
// 2026-05-27: DB API sync 추가. localStorage 는 즉시 UX 보장용 fallback.
//   - saveDashboard()  : localStorage 즉시 + DB bulk POST (3초 debounce)
//   - loadDashboard()  : async — DB GET 우선, 빈/실패 시 localStorage 폴백
//   - _applyItemsToGrid: prototype 형식 items[] 을 GridStack 에 복원 (공용)
function saveDashboard() {
  var items = grid.getGridItems().map(function (el) {
    var node = el.gridstackNode;
    var item = {
      type: el.dataset.widgetType,
      title: el.dataset.widgetTitle,
      preset: el.dataset.widgetPreset,
      dateOverride: el.dataset.widgetDateOverride || '',
      x: node.x, y: node.y, w: node.w, h: node.h
    };
    // spec 위젯: spec/widgetId 보존 (DB sync 시 config.spec 유실 방지)
    if (el.dataset.widgetSpec === '1') {
      item.isSpec = true;
      if (el.dataset.widgetId) item.widgetId = el.dataset.widgetId;
      if (window._specCache && el.dataset.widgetId && window._specCache[el.dataset.widgetId]) {
        item.spec = window._specCache[el.dataset.widgetId];
      }
    }
    return item;
  });
  // 1) localStorage 즉시 저장 (즉각적 UX, DB sync 실패에도 살아남음)
  try { localStorage.setItem('rtbio_dashboard', JSON.stringify(items)); } catch (e) {}
  // 2) DB sync — debounced 3초 (GridStack onChange 가 잦으므로)
  _scheduleDashboardSync(items);
}

var _saveTimer = null;
function _scheduleDashboardSync(items) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    _saveTimer = null;
    var payload = {
      items: items
        .filter(function (it) { return it && it.preset; }) // 빈 위젯은 DB 동기화 제외
        .map(function (it, idx) {
          var config = {
            x: Number(it.x) || 0,
            y: Number(it.y) || 0,
            title: (it.title || '').slice(0, 200),
            type: (it.type || '').slice(0, 50),
          };
          // spec 위젯: config.spec 보존 (bulk endpoint passthrough → 재로드 시 복원)
          if (it.isSpec && it.spec) config.spec = it.spec;
          return {
            preset: String(it.preset).slice(0, 100),
            position: idx,
            width: Number(it.w) || 6,
            height: Number(it.h) || 4,
            overrideDateRange: it.dateOverride ? String(it.dateOverride).slice(0, 50) : null,
            config: config,
          };
        }),
    };
    var hasSpec = payload.items.some(function (it) { return it.config && it.config.spec; });
    fetch('/api/dashboard/widgets/bulk', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function () {
      // bulk 은 deleteMany→create 라 spec 위젯의 DB id 가 바뀐다.
      // data endpoint 는 id 기반이므로, sync 후 새 id 로 dataset 을 갱신 (DOM 재생성 X).
      if (hasSpec) _resyncSpecWidgetIds();
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] DB sync 실패 — localStorage 만 유지', e);
    });
  }, 3000);
}

// bulk sync 후 spec 위젯의 새 DB id 를 재매핑 (stale id 방지).
// DB rows(position asc) ↔ 화면 위젯(sync 와 동일 필터/순서)을 position 으로 zip.
async function _resyncSpecWidgetIds() {
  try {
    var r = await fetch('/api/dashboard/widgets', { credentials: 'same-origin' });
    if (!r.ok) return;
    var rows = await r.json();
    if (!Array.isArray(rows)) return;
    // position → DB row
    var byPos = {};
    rows.forEach(function (w) { byPos[w.position] = w; });

    // sync 와 동일하게: preset 있는 위젯만, GridStack 기본 순서대로 position 0..n 부여
    var pos = 0;
    grid.getGridItems().forEach(function (el) {
      if (!el.dataset.widgetPreset) return; // 빈 위젯은 sync 제외 → position 미부여
      var row = byPos[pos];
      pos++;
      if (!row) return;
      if (el.dataset.widgetSpec === '1' && row.config && row.config.spec) {
        var oldId = el.dataset.widgetId;
        el.dataset.widgetId = row.id;
        window._specCache = window._specCache || {};
        window._specCache[row.id] = row.config.spec;
        if (oldId && oldId !== row.id) {
          if (window._specCache[oldId]) delete window._specCache[oldId];
          // 편집 중인 빌더가 이 위젯을 가리키면 편집 대상 id 도 따라가게(저장 유실 race 방지)
          if (window._notifyWidgetIdRemap) window._notifyWidgetIdRemap(oldId, row.id);
        }
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[dashboard] spec id 재동기화 실패', e);
  }
}

// items[] 을 GridStack 에 복원. 모든 위젯은 spec 위젯이어야 한다.
//   - spec 동봉(item.spec + widgetId) → 그대로 렌더
//   - 레거시 mock-preset(spec 없음) → LEGACY_PRESET_MAP 으로 prefab spec 매핑해 저장 후 렌더, 매핑 없으면 드롭
async function _applyItemsToGrid(items) {
  grid.removeAll();

  // 레거시 prefab spec 매핑이 필요한 항목이 있으면 카탈로그를 1회 로드.
  var needsPrefab = items.some(function (it) { return !(it.spec && it.widgetId) && LEGACY_PRESET_MAP[it.preset]; });
  var examples = needsPrefab ? await _ensurePrefabSpecs() : {};

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    // ── spec 위젯 (정상 경로) ──
    if (item.spec && item.widgetId) {
      _addRestoredSpecWidget(item.spec, item.widgetId, item);
      continue;
    }

    // ── 레거시 mock-preset → prefab spec 매핑 ──
    var mappedKey = LEGACY_PRESET_MAP[item.preset];
    if (!mappedKey) continue;                 // 매핑 없는 옛 위젯은 드롭
    var prefab = examples[mappedKey];
    if (!prefab) continue;                    // 카탈로그에 없으면 드롭
    try {
      var res = await _saveSpecToDb(prefab);  // 새 DB id 발급
      _addRestoredSpecWidget(res.spec, res.id, item);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] 레거시 위젯 → spec 매핑 실패', item.preset, e);
    }
  }
}

// 복원된 spec 위젯 1개를 그리드에 배치(위치 보존). item.x/y/w/h/dateOverride 를 사용.
function _addRestoredSpecWidget(spec, widgetId, item) {
  widgetCounter++;
  var id = 'widget-' + widgetCounter;
  var bodyId = 'wbody-' + widgetCounter;
  var content =
    '<div class="widget-header">' +
      '<span class="widget-title">' + _escapeHtml((spec && spec.title) || item.title || '') + '</span>' +
      '<button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button>' +
    '</div>' +
    '<div class="widget-body" id="' + bodyId + '"></div>';
  grid.addWidget({
    id: id, x: item.x, y: item.y, w: item.w, h: item.h, content: content
  });
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    el.dataset.widgetType = 'spec';
    el.dataset.widgetPreset = 'spec:custom';
    el.dataset.widgetTitle = (spec && spec.title) || item.title || '';
    el.dataset.widgetDateOverride = item.dateOverride || '';
    el.dataset.widgetId = widgetId;
    el.dataset.widgetSpec = '1';
    window._specCache = window._specCache || {};
    window._specCache[widgetId] = spec;
  }
  (function (bid, wid) {
    setTimeout(function () { renderSpecWidget(bid, wid); }, 50);
  })(bodyId, widgetId);
}

async function loadDashboard() {
  // 1) DB 시도
  try {
    var r = await fetch('/api/dashboard/widgets', { credentials: 'same-origin' });
    if (r.ok) {
      var data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        // DB 응답을 prototype 형식으로 복원
        var items = data.map(function (w) {
          var cfg = w.config || {};
          // spec 위젯: config.spec 존재 → executeWidgetSpec endpoint 로 그림
          var spec = cfg.spec || null;
          return {
            type: spec ? 'spec' : (cfg.type || 'kpi'),
            title: (spec && spec.title) || cfg.title || w.preset,
            preset: w.preset,
            spec: spec,             // spec 위젯 마커 (있으면 spec 렌더)
            widgetId: w.id,         // DB id — /widgets/{id}/data fetch 용
            dateOverride: w.overrideDateRange || '',
            x: cfg.x != null ? cfg.x : 0,
            y: cfg.y != null ? cfg.y : 0,
            w: w.width,
            h: w.height,
          };
        });
        await _applyItemsToGrid(items);
        return true;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[dashboard] DB 조회 실패 — localStorage 폴백', e);
  }

  // 2) localStorage 폴백
  var saved = localStorage.getItem('rtbio_dashboard');
  if (saved) {
    try {
      var items2 = JSON.parse(saved);
      await _applyItemsToGrid(items2);
      return true;
    } catch (e) { return false; }
  }
  return false;
}

// ── Export / Import ──
// 모든 위젯은 spec 위젯이므로 spec 을 동봉해 내보낸다(재가져오기 시 복원 가능).
function exportDashboard() {
  var items = grid.getGridItems().map(function (el) {
    var node = el.gridstackNode;
    var item = {
      type: el.dataset.widgetType,
      title: el.dataset.widgetTitle,
      preset: el.dataset.widgetPreset,
      x: node.x, y: node.y, w: node.w, h: node.h
    };
    if (el.dataset.widgetSpec === '1' && el.dataset.widgetId &&
        window._specCache && window._specCache[el.dataset.widgetId]) {
      item.spec = window._specCache[el.dataset.widgetId];
    }
    return item;
  });
  var json = JSON.stringify({ version: '1.0', portal: 'exec', widgets: items }, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'rtbio-dashboard-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('대시보드를 내보냈습니다');
}

function importDashboard(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = JSON.parse(e.target.result);
      if (data.widgets && Array.isArray(data.widgets)) {
        // 동봉된 spec 은 새 DB id 로 재저장(addSpecWidgetToGrid), spec 없는 항목은 LEGACY_PRESET_MAP 시도.
        var count = 0;
        var chain = Promise.resolve();
        data.widgets.forEach(function (item) {
          chain = chain.then(function () {
            if (item.spec) {
              return _saveSpecToDb(item.spec).then(function (res) {
                addSpecWidgetToGrid(res.spec, res.id); count++;
              }).catch(function () {});
            }
            var mappedKey = LEGACY_PRESET_MAP[item.preset];
            if (!mappedKey) return null; // 매핑 없는 옛 위젯은 드롭
            return _ensurePrefabSpecs().then(function (examples) {
              var prefab = examples[mappedKey];
              if (!prefab) return null;
              return _saveSpecToDb(prefab).then(function (res) {
                addSpecWidgetToGrid(res.spec, res.id); count++;
              });
            }).catch(function () {});
          });
        });
        chain.then(function () {
          showToast('대시보드를 가져왔습니다 (위젯 ' + count + '개)');
        });
      }
    } catch (err) {
      showToast('올바른 대시보드 JSON 파일이 아닙니다');
    }
  };
  reader.readAsText(file);
}

// ── Widget Picker ──
function openPicker() {
  document.getElementById('pickerOverlay').classList.add('open');
  if (window.onPickerOpen) window.onPickerOpen(); // 갤러리 lazy-load 훅 (widget-builder.js)
}
function closePicker() {
  document.getElementById('pickerOverlay').classList.remove('open');
}

// spec 위젯 1개를 그리드에 추가 (갤러리/빌더 공용).
function addSpecWidgetToGrid(spec, savedId) {
  widgetCounter++;
  var id = 'widget-' + widgetCounter, bodyId = 'wbody-' + widgetCounter;
  var w = (spec.layout && spec.layout.w) || 3, h = (spec.layout && spec.layout.h) || 2;
  var content = '<div class="widget-header"><span class="widget-title">' + _escapeHtml(spec.title) +
    '</span><button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button></div>' +
    '<div class="widget-body" id="' + bodyId + '"></div>';
  grid.addWidget({ id: id, w: w, h: h, content: content, autoPosition: true });
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    el.dataset.widgetType = 'spec'; el.dataset.widgetTitle = spec.title;
    el.dataset.widgetSpec = '1'; el.dataset.widgetId = savedId; el.dataset.widgetPreset = 'spec:custom';
    window._specCache = window._specCache || {}; window._specCache[savedId] = spec;
  }
  setTimeout(function () { renderSpecWidget(bodyId, savedId); }, 50);
  saveDashboard();
}

// 기존 spec 위젯 갱신 (편집 모드). widgetId 는 DB spec id (gs-id=widget-N 아님).
//   dataset.widgetId 로 그리드 아이템 탐색 → _specCache/제목 갱신 → dry-run 재렌더 → saveDashboard 영속.
function updateSpecWidget(widgetId, spec) {
  var el = grid.getGridItems().filter(function (e) {
    return e.dataset.widgetId === widgetId;
  })[0];
  if (!el) return;
  window._specCache = window._specCache || {};
  window._specCache[widgetId] = spec;
  el.dataset.widgetTitle = spec.title;
  var t = el.querySelector('.widget-title');
  if (t) {
    var ovr = el.dataset.widgetDateOverride;
    t.textContent = spec.title + (ovr ? ' 🔶' : '');
  }
  // 즉시 재렌더(dry-run) — bulk sync 가 DB id 를 바꾸므로 data endpoint 대신 dry-run 사용.
  var body = el.querySelector('.widget-body');
  if (body) {
    fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec, dryRunOnly: true }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) {
        renderSpecResult(body, {
          ok: true, result: j.preview, kind: spec.kind, title: spec.title,
          subtitle: spec.subtitle, format: spec.format, style: spec.style,
        });
      }
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] 위젯 갱신 미리보기 실패', widgetId, e);
    });
  }
  // 영속: config.spec 갱신 → bulk sync (id 재발급은 _resyncSpecWidgetIds 가 처리).
  saveDashboard();
}

// ── Toast ──
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

// ── Expose functions needed by HTML onclick handlers ──
window.removeWidget = removeWidget;
window.showToast = showToast;

// ── spec 렌더러/그리드 추가/피커 토글 — 빌더(widget-builder.js) 재사용 ──
window.renderSpecResult = renderSpecResult;
window.addSpecWidgetToGrid = addSpecWidgetToGrid;
window.updateSpecWidget = updateSpecWidget;   // 빌더 편집 저장 → 위젯 갱신
window.closePicker = closePicker;
window._WIDGET = { COLORS: COLORS }; // 빌더가 색상 토큰 참조

// 2026-06-02: 갤러리는 role 무관 전체 prefab 노출 → role 필터 제거. 외부 호출 호환용 no-op 스텁 유지.
window.setDashboardRole = function () {};

// ── Init ──
document.addEventListener('DOMContentLoaded', async function () {
  initGrid();

  // Load saved or default — 2026-05-27: DB 우선, 폴백 localStorage, 둘 다 없으면 default.
  var loaded = await loadDashboard();
  if (!loaded) {
    await loadDefaultLayout();
  }

  // 실시간 Tier 2 — 60초 폴링 시작 (spec 위젯 data refresh)
  _startWidgetPolling();

  // ── C-1: Global Date Range Selector ──
  var globalSel = document.getElementById('globalDateRange');
  var fromInput = document.getElementById('globalDateFrom');
  var toInput = document.getElementById('globalDateTo');
  if (globalSel) {
    var g = getGlobalDateRange();
    globalSel.value = g.range;
    if (fromInput) fromInput.value = g.from;
    if (toInput) toInput.value = g.to;
    var showCustom = g.range === 'custom';
    if (fromInput) fromInput.style.display = showCustom ? '' : 'none';
    if (toInput) toInput.style.display = showCustom ? '' : 'none';

    globalSel.addEventListener('change', function () {
      var newRange = globalSel.value;
      var isCustom = newRange === 'custom';
      fromInput.style.display = isCustom ? '' : 'none';
      toInput.style.display = isCustom ? '' : 'none';

      // 위젯 override가 하나라도 있으면 확인
      var hasOverride = grid.getGridItems().some(function (el) {
        return el.dataset.widgetDateOverride;
      });
      if (hasOverride && !confirm('전역 기간을 변경하면 모든 위젯의 개별 기간 설정이 리셋됩니다. 계속할까요?')) {
        globalSel.value = getGlobalDateRange().range;
        return;
      }

      // 리셋
      grid.getGridItems().forEach(function (el) {
        el.dataset.widgetDateOverride = '';
        var titleEl = el.querySelector('.widget-title');
        if (titleEl) {
          var baseTitle = el.dataset.widgetTitle || '';
          titleEl.textContent = baseTitle;
        }
      });

      saveGlobalDateRange({
        range: newRange,
        from: fromInput.value,
        to: toInput.value
      });
      saveDashboard();
      showToast('전역 기간: ' + DATE_LABELS[newRange] + ' (위젯 override 리셋됨)');

      // 전 위젯 data 재fetch (모든 위젯 spec)
      refreshAllWidgets();
    });

    [fromInput, toInput].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('change', function () {
        saveGlobalDateRange({
          range: globalSel.value,
          from: fromInput.value,
          to: toInput.value
        });
        showToast('커스텀 기간 저장됨');
      });
    });
  }

  // Event listeners
  document.getElementById('btnAddWidget').addEventListener('click', openPicker);
  document.getElementById('pickerClose').addEventListener('click', closePicker);
  document.getElementById('pickerOverlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('pickerOverlay')) closePicker();
  });

  // Kebab menu
  var kebabBtn = document.getElementById('kebabBtn');
  var kebabMenu = document.getElementById('kebabMenu');
  kebabBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    kebabMenu.classList.toggle('open');
  });
  document.addEventListener('click', function () { kebabMenu.classList.remove('open'); });
  kebabMenu.addEventListener('click', function (e) { e.stopPropagation(); });

  document.getElementById('btnExport').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    exportDashboard();
  });
  document.getElementById('btnImport').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    if (e.target.files[0]) {
      importDashboard(e.target.files[0]);
      e.target.value = '';
    }
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    if (confirm('기본 레이아웃으로 초기화할까요? 현재 배치가 사라집니다.')) {
      // localStorage + DB 양쪽 모두 초기화
      try { localStorage.removeItem('rtbio_dashboard'); } catch (e) {}
      // DB reset 은 fire-and-forget — 실패해도 default layout 은 그려진다.
      fetch('/api/dashboard/widgets/reset', {
        method: 'POST', credentials: 'same-origin'
      }).catch(function (e) {
        // eslint-disable-next-line no-console
        console.warn('[dashboard] DB reset 실패', e);
      });
      // pending debounced sync 가 reset 직후 기본 레이아웃을 다시 DB 에 푸시한다.
      loadDefaultLayout();
      showToast('기본 레이아웃으로 초기화했습니다');
    }
  });

  // ── Right-click Context Menu ──
  var ctxMenu = document.getElementById('widgetCtx');
  var ctxTargetId = null;

  document.getElementById('gridStack').addEventListener('contextmenu', function (e) {
    var gsItem = e.target.closest('.grid-stack-item');
    if (!gsItem) return;
    e.preventDefault();
    ctxTargetId = gsItem.getAttribute('gs-id');
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    ctxMenu.classList.add('open');
  });

  document.addEventListener('click', function () { ctxMenu.classList.remove('open'); });
  document.addEventListener('contextmenu', function (e) {
    if (!e.target.closest('.grid-stack-item')) ctxMenu.classList.remove('open');
  });

  ctxMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('.widget-ctx-item');
    if (!btn || !ctxTargetId) return;
    var action = btn.dataset.action;
    var el = document.querySelector('[gs-id="' + ctxTargetId + '"]');
    ctxMenu.classList.remove('open');

    if (action === 'delete') {
      removeWidget(ctxTargetId);
      showToast('위젯을 삭제했습니다');
    } else if (action === 'edit') {
      // spec 위젯이면 빌더를 현재 spec 으로 프리필해 열고, 아니면 제목만 편집(레거시/비-spec 폴백).
      var elx = document.querySelector('[gs-id="' + ctxTargetId + '"]');
      var wid = elx && elx.dataset.widgetId;
      if (wid && window._specCache && window._specCache[wid] && window.openBuilderForEdit) {
        window.openBuilderForEdit(wid);
      } else {
        openEditModal(ctxTargetId); // 폴백: 제목만(레거시/비-spec)
      }
    } else if (action === 'duplicate') {
      // spec 위젯 복제: 캐시된 spec 을 새 DB id 로 재저장 후 그리드에 추가.
      if (el && el.dataset.widgetSpec === '1' && el.dataset.widgetId &&
          window._specCache && window._specCache[el.dataset.widgetId]) {
        var dupSpec = window._specCache[el.dataset.widgetId];
        _saveSpecToDb(dupSpec).then(function (res) {
          addSpecWidgetToGrid(res.spec, res.id);
          showToast('위젯을 복제했습니다');
        }).catch(function (err) {
          showToast('복제 실패: ' + (err && err.message ? err.message : ''));
        });
      }
    } else if (action === 'refresh') {
      if (el && el.dataset.widgetSpec === '1' && el.dataset.widgetId) {
        var bodyEl = el.querySelector('.widget-body');
        if (bodyEl) {
          renderSpecWidget(bodyEl.id, el.dataset.widgetId);
          showToast('위젯을 새로고침했습니다');
        }
      }
    }
  });

  // ── Edit Modal — 제목/기간 편집만 (2026-06-02 커스텀 빌더 섹션 제거) ──
  //   spec 의 측정/필터 등 구조 변경은 "삭제 후 다시 만들기"(빌더)로 안내. (YAGNI)
  var editOverlay = document.getElementById('editOverlay');
  var editTitle = document.getElementById('editTitle');
  var editingWidgetId = null;

  function openEditModal(widgetId) {
    var el = document.querySelector('[gs-id="' + widgetId + '"]');
    if (!el || !editOverlay) return;
    editingWidgetId = widgetId;
    if (editTitle) editTitle.value = el.dataset.widgetTitle || '';
    var dateOvrSel = document.getElementById('editDateOverride');
    if (dateOvrSel) dateOvrSel.value = el.dataset.widgetDateOverride || '';
    editOverlay.classList.add('open');
    if (editTitle) editTitle.focus();
  }

  function closeEditModal() {
    if (editOverlay) editOverlay.classList.remove('open');
    editingWidgetId = null;
  }

  function _wireEdit(id, fn) { var b = document.getElementById(id); if (b) b.addEventListener('click', fn); }
  _wireEdit('editClose', closeEditModal);
  _wireEdit('editCancel', closeEditModal);
  if (editOverlay) {
    editOverlay.addEventListener('click', function (e) {
      if (e.target === editOverlay) closeEditModal();
    });
  }

  _wireEdit('editSave', function () {
    if (!editingWidgetId) return;
    var el = document.querySelector('[gs-id="' + editingWidgetId + '"]');
    if (!el) return;

    var newTitle = (editTitle && editTitle.value.trim()) || '위젯';
    var dateOvrSel = document.getElementById('editDateOverride');
    var newOverride = dateOvrSel ? dateOvrSel.value : '';

    el.dataset.widgetTitle = newTitle;
    el.dataset.widgetDateOverride = newOverride || '';

    // spec 캐시의 title 도 갱신 → saveDashboard 시 config.spec.title 반영.
    if (el.dataset.widgetSpec === '1' && el.dataset.widgetId &&
        window._specCache && window._specCache[el.dataset.widgetId]) {
      window._specCache[el.dataset.widgetId].title = newTitle;
    }

    var titleEl = el.querySelector('.widget-title');
    if (titleEl) {
      titleEl.textContent = newTitle + (newOverride ? ' 🔶' : '');
      titleEl.title = '기간: ' + getEffectiveDateLabel(el);
    }

    // spec 위젯 data 재fetch (override 반영)
    if (el.dataset.widgetSpec === '1' && el.dataset.widgetId) {
      var bodyEl = el.querySelector('.widget-body');
      if (bodyEl) renderSpecWidget(bodyEl.id, el.dataset.widgetId);
    }

    saveDashboard();
    closeEditModal();
    showToast('"' + newTitle + '" 위젯을 수정했습니다');
  });

  // ESC to close picker & kebab & context & edit
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closePicker();
      kebabMenu.classList.remove('open');
      ctxMenu.classList.remove('open');
      closeEditModal();
    }
  });
});

})();
