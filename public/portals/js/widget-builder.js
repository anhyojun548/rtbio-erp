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
var _pvTimer = null;       // dry-run 미리보기 debounce 타이머
var _editingWidgetId = null; // 편집 모드면 대상 위젯의 DB id, 신규면 null

/* ── 소형 헬퍼 ── */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _$(id) { return document.getElementById(id); }
function _val(id) { var el = _$(id); return el ? el.value : ''; }
function _setVal(id, v) { var el = _$(id); if (el) el.value = (v == null ? '' : v); }

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

/* ══════════════════════════════════════════
   공통 저장 — spec 을 POST(저장) 하고 {id, spec} 반환 (실패 시 throw)
   갤러리/빌더 양쪽이 재사용 (DRY).
   ══════════════════════════════════════════ */
async function _saveSpec(spec) {
  var r, j;
  try {
    r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec }),
    });
    j = await r.json();
  } catch (e) {
    throw new Error('네트워크 오류');
  }
  if (!r.ok || !j || !j.ok) {
    var msg = (j && j.validationErrors && j.validationErrors[0] && (j.validationErrors[0].hint || j.validationErrors[0].message)) ||
      (j && j.error) || '저장 실패';
    throw new Error(msg);
  }
  return { id: j.id, spec: j.spec };
}

/* ── 갤러리 카드 클릭 → spec 저장 + 그리드 추가 ── */
async function addFromGallery(key) {
  var spec = _galleryCache[key];
  if (!spec) return;
  try {
    var res = await _saveSpec(spec);
    window.addSpecWidgetToGrid(res.spec, res.id);
    window.closePicker();
    window.showToast('"' + spec.title + '" 위젯을 추가했습니다');
  } catch (e) {
    window.showToast('추가 실패: ' + (e && e.message ? e.message : ''));
  }
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
    schedulePreview();
  });
  row.querySelector('.bf-del').addEventListener('click', function () { row.remove(); schedulePreview(); });
  // 행 내부 변경 → 미리보기
  row.querySelector('.bf-field').addEventListener('change', schedulePreview);
  row.querySelector('.bf-op').addEventListener('change', schedulePreview);
  valInput.addEventListener('input', schedulePreview);

  box.appendChild(row);
}

// in/notIn/between 은 배열, 그 외는 스칼라. 숫자/불리언/템플릿 자동 추론.
function _coerceFilterValue(op, raw) {
  if (op === 'in' || op === 'notIn' || op === 'between') {
    return raw.split(',').map(function (s) { return _coerceScalar(s.trim()); });
  }
  return _coerceScalar(raw);
}
function _coerceScalar(s) {
  if (s === '') return s;
  if (/^\{\{.*\}\}$/.test(s)) return s;            // 템플릿 변수는 문자열 유지
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s); // 순수 숫자
  return s;
}

// 필터 행들 → { field: { op: value } }
function _collectFilters() {
  var out = {};
  var rows = document.querySelectorAll('#bFilters .bfilter-row');
  rows.forEach(function (row) {
    var field = row.querySelector('.bf-field').value;
    var op = row.querySelector('.bf-op').value;
    var raw = row.querySelector('.bf-val').value;
    if (!field || !op || raw === '') return;
    if (!out[field]) out[field] = {};
    out[field][op] = _coerceFilterValue(op, raw);
  });
  return out;
}

/* ══════════════════════════════════════════
   폼 → WidgetSpec 조립
   규칙:
     kpi   → aggregate 필수, groupBy 없음
     차트  → groupBy 필수 + aggregate
     table → aggregate 없음, orderBy/limit
   ══════════════════════════════════════════ */
function buildSpecFromForm() {
  var kind = _val('bKind');
  var source = _val('bSource');
  var layout = kind === 'table'
    ? { w: 6, h: 4 }
    : (kind === 'kpi' ? { w: 3, h: 2 } : { w: 6, h: 4 });

  var spec = {
    version: '1.0',
    title: _val('bTitle') || '제목 없음',
    kind: kind,
    layout: layout,
    data: { source: source },
  };

  // 필터
  var filter = _collectFilters();
  if (Object.keys(filter).length) spec.data.filter = filter;

  // 측정값 (table 제외)
  if (_needsAggregate(kind)) {
    var aggType = _val('bAggType');
    var aggField = _val('bAggField');
    if (aggType) {
      spec.data.aggregate = { type: aggType, field: aggField || null };
    }
  }

  // 분류 (차트만)
  if (_needsGroupBy(kind)) {
    var groupBy = _val('bGroupBy');
    if (groupBy) spec.data.groupBy = [groupBy];
  }

  // 정렬/limit (table 또는 정렬 기준 선택 시 — top-N)
  if (kind !== 'kpi') {
    var orderField = _val('bOrderField');
    if (orderField) {
      spec.data.orderBy = [{ field: orderField, dir: _val('bOrderDir') || 'desc' }];
    }
    var limitRaw = _val('bLimit');
    if (limitRaw) {
      var lim = parseInt(limitRaw, 10);
      if (lim > 0) spec.data.limit = Math.min(100, lim);
    }
  }

  return spec;
}

