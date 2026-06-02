/* ══════════════════════════════════════════
   Widget Builder — 갤러리 + (Phase B) 빌더
   ──────────────────────────────────────────
   widget-dashboard.js 의 spec 엔진/그리드 헬퍼를 재사용한다.
   - window.renderSpecResult / window.addSpecWidgetToGrid / window.closePicker / window.showToast
   ══════════════════════════════════════════ */
(function () {
'use strict';

var _catalog = null;       // data-catalog 응답 캐시 ({ catalog, kinds, aggregates, ... })
var _galleryCache = null;  // widget-schema.examples 캐시

/* ── 소형 헬퍼 ── */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _$(id) { return document.getElementById(id); }
function _val(id) { var el = _$(id); return el ? el.value : ''; }

var _KIND_LABELS = {
  kpi: 'KPI', bar: '세로 막대', hbar: '가로 막대', line: '선 그래프',
  pie: '파이', donut: '도넛', table: '표', gauge: '게이지'
};
function _kindLabel(kind) {
  return _KIND_LABELS[kind] || (kind || '위젯');
}

var _SOURCE_LABELS = {
  invoice: '거래명세서', payment: '수금', order: '주문', client: '거래처',
  product: '제품', inventory: '재고', ledger: '거래처원장', shipment: '출고'
};
function _sourceLabel(source) {
  return _SOURCE_LABELS[source] || (source || '');
}

var _AGG_LABELS = {
  sum: '합계', count: '건수', avg: '평균', min: '최솟값', max: '최댓값', countDistinct: '고유개수'
};
function _aggLabel(t) { return _AGG_LABELS[t] || t; }

var _OP_LABELS = {
  eq: '같음(=)', ne: '다름(≠)', gt: '초과(>)', gte: '이상(≥)', lt: '미만(<)', lte: '이하(≤)',
  in: '포함(in)', notIn: '제외(notIn)', contains: '검색(contains)', startsWith: '시작(startsWith)', between: '범위(between)'
};
function _opLabel(op) { return _OP_LABELS[op] || op; }

// 차트 종류별 데이터 형태 요구사항
function _needsGroupBy(kind) { return kind === 'bar' || kind === 'hbar' || kind === 'line' || kind === 'pie' || kind === 'donut'; }
function _needsAggregate(kind) { return kind !== 'table'; }

/* ── 갤러리: prefab spec 카드 ── */
async function loadGallery() {
  var grid = _$('galleryGrid');
  if (!grid) return;
  try {
    var r = await fetch('/api/dashboard/widget-schema', { credentials: 'same-origin' });
    var j = await r.json();
    _galleryCache = (j && j.examples) || {};
    var keys = Object.keys(_galleryCache);
    if (!keys.length) { grid.innerHTML = '<div class="gallery-loading">갤러리가 비어 있습니다</div>'; return; }
    grid.innerHTML = keys.map(function (key) {
      var spec = _galleryCache[key];
      return '<button class="gallery-card" data-key="' + _esc(key) + '">' +
        '<span class="gallery-card-kind">' + _esc(_kindLabel(spec.kind)) + '</span>' +
        '<span class="gallery-card-title">' + _esc(spec.title) + '</span>' +
        '<span class="gallery-card-sub">' + _esc(spec.subtitle || _sourceLabel(spec.data && spec.data.source)) + '</span>' +
        '</button>';
    }).join('');
    grid.querySelectorAll('.gallery-card').forEach(function (btn) {
      btn.addEventListener('click', function () { addFromGallery(btn.dataset.key); });
    });
  } catch (e) {
    grid.innerHTML = '<div class="gallery-loading">갤러리 로드 실패</div>';
    // eslint-disable-next-line no-console
    console.warn('[widget-builder] 갤러리 로드 실패', e);
  }
}

/* ── 갤러리 카드 클릭 → spec 저장 + 그리드 추가 ── */
async function addFromGallery(key) {
  var spec = _galleryCache[key];
  if (!spec) return;
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec }),
    });
    var j = await r.json();
    if (!r.ok || !j.ok) { window.showToast('추가 실패: ' + ((j.validationErrors && j.validationErrors[0] && j.validationErrors[0].message) || j.error || '')); return; }
    window.addSpecWidgetToGrid(j.spec, j.id);
    window.closePicker(); window.showToast('"' + spec.title + '" 위젯을 추가했습니다');
  } catch (e) { window.showToast('네트워크 오류'); }
}

