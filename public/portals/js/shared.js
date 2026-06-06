/**
 * RTBIO Prototype — Shared Utilities
 */

// ── 넓은 표 자동 스크롤 래핑 ──
// .data-table 이 뷰포트보다 넓을 때 페이지 전체가 가로 스크롤되는 문제 해결.
// 표를 .table-scroll(overflow-x:auto) 로 감싸 "표만" 가로 스크롤되게 한다.
// 동적 렌더는 tbody 만 교체하므로 래퍼는 1회 감싸면 유지됨 (goTo 시점 호출로 충분).
function autoWrapTables(scope) {
  try {
    const root = scope || document;
    const tables = root.querySelectorAll('table.data-table, table.de-grid');
    tables.forEach(function (t) {
      const parent = t.parentElement;
      if (!parent || (parent.classList && parent.classList.contains('table-scroll'))) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      parent.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  } catch (e) { /* no-op: 네비게이션을 막지 않음 */ }
}

// ── Page Navigation ──
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
    autoWrapTables(target);
  }
  // Update nav highlights
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
}

// ── Currency Formatting ──
// 한국 원화는 소수점 없음. Decimal/float 입력 들어와도 항상 정수로 반올림 후 콤마.
function formatCurrency(num) {
  const n = Number(num);
  if (!Number.isFinite(n) || n === 0) return '₩0';
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}
function formatNumber(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('ko-KR');
}