/* ── 저장 버튼 활성/비활성 ── */
function _setSaveEnabled(on) {
  var btn = _$('bSave');
  if (btn) btn.disabled = !on;
}

/* ══════════════════════════════════════════
   실시간 dry-run 미리보기 (debounce 400ms)
   dry-run 실패 시 친절 에러 + 저장 비활성 → 잘못된 위젯 저장 방지
   ══════════════════════════════════════════ */
function schedulePreview() {
  if (_pvTimer) clearTimeout(_pvTimer);
  _pvTimer = setTimeout(previewBuilder, 400);
}

async function previewBuilder() {
  var box = _$('bPreview');
  if (!box) return;
  var spec = buildSpecFromForm();
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec, dryRunOnly: true }),
    });
    var j = await r.json();
    if (!r.ok || !j || !j.ok) {
      var hint = (j && j.validationErrors && j.validationErrors[0] && (j.validationErrors[0].hint || j.validationErrors[0].message)) ||
        (j && j.error) || '미리보기 실패';
      box.innerHTML = '<div class="builder-err">' + _esc(hint) + '</div>';
      _setSaveEnabled(false);
      return;
    }
    box.innerHTML = '<div class="widget-body" id="bPreviewBody"></div>';
    window.renderSpecResult(_$('bPreviewBody'), {
      ok: true, result: j.preview, kind: spec.kind, title: spec.title,
      subtitle: spec.subtitle, format: spec.format, style: spec.style,
    });
    _setSaveEnabled(true);
  } catch (e) {
    box.innerHTML = '<div class="builder-err">네트워크 오류</div>';
    _setSaveEnabled(false);
  }
}

/* ══════════════════════════════════════════
   편집 프리필 — spec → 폼 (buildSpecFromForm 역방향)
   순서 중요: source → _onSourceChange(옵션 채움 + 필터행 초기화)
              → kind → _onKindChange(표시제어)
              → 측정/분류/정렬 값(옵션 존재해야 적용됨) → 제목 → 필터행 재구성(마지막)
   ══════════════════════════════════════════ */
function fillFormFromSpec(spec) {
  var data = (spec && spec.data) || {};

  // 1) 소스 → 종속 필드 옵션 채움 + 필터행 비움
  _setVal('bSource', data.source || '');
  _onSourceChange();

  // 2) 차트 종류 → 측정/분류/정렬 영역 표시 제어
  _setVal('bKind', spec.kind || '');
  _onKindChange();

  // 3) 측정값 (옵션은 _onSourceChange 가 이미 생성)
  var agg = data.aggregate || {};
  _setVal('bAggType', agg.type || '');
  _setVal('bAggField', agg.field || '');

  // 4) 분류(그룹)
  _setVal('bGroupBy', (data.groupBy && data.groupBy[0]) || '');

  // 5) 정렬/limit
  var ob = (data.orderBy && data.orderBy[0]) || null;
  _setVal('bOrderField', (ob && ob.field) || '');
  _setVal('bOrderDir', (ob && ob.dir) || 'desc');
  _setVal('bLimit', data.limit != null ? String(data.limit) : '');

  // 6) 제목
  _setVal('bTitle', spec.title || '');

  // 7) 필터행 재구성 — { field: { op: value } }
  var filter = data.filter || {};
  Object.keys(filter).forEach(function (field) {
    var ops = filter[field] || {};
    Object.keys(ops).forEach(function (op) {
      var value = ops[op];
      _addFilterRow();
      var rows = document.querySelectorAll('#bFilters .bfilter-row');
      var row = rows[rows.length - 1];
      if (!row) return;
      var fieldSel = row.querySelector('.bf-field');
      var opSel = row.querySelector('.bf-op');
      var tplSel = row.querySelector('.bf-tpl');
      var valInput = row.querySelector('.bf-val');
      if (fieldSel) fieldSel.value = field;
      if (opSel) opSel.value = op;

      if (Array.isArray(value)) {
        // in/notIn/between → 콤마 조인
        if (valInput) valInput.value = value.join(',');
      } else if (typeof value === 'string' && /^\{\{.*\}\}$/.test(value)) {
        // 템플릿 변수 → bf-tpl 세팅 (change 핸들러가 val 채움+disable)
        if (tplSel) {
          tplSel.value = value;
          // 템플릿이 _TPL_OPTS 목록에 없으면 option 으로 추가 후 선택
          if (tplSel.value !== value) {
            var opt = document.createElement('option');
            opt.value = value; opt.textContent = value;
            tplSel.appendChild(opt);
            tplSel.value = value;
          }
          tplSel.dispatchEvent(new Event('change'));
        } else if (valInput) {
          valInput.value = value;
        }
      } else if (valInput) {
        valInput.value = String(value);
      }
    });
  });
}

