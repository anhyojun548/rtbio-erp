/**
 * RTBIO Prototype — 공통 UI 헬퍼
 * 2026-05-12 미팅 반영: 빠른 월 선택, 양측↔편측 환산, 웹 알림
 */

// ════════════════════════════════════════════════════════════════════
// 1. 빠른 월 선택 — 시작/종료일을 자동 채우는 드롭다운 (1월~12월)
// ════════════════════════════════════════════════════════════════════
/**
 * 월 선택 드롭다운 HTML 생성
 * @param {string} fromId - 시작일 input id
 * @param {string} toId   - 종료일 input id
 * @param {number} year   - 기본 연도 (생략 시 올해)
 * @returns {string} HTML
 */
function buildMonthQuickPicker(fromId, toId, year) {
  const Y = year || new Date().getFullYear();
  const months = [];
  for (let m = 1; m <= 12; m++) months.push(m);
  return `
    <div class="month-quick-picker" style="display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--text-secondary);font-weight:600;">빠른선택:</span>
      <select class="form-select" style="max-width:90px;padding:4px 6px;font-size:12px;"
              onchange="applyYearQuick('${fromId}','${toId}',this.value)">
        <option value="${Y}">${Y}년</option>
        <option value="${Y-1}">${Y-1}년</option>
        <option value="${Y-2}">${Y-2}년</option>
      </select>
      ${months.map(m =>
        `<button type="button" class="btn-month-pill"
                 onclick="applyMonthQuick('${fromId}','${toId}',${Y},${m})">${m}월</button>`
      ).join('')}
      <button type="button" class="btn-month-pill btn-month-this"
              onclick="applyMonthQuick('${fromId}','${toId}',${Y},${new Date().getMonth()+1})">이번달</button>
      <button type="button" class="btn-month-pill"
              onclick="applyYTD('${fromId}','${toId}',${Y})">올해</button>
    </div>
  `;
}

/** 특정 월 선택 시 시작/종료일 자동 채움 */
function applyMonthQuick(fromId, toId, year, month) {
  const Y = parseInt(year, 10);
  const M = parseInt(month, 10);
  const first = new Date(Y, M - 1, 1);
  const last  = new Date(Y, M, 0); // 다음달 0일 = 이번달 말일
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  if (fromEl) { fromEl.value = fmt(first); fromEl.dispatchEvent(new Event('change')); }
  if (toEl)   { toEl.value   = fmt(last);  toEl.dispatchEvent(new Event('change')); }
}

/** 연도 변경 시 — 동일 월 유지 */
function applyYearQuick(fromId, toId, year) {
  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  if (!fromEl || !fromEl.value) return;
  const curFrom = new Date(fromEl.value);
  const M = curFrom.getMonth() + 1;
  applyMonthQuick(fromId, toId, year, M);
}

/** 올해 1월 1일 ~ 오늘 */
function applyYTD(fromId, toId, year) {
  const Y = parseInt(year, 10);
  const today = new Date();
  const first = new Date(Y, 0, 1);
  const end = (Y === today.getFullYear())
    ? today
    : new Date(Y, 11, 31);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  if (fromEl) { fromEl.value = fmt(first); fromEl.dispatchEvent(new Event('change')); }
  if (toEl)   { toEl.value   = fmt(end);   toEl.dispatchEvent(new Event('change')); }
}

// ════════════════════════════════════════════════════════════════════
// 2. 편측 ↔ 양측 환산 (2026-05-12 미팅)
// ════════════════════════════════════════════════════════════════════
// DB 는 편측 단위로 통일.
// - 거래처 발주(양측 입력) → 자동 × 2 환산 → 편측 저장
// - 품질팀 재고 페이지: 편측 / 양측 둘 다 표시 (양측 = floor(편측/2))
// - 거래명세서 출력: 양측 단위 (편측 ÷ 2)
function singleToPair(qty) {
  return Math.floor(Number(qty) / 2);
}
function pairToSingle(qty) {
  return Number(qty) * 2;
}
/**
 * 제품 정보 + 편측 수량 → 양측/편측 표시
 * @param {object} product - PRODUCTS[i]
 * @param {number} singleQty - 편측 수량
 * @returns {string} "12편측 / 6세트" 형태
 */
function formatSinglePair(product, singleQty) {
  const n = Number(singleQty) || 0;
  if (!product || product.side !== '편측' || product.setQty !== 2) {
    return n.toLocaleString('ko-KR') + '개';
  }
  return `${n.toLocaleString('ko-KR')}편측 <span style="color:var(--text-muted);">/ ${singleToPair(n).toLocaleString('ko-KR')}세트</span>`;
}

