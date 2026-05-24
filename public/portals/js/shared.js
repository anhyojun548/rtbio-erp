/**
 * RTBIO Prototype — Shared Utilities
 */

// ── Page Navigation ──
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
  // Update nav highlights
  document.querySelectorAll('[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });
}

// ── Currency Formatting ──
function formatCurrency(num) {
  if (num === 0) return '₩0';
  return '₩' + num.toLocaleString('ko-KR');
}
function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

// ── Date Formatting ──
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${m}.${d}`;
}
function formatDateFull(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

// ── Time Display & Cutoff ──
function getTimeInfo() {
  // 시연용: 현재 시간 14:22 고정 (택배 마감 전)
  const hour = 14, min = 22;
  const cutoffHour = 15, cutoffMin = 30;
  const remainMin = (cutoffHour * 60 + cutoffMin) - (hour * 60 + min);
  const remainH = Math.floor(remainMin / 60);
  const remainM = remainMin % 60;
  let level = 'safe'; // green
  if (remainMin <= 30) level = 'danger';
  else if (remainMin <= 120) level = 'warn';

  return {
    current: `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`,
    cutoff: '15:30',
    remainText: remainH > 0 ? `${remainH}시간 ${remainM}분` : `${remainM}분`,
    level,
    isPastCutoff: remainMin <= 0,
  };
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