/* ══════════════════════════════════════════
   빌더 열기/닫기
   ══════════════════════════════════════════ */
function openBuilder(editSpec, editWidgetId) {
  ensureCatalog().then(function (cat) {
    if (!cat) { window.showToast('카탈로그 로드 실패'); return; }
    _fillSourceSelect(cat.catalog);
    _fillKindSelect(cat.kinds);
    if (editSpec) {
      _editingWidgetId = editWidgetId || null;
      fillFormFromSpec(editSpec);   // 현재 spec 으로 폼 프리필 (필드 옵션 + 필터행 포함)
    } else {
      _editingWidgetId = null;
      _onSourceChange();           // 신규: 측정값/분류/필터/정렬 필드 채움 + kind 표시 제어
    }
    _setSaveEnabled(false);
    var box = _$('bPreview');
    if (box) box.innerHTML = '<div class="builder-hint">소스와 측정값을 선택하면 실데이터 미리보기가 표시됩니다.</div>';
    var ov = _$('builderOverlay');
    if (ov) ov.classList.add('open');
    if (window.closePicker) window.closePicker();
    schedulePreview();           // 초기 미리보기 시도
  });
}

function closeBuilder() {
  var ov = _$('builderOverlay');
  if (ov) ov.classList.remove('open');
  if (_pvTimer) { clearTimeout(_pvTimer); _pvTimer = null; }
  _editingWidgetId = null;     // 편집 상태 해제 (취소/닫기 시 다음 신규에 누수 방지)
}

/* ── 저장 → 그리드 추가 (갤러리와 동일 _saveSpec 경로) ── */
async function saveBuilder() {
  var spec = buildSpecFromForm();
  try {
    var res = await _saveSpec(spec);
    window.addSpecWidgetToGrid(res.spec, res.id);
    closeBuilder();
    window.showToast('"' + (res.spec.title || spec.title) + '" 위젯을 추가했습니다');
  } catch (e) {
    var box = _$('bPreview');
    if (box) box.innerHTML = '<div class="builder-err">' + _esc(e && e.message ? e.message : '저장 실패') + '</div>';
    _setSaveEnabled(false);
  }
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

  var save = _$('bSave');
  if (save) save.addEventListener('click', saveBuilder);

  // 소스 변경 → 종속 필드 갱신 + 미리보기
  var src = _$('bSource');
  if (src) src.addEventListener('change', function () { _onSourceChange(); schedulePreview(); });

  // 차트 변경 → 영역 표시 제어 + 미리보기
  var kind = _$('bKind');
  if (kind) kind.addEventListener('change', function () { _onKindChange(); schedulePreview(); });

  // 나머지 폼 변경 → 미리보기
  ['bTitle', 'bAggType', 'bAggField', 'bGroupBy', 'bOrderField', 'bOrderDir', 'bLimit'].forEach(function (id) {
    var el = _$(id);
    if (!el) return;
    var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(ev, schedulePreview);
  });
}

/* ══════════════════════════════════════════
   편집 진입점 — 대시보드 컨텍스트 메뉴 "위젯 수정" 에서 호출.
   widgetId = DB spec id (window._specCache 키). 캐시된 spec 으로 빌더를 프리필해 연다.
   ══════════════════════════════════════════ */
window.openBuilderForEdit = function (widgetId) {
  var spec = (window._specCache || {})[widgetId];
  if (!spec) { if (window.showToast) window.showToast('스펙을 찾을 수 없습니다'); return; }
  ensureCatalog().then(function () {
    openBuilder(spec, widgetId);
  });
};

/* ── 갤러리 lazy-load 훅 + 빌더 배선 ── */
document.addEventListener('DOMContentLoaded', function () {
  window.onPickerOpen = function () { if (!_galleryCache) loadGallery(); };
  _wireBuilder();
});

})();