/* ══════════════════════════════════════════
   Phase B — 빌더
   ══════════════════════════════════════════ */

/* ── data-catalog 1회 로드 ── */
async function ensureCatalog() {
  if (_catalog) return _catalog;
  try {
    var r = await fetch('/api/dashboard/data-catalog', { credentials: 'same-origin' });
    var j = await r.json();
    _catalog = (j && j.catalog) ? j : null;
  } catch (e) {
    _catalog = null;
    // eslint-disable-next-line no-console
    console.warn('[widget-builder] data-catalog 로드 실패', e);
  }
  return _catalog;
}

/* ── select 옵션 헬퍼 ── */
function _setOptions(id, opts, selected) {
  var el = _$(id);
  if (!el) return;
  el.innerHTML = opts.map(function (o) {
    var sel = (o.value === selected) ? ' selected' : '';
    return '<option value="' + _esc(o.value) + '"' + sel + '>' + _esc(o.label) + '</option>';
  }).join('');
}

function _fillSourceSelect(catalog) {
  var keys = Object.keys(catalog || {});
  _setOptions('bSource', keys.map(function (k) {
    var label = (catalog[k] && catalog[k].label) || _sourceLabel(k) || k;
    return { value: k, label: label + ' (' + k + ')' };
  }));
}

function _fillKindSelect(kinds) {
  var list = (kinds && kinds.length) ? kinds : ['kpi', 'bar', 'hbar', 'line', 'pie', 'donut', 'table', 'gauge'];
  _setOptions('bKind', list.map(function (k) { return { value: k, label: _kindLabel(k) }; }));
}

// 현재 소스의 필드 메타 { name: {type, agg?, values?, desc} }
function _currentFields() {
  if (!_catalog) return {};
  var src = _val('bSource');
  var entry = _catalog.catalog && _catalog.catalog[src];
  return (entry && entry.fields) || {};
}

/* ── 소스 변경 → 측정값/분류/필터 필드 종속 갱신 ── */
function _onSourceChange() {
  var fields = _currentFields();
  var names = Object.keys(fields);
  var aggNames = names.filter(function (n) { return fields[n] && fields[n].agg; });

  // 집계 함수 select (소스 무관, 카탈로그의 aggregates 사용)
  var aggs = (_catalog && _catalog.aggregates) || ['sum', 'count', 'avg', 'min', 'max', 'countDistinct'];
  _setOptions('bAggType', aggs.map(function (a) { return { value: a, label: _aggLabel(a) }; }), 'sum');

  // 측정 대상 필드 — agg:true 필드만 (+ count 는 필드 불필요 → '건수(행 수)' 옵션)
  var aggFieldOpts = [{ value: '', label: '— (건수/행 수)' }].concat(
    aggNames.map(function (n) { return { value: n, label: (fields[n].desc || n) + ' [' + n + ']' }; })
  );
  _setOptions('bAggField', aggFieldOpts);

  // 분류(그룹) 필드 — 전체 필드
  _setOptions('bGroupBy', [{ value: '', label: '— 없음' }].concat(
    names.map(function (n) { return { value: n, label: (fields[n].desc || n) + ' [' + n + ']' }; })
  ));

  // 정렬 기준 필드 — 전체 필드
  _setOptions('bOrderField', [{ value: '', label: '— 기본' }].concat(
    names.map(function (n) { return { value: n, label: (fields[n].desc || n) + ' [' + n + ']' }; })
  ));

  // 필터 행 초기화
  var box = _$('bFilters');
  if (box) box.innerHTML = '';

  _onKindChange();
}

/* ── 차트 종류 변경 → 측정값/분류 영역 표시 제어 ── */
function _onKindChange() {
  var kind = _val('bKind');
  var measure = _$('bMeasure');
  var groupField = _$('bGroupByField');
  var orderRow = _$('bOrderRow');
  if (measure) measure.style.display = _needsAggregate(kind) ? '' : 'none';
  if (groupField) groupField.style.display = _needsGroupBy(kind) ? '' : 'none';
  // 정렬/limit 는 table 과 (top-N 으로 쓰는) 차트에 유용 — kpi 에서는 숨김
  if (orderRow) orderRow.style.display = (kind === 'kpi') ? 'none' : '';
}