// ── Date Formatting ──
function formatDate(dateStr) {
  if (!dateStr) return '';
  // QA fix(2026-06-02): ISO datetime("2026-01-30T15:00:00Z") 도 허용 — 날짜부만 사용
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${m}.${d}`;
}
function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

// ── Time Display & Cutoff ──
// 2026-06 fix: 실시간 시각 사용 (이전엔 시연용 14:22 하드코딩이라 시간바·확정/출고 시각이 실제와 어긋남)
function getTimeInfo() {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  const cutoffHour = 15, cutoffMin = 30;
  const remainMin = (cutoffHour * 60 + cutoffMin) - (hour * 60 + min);
  const absRemain = Math.abs(remainMin);
  const remainH = Math.floor(absRemain / 60);
  const remainM = absRemain % 60;
  let level = 'safe'; // green
  if (remainMin <= 0) level = 'danger';
  else if (remainMin <= 30) level = 'danger';
  else if (remainMin <= 120) level = 'warn';

  return {
    current: `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`,
    cutoff: '15:30',
    remainText: remainH > 0 ? `${remainH}시간 ${remainM}분` : `${remainM}분`,
    level,
    isPastCutoff: remainMin <= 0,
  };
}

// ── 페이저 바 (기존 테이블 tbody 페이지네이션용) ──
// 2026-06: thead/tfoot(합계)·러닝잔액이 있는 기존 원장 테이블은 renderListPanel 로
//   교체하기 어려워, tbody 만 페이지 슬라이스하고 이 바를 테이블 아래에 그린다.
//   버튼은 gotoFnName(page) 전역 함수를 호출한다.
function buildPagerBar(page, total, perPage, gotoFnName) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  const start = (page - 1) * perPage;
  const info = total > 0
    ? `총 <b>${total.toLocaleString()}</b>건 · ${(start + 1).toLocaleString()}–${Math.min(start + perPage, total).toLocaleString()} / ${page}p of ${totalPages}p`
    : '총 0건';
  let btns = '';
  if (totalPages > 1) {
    btns += `<button class="btn btn-outline btn-sm" ${page === 1 ? 'disabled' : ''} onclick="${gotoFnName}(${page - 1})">←</button>`;
    const set = new Set([1, totalPages]);
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) set.add(i);
    const keys = Array.from(set).sort((a, b) => a - b);
    let prev = 0;
    keys.forEach(p => {
      if (p - prev > 1) btns += '<span style="padding:6px;color:var(--text-muted);">…</span>';
      btns += `<button class="btn ${p === page ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="${gotoFnName}(${p})">${p}</button>`;
      prev = p;
    });
    btns += `<button class="btn btn-outline btn-sm" ${page === totalPages ? 'disabled' : ''} onclick="${gotoFnName}(${page + 1})">→</button>`;
  }
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;margin-top:10px;">
    <span style="font-size:12px;color:var(--text-muted);">${info}</span>
    <span style="display:flex;gap:4px;">${btns}</span>
  </div>`;
}

// ── Default Date Range (모든 포털 공통) ──
// 2026-06: 새로 페이지 열 때 기본 기간은 "최근 7일 (KST)" — 사용자가 직접 바꾼 값은 보존.
//   from = 오늘 - 6일,  to = 오늘  (총 7일 포함)
function getKstRecentDays(n) {
  const today = new Date();
  const toKst = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const fromD = new Date(today); fromD.setDate(fromD.getDate() - (n - 1));
  const fromKst = fromD.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return { from: fromKst, to: toKst };
}
// 각 포털 DOMContentLoaded 에서 호출 — { fromIds: [...], toIds: [...], todayIds: [...] }
//   - fromIds : from 값으로 채울 input id 리스트
//   - toIds   : to 값으로 채울 input id 리스트
//   - todayIds: 단일 date input 으로 오늘만 채울 id 리스트 (입력용 폼 등)
//   이미 value 가 있으면 덮지 않음 (localStorage 등 사용자 입력 보존).
function setDefaultDateRanges(opts) {
  const { from, to } = getKstRecentDays(7);
  const _set = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = val;
  };
  (opts.fromIds || []).forEach(id => _set(id, from));
  (opts.toIds   || []).forEach(id => _set(id, to));
  (opts.todayIds|| []).forEach(id => _set(id, to));
}

// ── Shared: 이력 패널 (기간 필터 + 검색 + 페이지네이션 + CSV) ──
// 2026-06: 누적 이력이 많아져도 운영 가능하도록. qc/admin 등 공통 사용.
// opts: {
//   hostId, data, dateField, searchFields:[fn|string], columns:[{label, render, csv?, align?}],
//   csvFilename, days (default 30), perPage (default 25), title
// }
function renderHistoryPanel(opts) {
  const host = document.getElementById(opts.hostId);
  if (!host) return;
  const perPage = opts.perPage || 25;
  const days = opts.days || 30;
  if (!host._state) {
    const todayKst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const fromD = new Date(); fromD.setDate(fromD.getDate() - days + 1);
    host._state = {
      from: fromD.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
      to: todayKst,
      q: '',
      page: 1,
    };
  }
  const state = host._state;

  const _debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const _stripHtml = s => String(s ?? '').replace(/<[^>]+>/g, '');
  const _normDate = v => String(v ?? '').slice(0, 10);

  function applyFilters() {
    let rows = (opts.data || []).slice();
    rows = rows.filter(r => {
      const d = _normDate(r[opts.dateField]);
      if (!d) return false;
      if (state.from && d < state.from) return false;
      if (state.to && d > state.to) return false;
      return true;
    });
    if (state.q) {
      const q = state.q.toLowerCase();
      rows = rows.filter(r => (opts.searchFields || []).some(f => {
        const v = typeof f === 'function' ? f(r) : r[f];
        return String(v || '').toLowerCase().includes(q);
      }));
    }
    rows.sort((a, b) => _normDate(b[opts.dateField]).localeCompare(_normDate(a[opts.dateField])));
    return rows;
  }

  function exportCsv(rows) {
    const cols = opts.columns;
    const head = cols.map(c => '"' + String(c.label || '').replace(/"/g, '""') + '"').join(',');
    const body = rows.map(r => cols.map(c => {
      const v = typeof c.csv === 'function' ? c.csv(r) : _stripHtml(c.render(r));
      return '"' + String(v ?? '').replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
    const csv = '﻿' + head + '\r\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (opts.csvFilename || 'history') + '-' + new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function paginationHtml(cur, total) {
    if (total <= 1) return '';
    const out = [];
    out.push(`<button class="btn btn-outline btn-sm" data-hp-page="${Math.max(1, cur-1)}" ${cur===1?'disabled':''}>←</button>`);
    const set = new Set([1, total]);
    for (let i = Math.max(2, cur-2); i <= Math.min(total-1, cur+2); i++) set.add(i);
    const sorted = Array.from(set).sort((a,b) => a-b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push('<span style="padding:6px;color:var(--text-muted);">…</span>');
      out.push(`<button class="btn ${p===cur?'btn-primary':'btn-outline'} btn-sm" data-hp-page="${p}">${p}</button>`);
      prev = p;
    }
    out.push(`<button class="btn btn-outline btn-sm" data-hp-page="${Math.min(total, cur+1)}" ${cur===total?'disabled':''}>→</button>`);
    return out.join('');
  }

  function render() {
    const filtered = applyFilters();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * perPage;
    const pageRows = filtered.slice(start, start + perPage);
    const cols = opts.columns;

    host.innerHTML = `
      ${opts.title ? `<div class="section-header" style="margin-bottom:8px;">${opts.title}</div>` : ''}
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; padding:8px 0; border-bottom:1px solid var(--border);">
        <span style="font-size:12px; color:var(--text-muted);">기간</span>
        <input type="date" id="${opts.hostId}-from" value="${state.from}" style="font-size:13px; padding:4px 8px;">
        <span style="color:var(--text-muted);">~</span>
        <input type="date" id="${opts.hostId}-to" value="${state.to}" style="font-size:13px; padding:4px 8px;">
        <button class="btn btn-ghost btn-sm" data-hp-quick="7" title="최근 7일">최근 7일</button>
        <button class="btn btn-ghost btn-sm" data-hp-quick="30" title="최근 30일">30일</button>
        <button class="btn btn-ghost btn-sm" data-hp-quick="90" title="최근 90일">90일</button>
        <button class="btn btn-ghost btn-sm" data-hp-quick="365" title="최근 1년">1년</button>
        <input type="text" id="${opts.hostId}-q" placeholder="🔍 검색..." value="${state.q}" style="font-size:13px; padding:4px 8px; min-width:160px;">
        <button class="btn btn-outline btn-sm" id="${opts.hostId}-csv">⬇ CSV</button>
        <span style="margin-left:auto; font-size:12px; color:var(--text-muted);">
          총 <b>${total.toLocaleString()}</b>건${total > 0 ? ` · ${(start+1).toLocaleString()}–${Math.min(start+perPage, total).toLocaleString()} / ${state.page}p of ${totalPages}p` : ''}
        </span>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:13px;">
          <thead><tr>${cols.map(c => `<th${c.align?` style="text-align:${c.align}"`:''}>${c.label}</th>`).join('')}</tr></thead>
          <tbody>
            ${pageRows.length === 0
              ? `<tr><td colspan="${cols.length}" style="text-align:center; padding:32px; color:var(--text-muted);">조건에 맞는 이력이 없습니다.</td></tr>`
              : pageRows.map(r => `<tr>${cols.map(c => `<td${c.align?` style="text-align:${c.align}"`:''}>${c.render(r) ?? ''}</td>`).join('')}</tr>`).join('')
            }
          </tbody>
        </table>
      </div>
      <div style="display:flex; gap:4px; justify-content:center; margin-top:12px;">${paginationHtml(state.page, totalPages)}</div>
    `;

    host.querySelector(`#${opts.hostId}-from`).addEventListener('change', e => { state.from = e.target.value; state.page = 1; render(); });
    host.querySelector(`#${opts.hostId}-to`).addEventListener('change', e => { state.to = e.target.value; state.page = 1; render(); });
    host.querySelector(`#${opts.hostId}-q`).addEventListener('input', _debounce(e => { state.q = e.target.value; state.page = 1; render(); }, 250));
    host.querySelector(`#${opts.hostId}-csv`).addEventListener('click', () => exportCsv(filtered));
    host.querySelectorAll('[data-hp-page]').forEach(b => b.addEventListener('click', e => {
      state.page = parseInt(e.currentTarget.dataset.hpPage, 10) || 1;
      render();
    }));
    host.querySelectorAll('[data-hp-quick]').forEach(b => b.addEventListener('click', e => {
      const d = parseInt(e.currentTarget.dataset.hpQuick, 10);
      const today = new Date();
      const from = new Date(today); from.setDate(from.getDate() - d + 1);
      state.from = from.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      state.to = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      state.page = 1;
      render();
    }));
  }

  render();
}

