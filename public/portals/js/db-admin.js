/**
 * RTBIO Prototype — DB 탐색기 (전체 테이블 브라우저)
 *
 * 서버 레지스트리(registry.ts)가 보안 경계. 화이트리스트 테이블만 조회되고,
 * 설정성 4개 테이블(OrgOption·KanbanColumn·TenantSetting·Notice)만 editableFields 범위에서 편집된다.
 *
 * - 의존성: shared.js (showModal, showToast), shared-ui.js (escapeHtmlSafe)
 * - 백엔드:
 *     GET   /api/db-explorer                  → [{key,label,group,editable}]
 *     GET   /api/db-explorer/{key}?q&limit&offset → {ok,rows,columns,total,editable,editableFields,pkField}
 *     PATCH /api/db-explorer/{key}/{id}        → {ok} (editable 테이블만)
 * - 권한: ['ADMIN','TENANT_OWNER'].includes(window.CURRENT_USER.role) 일 때만 노출/init
 *
 * 사용:
 *   1. HTML 에 컨테이너: <div id="db-admin"></div>
 *   2. <script src="/portals/js/db-admin.js"></script> 로드
 *   3. 진입 시(게이트 통과): loadDbTables()
 */

// ── 안전한 JSON 파싱 가드 (staff-mgmt 의 _staffSafeJson 과 동일 철학) ──
// requireMetaAdmin 거부 시 307 → /403 HTML. fetch follow → r.ok=true 지만 json() 실패.
// content-type 검사로 크래시 방지.
async function _dbSafeJson(r) {
  if (!r || !r.ok) return null;
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) return null;
  try { return await r.json(); } catch { return null; }
}