/* ── 필터 행 — operator + 값 + 템플릿 도우미 ── */
var _TPL_OPTS = [
  { value: '', label: '직접입력' },
  { value: '{{now.startOfMonth}}', label: '이번 달 시작' },
  { value: '{{today}}', label: '오늘' },
  { value: "{{now.minus(30,'day')}}", label: '30일 전' },
];

function _addFilterRow() {
  var box = _$('bFilters');
  if (!box) return;
  var fields = _currentFields();
  var names = Object.keys(fields);
  if (!names.length) return;

  var ops = (_catalog && _catalog.operators) || ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'contains', 'startsWith', 'between'];

  var row = document.createElement('div');
  row.className = 'bfilter-row';
  row.innerHTML =
    '<select class="bf-field">' + names.map(function (n) {
      return '<option value="' + _esc(n) + '">' + _esc((fields[n].desc || n)) + '</option>';
    }).join('') + '</select>' +
    '<select class="bf-op">' + ops.map(function (o) {
      return '<option value="' + _esc(o) + '">' + _esc(_opLabel(o)) + '</option>';
    }).join('') + '</select>' +
    '<select class="bf-tpl">' + _TPL_OPTS.map(function (t) {
      return '<option value="' + _esc(t.value) + '">' + _esc(t.label) + '</option>';
    }).join('') + '</select>' +
    '<input class="bf-val" type="text" placeholder="값 (in 은 콤마구분)">' +
    '<button class="bf-del" type="button" title="삭제">✕</button>';

  // 템플릿 select → 값 input 자동 채움 + 비활성
  var tplSel = row.querySelector('.bf-tpl');
  var valInput = row.querySelector('.bf-val');
  tplSel.addEventListener('change', function () {
    if (tplSel.value) { valInput.value = tplSel.value; valInput.disabled = true; }
    else { valInput.disabled = false; valInput.value = ''; valInput.focus(); }
  });
  row.querySelector('.bf-del').addEventListener('click', function () { row.remove(); });

  box.appendChild(row);
}

/* ══════════════════════════════════════════
   빌더 열기/닫기
   ══════════════════════════════════════════ */
function openBuilder() {
  ensureCatalog().then(function (cat) {
    if (!cat) { window.showToast('카탈로그 로드 실패'); return; }
    _fillSourceSelect(cat.catalog);
    _fillKindSelect(cat.kinds);
    _onSourceChange();           // 측정값/분류/필터/정렬 필드 채움 + kind 표시 제어
    var ov = _$('builderOverlay');
    if (ov) ov.classList.add('open');
    if (window.closePicker) window.closePicker();
  });
}

function closeBuilder() {
  var ov = _$('builderOverlay');
  if (ov) ov.classList.remove('open');
}

/* ── 빌더 이벤트 배선 ── */
function _wireBuilder() {
  var open = _$('btnOpenBuilder');
  if (open) open.addEventListener('click', openBuilder);

  var cancel = _$('bCancel');
  if (cancel) cancel.addEventListener('click', closeBuilder);
  var close = _$('bClose');
  if (close) close.addEventListener('click', closeBuilder);

  // overlay 배경 클릭 → 닫기
  var ov = _$('builderOverlay');
  if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeBuilder(); });

  var addFilter = _$('bAddFilter');
  if (addFilter) addFilter.addEventListener('click', function () { _addFilterRow(); });

  // 소스 변경 → 종속 필드 갱신
  var src = _$('bSource');
  if (src) src.addEventListener('change', function () { _onSourceChange(); });

  // 차트 변경 → 영역 표시 제어
  var kind = _$('bKind');
  if (kind) kind.addEventListener('change', function () { _onKindChange(); });
}

/* ── 갤러리 lazy-load 훅 + 빌더 배선 ── */
document.addEventListener('DOMContentLoaded', function () {
  window.onPickerOpen = function () { if (!_galleryCache) loadGallery(); };
  _wireBuilder();
});

})();