// 2026-06: 비-시계열(거래처 목록 등) 페이지네이션 패널 — 기간 필터 없이 검색+페이지네이션+CSV 만.
// opts: { hostId, data, searchFields, columns, csvFilename, perPage (default 25), title, sortBy?(fn) }
function renderListPanel(opts) {
  const host = document.getElementById(opts.hostId);
  if (!host) return;
  const perPage = opts.perPage || 25;
  if (!host._state) host._state = { q: '', page: 1 };
  const state = host._state;

  const _debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const _stripHtml = s => String(s ?? '').replace(/<[^>]+>/g, '');

  function applyFilters() {
    let rows = (opts.data || []).slice();
    if (state.q) {
      const q = state.q.toLowerCase();
      rows = rows.filter(r => (opts.searchFields || []).some(f => {
        const v = typeof f === 'function' ? f(r) : r[f];
        return String(v || '').toLowerCase().includes(q);
      }));
    }
    if (typeof opts.sortBy === 'function') rows.sort(opts.sortBy);
    return rows;
  }

  function exportCsv(rows) {
    const cols = opts.columns;
    const head = cols.map(c => '"' + String(c.label || '').replace(/"/g, '""') + '"').join(',');
    const body = rows.map(r => cols.map(c => {
      const v = typeof c.csv === 'function' ? c.csv(r) : _stripHtml(c.render(r));
      return '"' + String(v ?? '').replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
    const csv = '﻿' + head + '\r\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (opts.csvFilename || 'list') + '-' + new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function paginationHtml(cur, total) {
    if (total <= 1) return '';
    const out = [];
    out.push(`<button class="btn btn-outline btn-sm" data-lp-page="${Math.max(1, cur-1)}" ${cur===1?'disabled':''}>←</button>`);
    const set = new Set([1, total]);
    for (let i = Math.max(2, cur-2); i <= Math.min(total-1, cur+2); i++) set.add(i);
    const sorted = Array.from(set).sort((a,b) => a-b);
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push('<span style="padding:6px;color:var(--text-muted);">…</span>');
      out.push(`<button class="btn ${p===cur?'btn-primary':'btn-outline'} btn-sm" data-lp-page="${p}">${p}</button>`);
      prev = p;
    }
    out.push(`<button class="btn btn-outline btn-sm" data-lp-page="${Math.min(total, cur+1)}" ${cur===total?'disabled':''}>→</button>`);
    return out.join('');
  }

  function render() {
    const filtered = applyFilters();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * perPage;
    const pageRows = filtered.slice(start, start + perPage);
    const cols = opts.columns;

    host.innerHTML = `
      ${opts.title ? `<div class="section-header" style="margin-bottom:8px;">${opts.title}</div>` : ''}
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; padding:8px 0; border-bottom:1px solid var(--border);">
        <input type="text" id="${opts.hostId}-q" placeholder="🔍 검색..." value="${state.q}" style="font-size:13px; padding:4px 8px; min-width:200px;">
        <button class="btn btn-outline btn-sm" id="${opts.hostId}-csv">⬇ CSV</button>
        <span style="margin-left:auto; font-size:12px; color:var(--text-muted);">
          총 <b>${total.toLocaleString()}</b>건${total > 0 ? ` · ${(start+1).toLocaleString()}–${Math.min(start+perPage, total).toLocaleString()} / ${state.page}p of ${totalPages}p` : ''}
        </span>
      </div>
      <div class="table-wrap">
        <table class="data-table" style="font-size:13px;">
          <thead><tr>${cols.map(c => `<th${c.align?` style="text-align:${c.align}"`:''}>${c.label}</th>`).join('')}</tr></thead>
          <tbody>
            ${pageRows.length === 0
              ? `<tr><td colspan="${cols.length}" style="text-align:center; padding:32px; color:var(--text-muted);">조건에 맞는 항목이 없습니다.</td></tr>`
              : pageRows.map(r => `<tr>${cols.map(c => `<td${c.align?` style="text-align:${c.align}"`:''}>${c.render(r) ?? ''}</td>`).join('')}</tr>`).join('')
            }
          </tbody>
        </table>
      </div>
      <div style="display:flex; gap:4px; justify-content:center; margin-top:12px;">${paginationHtml(state.page, totalPages)}</div>
    `;

    host.querySelector(`#${opts.hostId}-q`).addEventListener('input', _debounce(e => { state.q = e.target.value; state.page = 1; render(); }, 250));
    host.querySelector(`#${opts.hostId}-csv`).addEventListener('click', () => exportCsv(filtered));
    host.querySelectorAll('[data-lp-page]').forEach(b => b.addEventListener('click', e => {
      state.page = parseInt(e.currentTarget.dataset.lpPage, 10) || 1;
      render();
    }));
  }

  render();
}

// ── Status Badge HTML ──
function statusBadge(status) {
  const map = {
    '접수': 'badge-pending',
    '확정': 'badge-confirmed',
    '출고중': 'badge-shipping',
    '완료': 'badge-complete',
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// ── Stage Badge HTML ──
function stageBadge(stageId) {
  if (!stageId) return '-';
  const s = SHIP_STAGES.find(x => x.id === stageId);
  if (!s) return stageId;
  return `<span class="badge" style="background:${s.color}15;color:${s.color}">${s.icon} ${s.name}</span>`;
}

// ── Tab Switching ──
function switchTab(groupSelector, tabId) {
  const group = document.querySelector(groupSelector);
  if (!group) return;
  group.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  group.closest('.page, .tab-container, body').querySelectorAll('[data-tab-content]').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.tabContent === tabId);
  });
}

// ── Toast Notification ──
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Modal ──
// 2026-06: 4번째 인자 opts 추가(하위호환) — { confirmLabel, confirmClass }
//   미지정 시 기존과 동일('확인'/'btn-primary'). 편집='저장', 삭제='삭제'(btn-danger) 구분용.
function showModal(title, bodyHTML, onConfirm, opts) {
  opts = opts || {};
  const confirmLabel = opts.confirmLabel || (onConfirm ? '확인' : '닫기');
  const confirmClass = opts.confirmClass || 'btn-primary';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">
        ${onConfirm ? '<button class="btn btn-outline modal-cancel">취소</button>' : ''}
        <button class="btn ${confirmClass} modal-confirm">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('.modal-confirm').onclick = () => {
    if (onConfirm) onConfirm();
    close();
  };
  const cancelBtn = overlay.querySelector('.modal-cancel');
  if (cancelBtn) cancelBtn.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

// ── Close Modal ──
function closeModal() {
  const overlay = document.querySelector('.modal-overlay.show');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  }
}

// ── Sidebar Toggle (Mobile) ──
function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
  document.querySelector('.sidebar-overlay')?.classList.toggle('show');
}
