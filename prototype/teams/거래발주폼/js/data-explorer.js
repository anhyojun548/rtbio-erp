/**
 * 데이터 탐색기 (DataExplorer)
 *
 * 사용: initDataExplorer({ team: 'admin'}) 를 페이지 init 에서 호출
 *
 * 기능:
 *   - 테이블 select → 권한별 자동 필터
 *   - 그리드 (정렬·필터·검색·페이지네이션)
 *   - 행 클릭 → 우측 사이드 패널 편집/이력
 *   - + 새 행 / 삭제 / 복제
 *   - CSV/Excel export (필터 적용 상태)
 *   - 모든 변경은 mock 감사로그(localStorage) 적재
 */

(function () {
  'use strict';

  // ── 상태 ──
  const State = {
    team: 'admin',
    userName: '관리자',
    currentSchema: null,
    rows: [],            // 필터링된 행
    sortBy: null,
    sortDir: 'asc',
    searchText: '',
    columnFilters: {},   // { columnId: value }
    page: 1,
    pageSize: 25,
    selectedRowKey: null,
    panelMode: null,     // 'edit'| 'create'| null
    auditLog: [],        // mock 감사로그
  };

  const LS_AUDIT_KEY = 'rtbio_de_audit';

  // ── 초기화 (포털에서 호출) ──
  window.initDataExplorer = function ({ team, userName }) {
    State.team = team || 'admin';
    State.userName = userName || '관리자';
    // 감사로그 복원
    try { State.auditLog = JSON.parse(localStorage.getItem(LS_AUDIT_KEY) || '[]'); } catch (e) {}
    // INVENTORY_FLAT 빌드
    if (typeof deInitInventoryFlat === 'function') deInitInventoryFlat();
    // 테이블 select 채우기
    const sel = document.getElementById('de-table-select');
    if (!sel) return;
    const tables = (typeof deListTablesForTeam === 'function') ? deListTablesForTeam(State.team) : [];
    sel.innerHTML = tables.map(s => `<option value="${s.key}">${s.icon} ${s.label}</option>`).join('');
    sel.addEventListener('change', () => loadTable(sel.value));
    if (tables.length > 0) {
      sel.value = tables[0].key;
      loadTable(tables[0].key);
    }
  };

  // ── 테이블 로드 ──
  function loadTable(tableKey) {
    const schema = DE_SCHEMAS[tableKey];
    if (!schema) return;
    State.currentSchema = schema;
    State.searchText = '';
    State.columnFilters = {};
    State.sortBy = null;
    State.page = 1;
    State.selectedRowKey = null;
    State.panelMode = null;
    closePanel();
    renderToolbar();
    renderFilters();
    renderGrid();
    updateActionPermissions();
  }

  // ── 행 데이터 소스 ──
  function getSourceRows() {
    const schema = State.currentSchema;
    if (!schema) return [];
    const src = window[schema.sourceVar];
    return Array.isArray(src) ? src.slice() : [];
  }

  // ── 필터/정렬/검색 적용 ──
  function applyFilters() {
    let rows = getSourceRows();
    const schema = State.currentSchema;

    // 검색
    if (State.searchText) {
      const term = State.searchText.toLowerCase();
      rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(term)));
    }
    // 컬럼 필터
    Object.entries(State.columnFilters).forEach(([col, val]) => {
      if (val === ''|| val === null || val === undefined) return;
      const colMeta = schema.columns.find(c => c.id === col);

      // 경영지원팀 #2: 가상 "기간" 필터 (오늘/이번주/이번달/3개월/올해)
      if (colMeta && colMeta.virtual && col === 'period') {
        const range = (typeof dePeriodToRange === 'function') ? dePeriodToRange(val) : null;
        if (range) {
          rows = rows.filter(r => {
            const d = String(r.date || '');
            return d >= range.from && d <= range.to;
          });
        }
        return;
      }

      // 부분일치 검색: text/textarea/email/tel — '검색' 의도
      if (colMeta && ['text','textarea','email','tel'].includes(colMeta.type)) {
        const needle = String(val).toLowerCase();
        rows = rows.filter(r => String(r[col] ?? '').toLowerCase().includes(needle));
        return;
      }

      // boolean 문자열 비교
      if (colMeta && colMeta.type === 'boolean') {
        const want = val === 'true' || val === true;
        rows = rows.filter(r => !!r[col] === want);
        return;
      }

      // 정확 일치 (select/fk/number/date)
      rows = rows.filter(r => {
        const cellVal = r[col];
        if (Array.isArray(cellVal)) return cellVal.includes(val);
        return String(cellVal ?? '') === String(val);
      });
    });
    // 정렬
    if (State.sortBy) {
      const dir = State.sortDir === 'desc'? -1 : 1;
      rows.sort((a, b) => {
        const av = a[State.sortBy], bv = b[State.sortBy];
        if (av === bv) return 0;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        return av < bv ? -dir : dir;
      });
    }
    State.rows = rows;
  }

  // ── 그리드 렌더 ──
  function renderGrid() {
    applyFilters();
    const schema = State.currentSchema;
    if (!schema) return;
    // 입출고 트랜잭션 합계 카드 동기화
    if (schema.key === 'inventoryTransaction') {
      try { renderTxnSummary(); } catch (e) {}
    }
    const cols = schema.columns.filter(c => c.inGrid !== false);

    // pagination
    const total = State.rows.length;
    const pageCount = Math.max(1, Math.ceil(total / State.pageSize));
    if (State.page > pageCount) State.page = pageCount;
    const start = (State.page - 1) * State.pageSize;
    const pageRows = State.rows.slice(start, start + State.pageSize);

    const tbody = document.getElementById('de-grid-body');
    const thead = document.getElementById('de-grid-head');
    if (!tbody || !thead) return;

    // 헤더
    thead.innerHTML = '<tr>'+
      '<th style="width:24px;"><input type="checkbox"id="de-check-all"></th>'+
      cols.map(c => {
        const sortArrow = State.sortBy === c.id ? (State.sortDir === 'asc'? '▲': '▼') : '';
        const style = `width:${c.width || 'auto'};` + (c.align ? `text-align:${c.align};` : '');
        return `<th style="${style}cursor:pointer;"onclick="DE.sortBy('${c.id}')">${c.label}${sortArrow}</th>`;
      }).join('') +
      '<th style="width:36px;"></th></tr>';

    // 바디
    if (pageRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols.length + 2}"style="padding:48px;text-align:center;color:var(--text-muted);">조건에 맞는 행이 없습니다.</td></tr>`;
    } else {
      tbody.innerHTML = pageRows.map(r => {
        const pk = r[schema.pkField];
        const rowSelected = State.selectedRowKey === pk ? 'background:var(--primary-lighter);': '';
        return `
          <tr style="${rowSelected}cursor:pointer;"onclick="DE.selectRow('${escapeJs(pk)}')">
            <td><input type="checkbox"data-row-pk="${escapeHtml(pk)}"onclick="event.stopPropagation();"></td>
            ${cols.map(c => `<td style="${c.align ? 'text-align:'+c.align+';': ''}">${formatCell(r, c, schema)}</td>`).join('')}
            <td><button class="de-row-action"onclick="event.stopPropagation();DE.openMenu('${escapeJs(pk)}',this)">⋮</button></td>
          </tr>
        `;
      }).join('');
    }

    // pagination ui
    const pageEl = document.getElementById('de-pagination');
    if (pageEl) {
      pageEl.innerHTML = `
        <button onclick="DE.gotoPage(1)"${State.page === 1 ? 'disabled': ''}>«</button>
        <button onclick="DE.gotoPage(${State.page - 1})"${State.page === 1 ? 'disabled': ''}>‹</button>
        <span class="de-page-info">${State.page} / ${pageCount}</span>
        <button onclick="DE.gotoPage(${State.page + 1})"${State.page === pageCount ? 'disabled': ''}>›</button>
        <button onclick="DE.gotoPage(${pageCount})"${State.page === pageCount ? 'disabled': ''}>»</button>
        <span class="de-total">총 ${total}건 · 페이지당
          <select onchange="DE.setPageSize(this.value)"class="de-page-size">
            <option value="10"${State.pageSize===10?'selected':''}>10</option>
            <option value="25"${State.pageSize===25?'selected':''}>25</option>
            <option value="50"${State.pageSize===50?'selected':''}>50</option>
            <option value="100"${State.pageSize===100?'selected':''}>100</option>
          </select>건
        </span>
      `;
    }
  }

  // ── 셀 포맷 ──
  function formatCell(row, col, schema) {
    let v = row[col.id];
    if (col.computed && typeof col.computed === 'function') {
      v = col.computed(row);
    }
    if (v === undefined || v === null || v === '') return '<span style="color:var(--text-muted);">—</span>';
    if (col.type === 'currency') return '₩'+ Number(v).toLocaleString('ko-KR');
    if (col.type === 'number') return Number(v).toLocaleString('ko-KR');
    if (col.type === 'boolean') return v ? '<span style="color:var(--success);">✓</span>': '<span style="color:var(--text-muted);">—</span>';
    if (col.type === 'multiselect'&& Array.isArray(v)) {
      return v.map(x => `<span class="de-tag">${escapeHtml(x)}</span>`).join('');
    }
    if (col.type === 'fk'&& col.targetTable) {
      const target = DE_SCHEMAS[col.targetTable];
      if (target) {
        const targetRows = window[target.sourceVar] || [];
        const match = targetRows.find(r => r[col.targetKey || 'id'] === v);
        if (match) return `<strong>${escapeHtml(match[col.displayField] || v)}</strong> <span style="font-size:11px;color:var(--text-muted);">${escapeHtml(v)}</span>`;
      }
    }
    return escapeHtml(String(v));
  }

  // ── 툴바 렌더 ──
  function renderToolbar() {
    const schema = State.currentSchema;
    if (!schema) return;
    const can = (a) => deCan(schema, State.team, a);
    const tb = document.getElementById('de-toolbar-actions');
    if (!tb) return;
    tb.innerHTML = `
      ${can('create') ? '<button class="btn btn-primary btn-sm"onclick="DE.openCreate()">＋ 새 행</button>': ''}
      <button class="btn btn-outline btn-sm"onclick="DE.exportCsv()"> CSV</button>
      <button class="btn btn-outline btn-sm"onclick="DE.exportExcel()"> Excel</button>
      ${can('delete') ? '<button class="btn btn-outline btn-sm"onclick="DE.deleteSelected()"style="color:var(--danger);"> 선택 삭제</button>': ''}
      <button class="btn btn-outline btn-sm"onclick="DE.showAudit()"> 감사로그 (${State.auditLog.filter(a => a.table === schema.key).length})</button>
    `;
    const titleEl = document.getElementById('de-table-title');
    if (titleEl) titleEl.innerHTML = `${schema.icon} ${schema.label} <span style="font-size:12px;color:var(--text-muted);font-weight:normal;">${schema.description}</span>`;
  }

  // ── 필터바 렌더 ──
  function renderFilters() {
    const schema = State.currentSchema;
    if (!schema) return;
    const bar = document.getElementById('de-filter-bar');
    if (!bar) return;
    const filterCols = schema.columns.filter(c => c.filter === true);
    bar.innerHTML = `
      <input type="text"class="de-search"placeholder="전체 검색..."value="${escapeHtml(State.searchText)}"oninput="DE.search(this.value)">
      ${filterCols.map(c => {
        if (c.type === 'select') {
          return `<select class="de-filter-select"onchange="DE.setFilter('${c.id}', this.value)">
            <option value="">${c.label}: 전체</option>
            ${(c.options || []).map(o => `<option value="${o}"${State.columnFilters[c.id]===o?'selected':''}>${o}</option>`).join('')}
          </select>`;
        }
        if (c.type === 'boolean') {
          return `<select class="de-filter-select"onchange="DE.setFilter('${c.id}', this.value)">
            <option value="">${c.label}: 전체</option>
            <option value="true"${State.columnFilters[c.id]==='true'?'selected':''}>예</option>
            <option value="false"${State.columnFilters[c.id]==='false'?'selected':''}>아니오</option>
          </select>`;
        }
        // 경영지원팀 #2: FK 필터 — 거래처 등 외래키 필터를 select 로 렌더
        if (c.type === 'fk' && c.targetTable) {
          const target = DE_SCHEMAS[c.targetTable];
          const targetRows = (target && window[target.sourceVar]) || [];
          return `<select class="de-filter-select"onchange="DE.setFilter('${c.id}', this.value)">
            <option value="">${c.label}: 전체</option>
            ${targetRows.map(t => {
              const v = t[c.targetKey || 'id'];
              const lbl = t[c.displayField] || v;
              return `<option value="${escapeHtml(v)}"${State.columnFilters[c.id]===v?'selected':''}>${escapeHtml(lbl)}</option>`;
            }).join('')}
          </select>`;
        }
        // 경영지원팀 #2: date 필터 — date input 으로 렌더 (=, >=, <= 비교는 가상 'period' 사용 권장)
        if (c.type === 'date') {
          return `<input type="date"class="de-filter-input"value="${escapeHtml(State.columnFilters[c.id] ?? '')}"title="${c.label}"onchange="DE.setFilter('${c.id}', this.value)">`;
        }
        return `<input type="text"class="de-filter-input"placeholder="${c.label} 검색"value="${escapeHtml(State.columnFilters[c.id] ?? '')}"oninput="DE.setFilter('${c.id}', this.value)">`;
      }).join('')}
      ${Object.values(State.columnFilters).some(v => v) || State.searchText ? '<button class="btn btn-outline btn-sm"onclick="DE.clearFilters()">필터 초기화</button>': ''}
    `;
    // 입출고 트랜잭션 테이블이면 합계 카드 렌더
    renderTxnSummary();
  }

  // ── 입출고 트랜잭션 합계 카드 (경영지원팀 #2) ───────────────────
  function renderTxnSummary() {
    const schema = State.currentSchema;
    const host = document.getElementById('de-summary-bar');
    if (!host) return;
    if (!schema || schema.key !== 'inventoryTransaction') {
      host.innerHTML = '';
      return;
    }
    applyFilters();
    const rows = State.rows;
    const inRows  = rows.filter(r => r.type === '입고');
    const outRows = rows.filter(r => r.type === '출고');
    const retRows = rows.filter(r => r.type === '반품');
    const sumQty   = (arr) => arr.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const sumSupply= (arr) => arr.reduce((s, r) => s + (Number(r.supplyAmount) || 0), 0);
    const sumTotal = (arr) => arr.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const fmt = (n) => Number(n).toLocaleString('ko-KR');

    host.innerHTML = `
      <div class="de-summary-row">
        <div class="de-summary-card de-summary-in">
          <div class="de-summary-label">입고</div>
          <div class="de-summary-value">${fmt(sumQty(inRows))}<span>개</span></div>
          <div class="de-summary-sub">${inRows.length}건 · ₩${fmt(sumTotal(inRows))}</div>
        </div>
        <div class="de-summary-card de-summary-out">
          <div class="de-summary-label">출고</div>
          <div class="de-summary-value">${fmt(sumQty(outRows))}<span>개</span></div>
          <div class="de-summary-sub">${outRows.length}건 · ₩${fmt(sumTotal(outRows))}</div>
        </div>
        <div class="de-summary-card de-summary-ret">
          <div class="de-summary-label">반품</div>
          <div class="de-summary-value">${fmt(Math.abs(sumQty(retRows)))}<span>개</span></div>
          <div class="de-summary-sub">${retRows.length}건 · ₩${fmt(Math.abs(sumTotal(retRows)))}</div>
        </div>
        <div class="de-summary-card de-summary-net">
          <div class="de-summary-label">순공급가</div>
          <div class="de-summary-value">₩${fmt(sumSupply(inRows) - sumSupply(outRows) - sumSupply(retRows))}</div>
          <div class="de-summary-sub">필터 적용 ${rows.length}건</div>
        </div>
      </div>
    `;
  }

  // ── 우측 패널 (편집/생성) ──
  function openPanel(mode, rowOrNull) {
    const schema = State.currentSchema;
    if (!schema) return;
    State.panelMode = mode;
    State.selectedRowKey = rowOrNull ? rowOrNull[schema.pkField] : null;
    const editable = (mode === 'create') ? deCan(schema, State.team, 'create') : deCan(schema, State.team, 'update');
    const panel = document.getElementById('de-panel');
    panel.classList.add('open');
    const row = rowOrNull || makeEmptyRow(schema);

    panel.innerHTML = `
      <div class="de-panel-header">
        <div>
          <div class="de-panel-title">${mode === 'create'? '＋ 새 행': '편집: '+ escapeHtml(row[schema.pkField] || '')}</div>
          <div class="de-panel-sub">${schema.icon} ${schema.label}</div>
        </div>
        <button class="de-panel-close"onclick="DE.closePanel()">✕</button>
      </div>
      <div class="de-panel-body">
        <form id="de-form"onsubmit="event.preventDefault(); DE.saveRow();">
          ${schema.columns.filter(c => c.inForm !== false).map(c => renderFormField(c, row, editable)).join('')}
        </form>
      </div>
      <div class="de-panel-actions">
        ${editable ? `<button class="btn btn-primary"onclick="DE.saveRow()">${mode === 'create'? '추가': '저장'}</button>` : ''}
        ${mode !== 'create'&& deCan(schema, State.team, 'delete') ? `<button class="btn btn-outline"style="color:var(--danger);"onclick="DE.deleteRow('${escapeJs(row[schema.pkField])}')">삭제</button>` : ''}
        <button class="btn btn-outline"onclick="DE.closePanel()">닫기</button>
      </div>
    `;
    renderGrid();
  }

  function closePanel() {
    State.panelMode = null;
    State.selectedRowKey = null;
    const panel = document.getElementById('de-panel');
    if (panel) panel.classList.remove('open');
  }

  function renderFormField(col, row, editable) {
    const v = row[col.id] ?? '';
    const disabled = !editable || col.type === 'readonly'|| col.editable === false;
    const id = `de-field-${col.id}`;
    let input;
    if (col.type === 'textarea') {
      input = `<textarea id="${id}"rows="3"${disabled?'disabled':''}>${escapeHtml(v)}</textarea>`;
    } else if (col.type === 'select') {
      input = `<select id="${id}"${disabled?'disabled':''}>
        <option value="">— 선택 —</option>
        ${(col.options || []).map(o => `<option value="${o}"${o===v?'selected':''}>${o}</option>`).join('')}
      </select>`;
    } else if (col.type === 'multiselect') {
      const vArr = Array.isArray(v) ? v : (v ? [v] : []);
      input = `<div class="de-multiselect">${(col.options || []).map(o =>
        `<label><input type="checkbox"value="${o}"${vArr.includes(o)?'checked':''} ${disabled?'disabled':''}> ${o}</label>`
      ).join('')}</div>`;
    } else if (col.type === 'boolean') {
      input = `<label class="de-toggle"><input type="checkbox"id="${id}"${v?'checked':''} ${disabled?'disabled':''}> ${v ? '예': '아니오'}</label>`;
    } else if (col.type === 'fk') {
      const target = DE_SCHEMAS[col.targetTable];
      const targetRows = (target && window[target.sourceVar]) || [];
      input = `<select id="${id}"${disabled?'disabled':''}>
        <option value="">— 선택 —</option>
        ${targetRows.map(t => `<option value="${t[col.targetKey || 'id']}"${t[col.targetKey || 'id']===v?'selected':''}>${escapeHtml(t[col.displayField] || t[col.targetKey || 'id'])}</option>`).join('')}
      </select>`;
    } else if (col.type === 'currency'|| col.type === 'number') {
      input = `<input type="number"id="${id}"value="${v}"${disabled?'disabled':''}>`;
    } else if (col.type === 'readonly'|| col.computed) {
      const display = col.computed ? col.computed(row) : v;
      input = `<input type="text"id="${id}"value="${escapeHtml(display)}"disabled>`;
    } else {
      const t = col.type === 'date'? 'date': col.type === 'datetime'? 'datetime-local': col.type === 'tel'? 'tel': col.type === 'email'? 'email': 'text';
      input = `<input type="${t}"id="${id}"value="${escapeHtml(v)}"${disabled?'disabled':''}>`;
    }
    return `<div class="de-field">
      <label>${col.label}${col.required ? '<span style="color:var(--danger);">*</span>': ''}</label>
      ${input}
      ${col.type === 'readonly'|| col.computed ? '<div class="de-hint">계산/읽기 전용</div>': ''}
    </div>`;
  }

  function makeEmptyRow(schema) {
    const row = {};
    schema.columns.forEach(c => { row[c.id] = c.type === 'multiselect'? [] : ''; });
    return row;
  }

  // ── 저장 ──
  function saveRow() {
    const schema = State.currentSchema;
    if (!schema) return;
    const form = document.getElementById('de-form');
    if (!form) return;
    const newRow = {};
    schema.columns.filter(c => c.inForm !== false).forEach(c => {
      const id = `de-field-${c.id}`;
      const el = document.getElementById(id);
      if (!el) {
        // multiselect 의 경우 별도
        if (c.type === 'multiselect') {
          newRow[c.id] = Array.from(form.querySelectorAll(`.de-multiselect input[type=checkbox]:checked`)).map(x => x.value);
        }
        return;
      }
      if (c.type === 'boolean') newRow[c.id] = el.checked;
      else if (c.type === 'number'|| c.type === 'currency') newRow[c.id] = Number(el.value) || 0;
      else newRow[c.id] = el.value;
    });

    // 검증
    const errors = [];
    schema.columns.forEach(c => {
      if (c.required && !newRow[c.id] && newRow[c.id] !== false && newRow[c.id] !== 0) {
        errors.push(`${c.label} 필수`);
      }
    });
    if (errors.length > 0) { alert('입력 오류:\n'+ errors.join('\n')); return; }

    const src = window[schema.sourceVar];
    if (!Array.isArray(src)) { alert('데이터 소스 오류'); return; }
    const pk = newRow[schema.pkField];
    const idx = src.findIndex(r => r[schema.pkField] === pk);
    if (State.panelMode === 'create') {
      if (idx >= 0) { alert('중복 ID 입니다'); return; }
      src.push(newRow);
      auditAdd({ table: schema.key, action: 'CREATE', pk: pk, after: newRow });
    } else {
      if (idx < 0) { alert('대상 행을 찾을 수 없습니다'); return; }
      const before = { ...src[idx] };
      Object.assign(src[idx], newRow);
      auditAdd({ table: schema.key, action: 'UPDATE', pk: pk, before, after: newRow });
    }

    showToast(State.panelMode === 'create'? '추가되었습니다': '저장되었습니다', 'success');
    closePanel();
    renderGrid();
    renderToolbar();
  }

  // ── 삭제 ──
  function deleteRow(pk) {
    const schema = State.currentSchema;
    if (!schema) return;
    if (!confirm(`행 "${pk}"을(를) 정말 삭제하시겠습니까?`)) return;
    const src = window[schema.sourceVar];
    const idx = src.findIndex(r => r[schema.pkField] === pk);
    if (idx < 0) return;
    const before = { ...src[idx] };
    src.splice(idx, 1);
    auditAdd({ table: schema.key, action: 'DELETE', pk, before });
    showToast('삭제되었습니다', 'success');
    closePanel();
    renderGrid();
    renderToolbar();
  }

  function deleteSelected() {
    const checks = document.querySelectorAll('#de-grid-body input[type=checkbox]:checked');
    if (checks.length === 0) { alert('삭제할 행을 선택하세요'); return; }
    if (!confirm(`선택한 ${checks.length}개 행을 정말 삭제하시겠습니까?`)) return;
    const schema = State.currentSchema;
    const src = window[schema.sourceVar];
    const pks = Array.from(checks).map(c => c.dataset.rowPk);
    pks.forEach(pk => {
      const idx = src.findIndex(r => String(r[schema.pkField]) === String(pk));
      if (idx >= 0) {
        const before = { ...src[idx] };
        src.splice(idx, 1);
        auditAdd({ table: schema.key, action: 'DELETE', pk, before });
      }
    });
    showToast(`${pks.length}개 행 삭제됨`, 'success');
    renderGrid();
    renderToolbar();
  }

  // ── 감사 로그 ──
  function auditAdd(entry) {
    const log = { ...entry, ts: new Date().toISOString(), user: State.userName, team: State.team };
    State.auditLog.unshift(log);
    State.auditLog = State.auditLog.slice(0, 500);
    try { localStorage.setItem(LS_AUDIT_KEY, JSON.stringify(State.auditLog)); } catch (e) {}
  }

  function showAudit() {
    const schema = State.currentSchema;
    if (!schema) return;
    const logs = State.auditLog.filter(a => a.table === schema.key).slice(0, 100);
    if (logs.length === 0) { alert('감사로그가 비어있습니다.'); return; }
    const body = logs.map(l => `
      <div class="de-audit-row">
        <span class="de-audit-action de-audit-${l.action}">${l.action}</span>
        <span class="de-audit-pk">${escapeHtml(l.pk)}</span>
        <span class="de-audit-meta">${l.user} · ${l.team} · ${new Date(l.ts).toLocaleString('ko-KR')}</span>
      </div>
    `).join('');
    if (typeof showModal === 'function') {
      showModal(` ${schema.label} 감사로그`, `<div class="de-audit-list">${body}</div><div style="margin-top:12px;font-size:12px;color:var(--text-muted);">최근 100건 (프로토타입 — localStorage 저장)</div>`);
    } else {
      alert(logs.map(l => `${l.action} ${l.pk} ${l.user} ${l.ts}`).join('\n'));
    }
  }

  // ── Export CSV / Excel ──
  function exportCsv() {
    const schema = State.currentSchema;
    if (!schema) return;
    applyFilters();
    const cols = schema.columns.filter(c => c.inGrid !== false);
    const headers = cols.map(c => c.label).join(',');
    const lines = State.rows.map(r => cols.map(c => csvCell(r[c.id], c, schema)).join(','));
    const bom = '﻿';
    const blob = new Blob([bom + headers + '\r\n'+ lines.join('\r\n')], { type: 'text/csv;charset=utf-8'});
    downloadBlob(blob, `${schema.key}_${todayStr()}.csv`);
    showToast(`CSV ${State.rows.length}행 내보냄`, 'success');
  }
  function exportExcel() {
    // 프로토타입: CSV 와 동일 (실 개발 시 ExcelJS 사용)
    exportCsv();
  }
  function csvCell(v, col, schema) {
    if (v === null || v === undefined) return '';
    if (col.type === 'fk'&& col.targetTable) {
      const target = DE_SCHEMAS[col.targetTable];
      if (target) {
        const r = (window[target.sourceVar] || []).find(x => x[col.targetKey || 'id'] === v);
        if (r) v = r[col.displayField] || v;
      }
    }
    if (Array.isArray(v)) v = v.join('|');
    if (typeof v === 'boolean') v = v ? '예': '아니오';
    const str = String(v);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── 권한 UI 반영 ──
  function updateActionPermissions() {
    // 툴바/패널 버튼은 매번 다시 렌더링되므로 별도 처리 없음
  }

  // ── 유틸 ──
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeJs(s) { return String(s ?? '').replace(/'/g, "\\'"); }

  // ── 외부 노출 API ──
  window.DE = {
    selectRow(pk) {
      const schema = State.currentSchema;
      const src = window[schema.sourceVar] || [];
      const row = src.find(r => String(r[schema.pkField]) === String(pk));
      if (row) openPanel('edit', row);
    },
    openCreate() { openPanel('create', null); },
    closePanel,
    saveRow,
    deleteRow,
    deleteSelected,
    sortBy(col) {
      if (State.sortBy === col) State.sortDir = State.sortDir === 'asc'? 'desc': 'asc';
      else { State.sortBy = col; State.sortDir = 'asc'; }
      renderGrid();
    },
    search(text) {
      State.searchText = text;
      State.page = 1;
      renderGrid();
    },
    setFilter(col, value) {
      if (value === '') delete State.columnFilters[col];
      else State.columnFilters[col] = value;
      State.page = 1;
      renderGrid();
      renderFilters();
    },
    clearFilters() {
      State.columnFilters = {};
      State.searchText = '';
      State.page = 1;
      renderGrid();
      renderFilters();
    },
    gotoPage(n) { State.page = Math.max(1, n); renderGrid(); },
    setPageSize(n) { State.pageSize = Number(n) || 25; State.page = 1; renderGrid(); },
    openMenu(pk, btn) { DE.selectRow(pk); },
    exportCsv,
    exportExcel,
    showAudit,
  };
})();
