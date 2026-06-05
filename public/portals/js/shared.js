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
function showModal(title, bodyHTML, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">${title}</div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-footer">
        ${onConfirm ? '<button class="btn btn-outline modal-cancel">취소</button>' : ''}
        <button class="btn btn-primary modal-confirm">${onConfirm ? '확인' : '닫기'}</button>
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