// ════════════════════════════════════════════════════════════════════
// 3. 웹 알림 (종 모양 알림) — Notification Bell
// ════════════════════════════════════════════════════════════════════
const NotifyState = {
  notifications: [],
  open: false,
};

/** 알림 데이터 로드 (data.js NOTIFICATIONS + localStorage 추가 알림) */
function loadNotifications() {
  const base = (window.NOTIFICATIONS || []).slice();
  let extra = [];
  try {
    extra = JSON.parse(localStorage.getItem('rtbio_notifications') || '[]');
  } catch (e) {}
  NotifyState.notifications = [...extra, ...base].slice(0, 50);
  return NotifyState.notifications;
}

/** 미읽음 카운트 */
function getUnreadCount() {
  return NotifyState.notifications.filter(n => !n.readAt).length;
}

/** 종 모양 버튼 HTML */
function buildNotifyBell() {
  loadNotifications();
  const unread = getUnreadCount();
  return `
    <div class="notify-bell-wrap" style="position:relative;display:inline-block;margin-right:8px;">
      <button type="button" class="notify-bell-btn" onclick="toggleNotifyDropdown()"
              title="알림 ${unread}건" style="background:transparent;border:none;cursor:pointer;padding:6px 8px;position:relative;">
        <span style="font-size:18px;">🔔</span>
        ${unread > 0 ? `<span class="notify-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
      </button>
      <div id="notify-dropdown" class="notify-dropdown" style="display:none;"></div>
    </div>
  `;
}

function toggleNotifyDropdown() {
  const dd = document.getElementById('notify-dropdown');
  if (!dd) return;
  NotifyState.open = !NotifyState.open;
  if (NotifyState.open) {
    renderNotifyDropdown();
    dd.style.display = 'block';
    setTimeout(() => {
      document.addEventListener('click', closeNotifyDropdownOnce, { once: true });
    }, 100);
  } else {
    dd.style.display = 'none';
  }
}
function closeNotifyDropdownOnce(e) {
  const wrap = document.querySelector('.notify-bell-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('notify-dropdown');
    if (dd) dd.style.display = 'none';
    NotifyState.open = false;
  } else {
    document.addEventListener('click', closeNotifyDropdownOnce, { once: true });
  }
}

function renderNotifyDropdown() {
  const dd = document.getElementById('notify-dropdown');
  if (!dd) return;
  const items = NotifyState.notifications;
  if (items.length === 0) {
    dd.innerHTML = '<div class="notify-empty">새 알림이 없습니다</div>';
    return;
  }
  dd.innerHTML = `
    <div class="notify-header">
      <strong>알림</strong>
      <button type="button" onclick="markAllNotifyRead()" style="background:transparent;border:none;color:var(--primary);font-size:12px;cursor:pointer;">모두 읽음</button>
    </div>
    <div class="notify-list">
      ${items.map(n => `
        <div class="notify-item ${n.readAt ? 'read' : 'unread'} ${n.urgent ? 'urgent' : ''}"
             onclick="markNotifyRead('${n.id}')">
          <div class="notify-item-title">${n.urgent ? '🔴 ' : ''}${escapeHtmlSafe(n.title)}</div>
          <div class="notify-item-msg">${escapeHtmlSafe(n.message)}</div>
          <div class="notify-item-meta">${n.createdAt} · ${notifyTypeLabel(n.type)}</div>
        </div>
      `).join('')}
    </div>
  `;
}
function notifyTypeLabel(t) {
  return {
    ORDER_EDIT:'발주수정', STOCK_LOW:'재고경고', NOTICE:'공지사항',
    PROJECT_ARRIVAL:'베트남입고', INVOICE_RESEND:'명세서재발행',
  }[t] || '알림';
}
function markNotifyRead(id) {
  const n = NotifyState.notifications.find(x => x.id === id);
  if (n && !n.readAt) {
    n.readAt = new Date().toISOString().slice(0,16).replace('T',' ');
    // localStorage 동기화
    saveNotifyExtras();
    renderNotifyDropdown();
    refreshNotifyBell();
  }
}
function markAllNotifyRead() {
  const now = new Date().toISOString().slice(0,16).replace('T',' ');
  NotifyState.notifications.forEach(n => { if (!n.readAt) n.readAt = now; });
  saveNotifyExtras();
  renderNotifyDropdown();
  refreshNotifyBell();
}
function saveNotifyExtras() {
  try {
    localStorage.setItem('rtbio_notifications', JSON.stringify(NotifyState.notifications));
  } catch (e) {}
}
function refreshNotifyBell() {
  const btn = document.querySelector('.notify-bell-btn');
  if (!btn) return;
  const unread = getUnreadCount();
  const badge = btn.querySelector('.notify-badge');
  if (unread > 0) {
    if (badge) {
      badge.textContent = unread > 99 ? '99+' : unread;
    } else {
      btn.insertAdjacentHTML('beforeend', `<span class="notify-badge">${unread > 99 ? '99+' : unread}</span>`);
    }
  } else if (badge) {
    badge.remove();
  }
  btn.title = `알림 ${unread}건`;
}

/** 신규 알림 푸시 (서버 푸시 시뮬레이션) */
function pushNotification(notif) {
  const id = 'NTF-' + Date.now();
  const n = {
    id, type:'NOTICE', title:'', message:'',
    targetTeam:'ALL', targetUser:null, relatedId:null,
    createdAt: new Date().toISOString().slice(0,16).replace('T',' '),
    readAt: null, urgent: false,
    ...notif,
  };
  NotifyState.notifications.unshift(n);
  saveNotifyExtras();
  refreshNotifyBell();
  return n;
}

function escapeHtmlSafe(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ════════════════════════════════════════════════════════════════════
// 4. 플로팅 팝업 (Adieu 거래처원장 → 발주 내역)
// ════════════════════════════════════════════════════════════════════
function showFloatingPopup(title, contentHTML, opts) {
  opts = opts || {};
  let layer = document.getElementById('floating-popup-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'floating-popup-layer';
    document.body.appendChild(layer);
  }
  const id = 'fpop-' + Date.now();
  // 2026-05-21: 뷰포트 안에 머물도록 size/position 클램프
  const margin = 16;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  // 사이즈: 요청값 vs 뷰포트 - 2*margin 중 작은 것
  let w = Math.min(opts.width || 600, vpW - margin * 2);
  let h = Math.min(opts.height || 480, vpH - margin * 2);
  // 최소 사이즈도 보장
  w = Math.max(w, 320);
  h = Math.max(h, 200);
  // 위치: 중앙 정렬 기본값
  let x = (opts.x != null) ? opts.x : Math.max(margin, (vpW - w) / 2);
  let y = (opts.y != null) ? opts.y : Math.max(margin, (vpH - h) / 3);
  // 위치 클램프 (뷰포트 밖으로 안 나가게)
  x = Math.min(Math.max(margin, x), vpW - w - margin);
  y = Math.min(Math.max(margin, y), vpH - h - margin);
  const html = `
    <div id="${id}" class="floating-popup" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;">
      <div class="floating-popup-header">
        <span class="floating-popup-title">${escapeHtmlSafe(title)}</span>
        <button type="button" class="floating-popup-close" onclick="closeFloatingPopup('${id}')">✕</button>
      </div>
      <div class="floating-popup-body">${contentHTML}</div>
    </div>
  `;
  layer.insertAdjacentHTML('beforeend', html);
  // 드래그 가능하게
  makeFloatingDraggable(id);
}
function closeFloatingPopup(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
function makeFloatingDraggable(id) {
  const popup = document.getElementById(id);
  if (!popup) return;
  const header = popup.querySelector('.floating-popup-header');
  if (!header) return;
  let dragging = false, startX, startY, origX, origY;
  header.style.cursor = 'move';
  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('floating-popup-close')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = popup.offsetLeft; origY = popup.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    // 2026-05-21: 드래그 시 뷰포트 밖으로 못 나가게 클램프
    const margin = 8;
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    let nx = origX + e.clientX - startX;
    let ny = origY + e.clientY - startY;
    nx = Math.min(Math.max(margin, nx), window.innerWidth - w - margin);
    ny = Math.min(Math.max(margin, ny), window.innerHeight - h - margin);
    popup.style.left = nx + 'px';
    popup.style.top  = ny + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

// ════════════════════════════════════════════════════════════════════
// 노출
// ════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.buildMonthQuickPicker = buildMonthQuickPicker;
  window.applyMonthQuick = applyMonthQuick;
  window.applyYearQuick = applyYearQuick;
  window.applyYTD = applyYTD;
  window.singleToPair = singleToPair;
  window.pairToSingle = pairToSingle;
  window.formatSinglePair = formatSinglePair;
  window.buildNotifyBell = buildNotifyBell;
  window.toggleNotifyDropdown = toggleNotifyDropdown;
  window.markNotifyRead = markNotifyRead;
  window.markAllNotifyRead = markAllNotifyRead;
  window.pushNotification = pushNotification;
  window.showFloatingPopup = showFloatingPopup;
  window.closeFloatingPopup = closeFloatingPopup;
  window.loadNotifications = loadNotifications;
  window.getUnreadCount = getUnreadCount;
}