// HTML escape (shared-ui.js 의 escapeHtmlSafe 우선, 없으면 폴백)
function _dbEsc(s) {
  if (typeof escapeHtmlSafe === 'function') return escapeHtmlSafe(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── 모듈 상태 ───────────────────────────────────────────────────────
// 현재 보고 있는 테이블/페이지/검색어 + 마지막 조회 결과(편집 시 행 찾기에 사용).
var _DBX = {
  tables: [],          // 테이블 목록 (피커용)
  key: null,           // 현재 테이블 key
  q: '',               // 검색어
  limit: 50,
  offset: 0,
  total: 0,
  columns: [],         // [{name,type}]
  rows: [],            // 현재 페이지 행
  editable: false,
  editableFields: null, // {field: 'string'|'int'|'boolean'|'datetime'}
  pkField: 'id',
};

// ── 셀 값 포맷 ──────────────────────────────────────────────────────
// null→'-', boolean→✓/✗, ISO datetime 문자열→'YYYY-MM-DD HH:MM', number→로캘콤마, else 문자열.
// Prisma Decimal 은 JSON 직렬화 시 문자열로 옴 → 숫자처럼 보이면 콤마 포맷.
function _dbFormatVal(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (typeof v === 'number') return v.toLocaleString('ko-KR');
  if (typeof v === 'string') {
    // ISO 8601 datetime (예: 2026-06-02T09:30:00.000Z) → 분 단위까지
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16).replace('T', ' ');
    // Decimal/숫자 문자열 → 콤마 (소수/정수, 너무 길지 않은 것만)
    if (/^-?\d+(\.\d+)?$/.test(v) && v.length <= 15) {
      const n = Number(v);
      if (Number.isFinite(n)) return n.toLocaleString('ko-KR');
    }
    return v;
  }
  // 객체/배열 (방어적) → JSON 축약
  try { return JSON.stringify(v); } catch { return String(v); }
}

// ── 1) 테이블 목록 로드 + 피커 렌더 ─────────────────────────────────
async function loadDbTables() {
  const host = document.getElementById('db-admin');
  if (!host) return;
  // 게이트: metaAdmin 만
  const u = window.CURRENT_USER;
  if (!(u && ['ADMIN', 'TENANT_OWNER'].includes(u.role))) {
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  host.style.display = '';

  host.innerHTML = `<div class="text-sm text-muted" style="padding:16px;">전체 테이블 목록 불러오는 중...</div>`;

  let tables = null;
  try {
    const r = await fetch('/api/db-explorer', { credentials: 'same-origin' });
    tables = await _dbSafeJson(r);
  } catch { tables = null; }

  if (!Array.isArray(tables) || tables.length === 0) {
    host.innerHTML = `<div class="empty-state" style="padding:24px;">
      <div class="empty-state-text" style="color:var(--danger);">테이블 목록을 불러오지 못했습니다. 권한이 없거나 세션이 만료되었을 수 있습니다.</div>
    </div>`;
    return;
  }
  _DBX.tables = tables;

  // group 별로 묶어 <optgroup>
  const byGroup = {};
  tables.forEach((t) => { (byGroup[t.group] = byGroup[t.group] || []).push(t); });
  const optgroups = Object.keys(byGroup).map((g) => {
    const opts = byGroup[g]
      .map((t) => `<option value="${_dbEsc(t.key)}">${_dbEsc(t.label)}${t.editable ? ' (편집 가능)' : ''}</option>`)
      .join('');
    return `<optgroup label="${_dbEsc(g)}">${opts}</optgroup>`;
  }).join('');

  host.innerHTML = `
    <div class="db-admin-head" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <select id="dbx-table-select" class="form-select" style="min-width:240px;" onchange="onDbTableChange(this.value)">
        <option value="">— 테이블 선택 —</option>
        ${optgroups}
      </select>
      <input type="text" id="dbx-search" class="form-input" placeholder="검색 (Enter)" style="max-width:240px;"
        onkeydown="if(event.key==='Enter'){onDbSearch();}">
      <button class="btn btn-outline btn-sm" onclick="onDbSearch()">검색</button>
      <div id="dbx-meta" class="text-sm text-muted" style="margin-left:auto;"></div>
    </div>
    <div id="dbx-grid"><div class="text-sm text-muted" style="padding:16px;">테이블을 선택하면 조회됩니다.</div></div>
    <div id="dbx-pagination" style="display:flex;align-items:center;gap:8px;margin-top:12px;"></div>
  `;
}

// 피커 변경 → 새 테이블 0페이지부터 조회 (검색어 초기화)
function onDbTableChange(key) {
  if (!key) {
    _DBX.key = null;
    const grid = document.getElementById('dbx-grid');
    if (grid) grid.innerHTML = `<div class="text-sm text-muted" style="padding:16px;">테이블을 선택하면 조회됩니다.</div>`;
    const pg = document.getElementById('dbx-pagination');
    if (pg) pg.innerHTML = '';
    const meta = document.getElementById('dbx-meta');
    if (meta) meta.textContent = '';
    return;
  }
  _DBX.key = key;
  _DBX.q = '';
  _DBX.offset = 0;
  const searchEl = document.getElementById('dbx-search');
  if (searchEl) searchEl.value = '';
  renderDbTable(key);
}

// 검색 — 현재 테이블, 0페이지부터
function onDbSearch() {
  if (!_DBX.key) return;
  _DBX.q = (document.getElementById('dbx-search')?.value || '').trim();
  _DBX.offset = 0;
  renderDbTable(_DBX.key);
}

// 페이지 이동
function dbPage(deltaPages) {
  if (!_DBX.key) return;
  const next = _DBX.offset + deltaPages * _DBX.limit;
  if (next < 0 || next >= _DBX.total) return;
  _DBX.offset = next;
  renderDbTable(_DBX.key);
}

// ── 2) 테이블 조회 + 그리드 렌더 ────────────────────────────────────
async function renderDbTable(key) {
  const grid = document.getElementById('dbx-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="text-sm text-muted" style="padding:16px;">불러오는 중...</div>`;

  const params = new URLSearchParams();
  if (_DBX.q) params.set('q', _DBX.q);
  params.set('limit', String(_DBX.limit));
  params.set('offset', String(_DBX.offset));

  let data = null;
  try {
    const r = await fetch('/api/db-explorer/' + encodeURIComponent(key) + '?' + params.toString(), {
      credentials: 'same-origin',
    });
    data = await _dbSafeJson(r);
  } catch { data = null; }

  if (!data || data.ok === false || !Array.isArray(data.columns)) {
    grid.innerHTML = `<div class="empty-state" style="padding:24px;">
      <div class="empty-state-text" style="color:var(--danger);">${_dbEsc((data && data.error) || '조회에 실패했습니다.')}</div>
    </div>`;
    const pg = document.getElementById('dbx-pagination');
    if (pg) pg.innerHTML = '';
    return;
  }

  _DBX.columns = data.columns;
  _DBX.rows = Array.isArray(data.rows) ? data.rows : [];
  _DBX.total = Number(data.total) || 0;
  _DBX.editable = !!data.editable;
  _DBX.editableFields = data.editableFields || null;
  _DBX.pkField = data.pkField || 'id';

  // 메타 정보 (현재 테이블 라벨 + 편집 가능 여부)
  const metaEl = document.getElementById('dbx-meta');
  if (metaEl) {
    const t = _DBX.tables.find((x) => x.key === key);
    const editBadge = _DBX.editable
      ? ' <span class="badge" style="background:var(--primary-lighter);color:var(--primary);font-size:11px;">편집 가능</span>'
      : ' <span class="badge" style="background:var(--bg-soft);color:var(--text-muted);font-size:11px;">읽기 전용</span>';
    metaEl.innerHTML = `<strong>${_dbEsc(t ? t.label : key)}</strong> · ${_DBX.columns.length}컬럼${editBadge}`;
  }

  if (_DBX.rows.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="padding:24px;">
      <div class="empty-state-text">표시할 행이 없습니다.</div>
    </div>`;
    _renderDbPagination();
    return;
  }

  const headCells = _DBX.columns.map((c) => `<th style="white-space:nowrap;">${_dbEsc(c.name)}</th>`).join('');
  const actionHead = _DBX.editable ? `<th style="white-space:nowrap;">액션</th>` : '';

  const bodyRows = _DBX.rows.map((row, idx) => {
    const cells = _DBX.columns.map((c) => {
      const raw = row[c.name];
      return `<td style="white-space:nowrap;">${_dbEsc(_dbFormatVal(raw))}</td>`;
    }).join('');
    let action = '';
    if (_DBX.editable) {
      const pkVal = row[_DBX.pkField];
      // pk 값을 data-속성 대신 인덱스로 넘겨 따옴표/특수문자 이슈 회피
      action = `<td><button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;" onclick="editDbRow('${_dbEsc(key)}', ${idx})">편집</button></td>`;
    }
    return `<tr>${cells}${action}</tr>`;
  }).join('');

  // class="data-table" → shared.js autoWrapTables 가 .table-scroll 로 감싸 가로 스크롤
  grid.innerHTML = `
    <table class="data-table" style="font-size:12px;">
      <thead><tr>${headCells}${actionHead}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
  // 동적 렌더라 autoWrapTables 를 직접 호출 (goTo 외 경로)
  if (typeof autoWrapTables === 'function') autoWrapTables(grid);

  _renderDbPagination();
}

function _renderDbPagination() {
  const pg = document.getElementById('dbx-pagination');
  if (!pg) return;
  const from = _DBX.total === 0 ? 0 : _DBX.offset + 1;
  const to = Math.min(_DBX.offset + _DBX.limit, _DBX.total);
  const hasPrev = _DBX.offset > 0;
  const hasNext = _DBX.offset + _DBX.limit < _DBX.total;
  pg.innerHTML = `
    <button class="btn btn-outline btn-sm" ${hasPrev ? '' : 'disabled'} onclick="dbPage(-1)">◀ 이전</button>
    <span class="text-sm" style="font-weight:600;">${from.toLocaleString('ko-KR')}–${to.toLocaleString('ko-KR')}</span>
    <button class="btn btn-outline btn-sm" ${hasNext ? '' : 'disabled'} onclick="dbPage(1)">다음 ▶</button>
    <span class="text-sm text-muted" style="margin-left:8px;">총 ${_DBX.total.toLocaleString('ko-KR')}건</span>
  `;
}

// ── 3) 행 편집 모달 (editableFields 만) ─────────────────────────────
// 필수 문자열 필드(label/title/body) 클라 검증: 빈값이면 submit 차단.
var _DBX_REQUIRED_STRINGS = ['label', 'title', 'body'];

function editDbRow(key, rowIdx) {
  const row = _DBX.rows[rowIdx];
  if (!row) { showToast('행을 찾을 수 없습니다. 다시 조회하세요.', 'error'); return; }
  if (!_DBX.editable || !_DBX.editableFields) { showToast('편집할 수 없는 테이블입니다.', 'error'); return; }
  const pkVal = row[_DBX.pkField];
  if (pkVal === null || pkVal === undefined) { showToast('기본키 값을 찾을 수 없습니다.', 'error'); return; }

  // editableFields → 타입별 input
  const fieldsHtml = Object.keys(_DBX.editableFields).map((field) => {
    const ftype = _DBX.editableFields[field];
    const cur = row[field];
    const required = _DBX_REQUIRED_STRINGS.includes(field);
    const labelHtml = `<label>${_dbEsc(field)}${required ? ' *' : ''} <span style="color:var(--text-muted);font-weight:normal;">(${_dbEsc(ftype)})</span></label>`;
    let inputHtml;
    if (ftype === 'boolean') {
      inputHtml = `<label class="de-toggle"><input type="checkbox" id="dbx-f-${_dbEsc(field)}" ${cur ? 'checked' : ''}> ${cur ? '✓ 켜짐' : '꺼짐'}</label>`;
    } else if (ftype === 'int') {
      inputHtml = `<input type="number" step="1" id="dbx-f-${_dbEsc(field)}" value="${cur === null || cur === undefined ? '' : _dbEsc(cur)}">`;
    } else if (ftype === 'datetime') {
      // ISO → datetime-local (YYYY-MM-DDTHH:MM)
      const dl = (typeof cur === 'string' && cur) ? cur.slice(0, 16) : '';
      inputHtml = `<input type="datetime-local" id="dbx-f-${_dbEsc(field)}" value="${_dbEsc(dl)}">`;
    } else {
      // string — body 류는 textarea
      if (field === 'body') {
        inputHtml = `<textarea id="dbx-f-${_dbEsc(field)}" rows="4">${_dbEsc(cur === null || cur === undefined ? '' : cur)}</textarea>`;
      } else {
        inputHtml = `<input type="text" id="dbx-f-${_dbEsc(field)}" value="${_dbEsc(cur === null || cur === undefined ? '' : cur)}">`;
      }
    }
    return `<div class="de-field">${labelHtml}${inputHtml}</div>`;
  }).join('');

  const t = _DBX.tables.find((x) => x.key === key);
  _openDbFormModal((t ? t.label : key) + ' 편집', `
    <div class="modal-form">
      <div id="dbx-form-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      <div class="de-hint" style="margin-bottom:10px;">${_dbEsc(_DBX.pkField)} = <code>${_dbEsc(String(pkVal))}</code></div>
      ${fieldsHtml}
      <div class="form-actions">
        <button class="btn btn-outline" onclick="_dbCloseModal()">취소</button>
        <button class="btn btn-primary" id="dbx-submit-btn" onclick="_submitDbRow('${_dbEsc(key)}', ${rowIdx})">저장</button>
      </div>
    </div>
  `);
}

async function _submitDbRow(key, rowIdx) {
  const row = _DBX.rows[rowIdx];
  if (!row) { _setDbFormError('행을 찾을 수 없습니다.'); return; }
  const pkVal = row[_DBX.pkField];
  const btn = document.getElementById('dbx-submit-btn');
  _setDbFormError('');

  // editableFields 값 수집 + 클라 검증
  const patch = {};
  for (const field of Object.keys(_DBX.editableFields || {})) {
    const ftype = _DBX.editableFields[field];
    const el = document.getElementById('dbx-f-' + field);
    if (!el) continue;
    if (ftype === 'boolean') {
      patch[field] = !!el.checked;
    } else {
      const val = el.value;
      // 필수 문자열 빈값 차단
      if (_DBX_REQUIRED_STRINGS.includes(field) && (!val || !String(val).trim())) {
        _setDbFormError(field + ' 은(는) 비워둘 수 없습니다.');
        return;
      }
      patch[field] = val;
    }
  }

  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const r = await fetch('/api/db-explorer/' + encodeURIComponent(key) + '/' + encodeURIComponent(String(pkVal)), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(patch),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      _setDbFormError((data && data.error) ? data.error : '저장에 실패했습니다.');
      if (btn) { btn.disabled = false; btn.textContent = '저장'; }
      return;
    }
    _dbCloseModal();
    showToast('저장되었습니다.', 'success');
    renderDbTable(key); // 현재 페이지 재조회
  } catch (err) {
    _setDbFormError(err.message || '저장 실패 (네트워크 오류)');
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

// ── 공통: 폼 모달 (staff-mgmt 패턴 — footer 숨김 + 자체 버튼) ────────
function _openDbFormModal(title, bodyHTML) {
  showModal(title, bodyHTML);
  const overlay = document.querySelector('.modal-overlay');
  const footer = overlay?.querySelector('.modal-footer');
  if (footer) footer.style.display = 'none';
  return overlay;
}
function _dbCloseModal() {
  document.querySelector('.modal-overlay')?.remove();
}
function _setDbFormError(msg) {
  const el = document.getElementById('dbx-form-error');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}

// ── window 노출 (onclick 핸들러용) ──────────────────────────────────
if (typeof window !== 'undefined') {
  window.loadDbTables = loadDbTables;
  window.onDbTableChange = onDbTableChange;
  window.onDbSearch = onDbSearch;
  window.dbPage = dbPage;
  window.renderDbTable = renderDbTable;
  window.editDbRow = editDbRow;
  window._submitDbRow = _submitDbRow;
  window._dbCloseModal = _dbCloseModal;
}
