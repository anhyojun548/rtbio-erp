/**
 * RTBIO Prototype — 직원 관리 (Staff Management)
 * 4개 포털 공통 (경영지원 / 영업 / 품질관리 / 대표)
 *
 * - 의존성: shared.js (showModal, showToast), shared-ui.js (escapeHtmlSafe)
 * - 백엔드: /api/users (GET 목록=배열 / POST 생성=201 created object),
 *           /api/users/[id] (GET, PATCH 수정, DELETE 비활성화),
 *           /api/users/[id]/password (POST 비번재발급),
 *           /api/me/password (POST 본인 비번변경)
 * - 권한: window.CURRENT_USER.{role,isTeamAdmin} 로 폼/노출 분기
 *
 * 사용:
 *   1. HTML 에 컨테이너 추가: <div id="page-staff" class="page"></div>
 *   2. <script src="js/staff-mgmt.js"></script> 로드
 *   3. 페이지 진입 시: 컨테이너에 buildStaffMgmtPageHTML() 주입 후 renderStaff('') 호출
 */

// ── 직급(role) 한글 라벨 맵 ──────────────────────────────────────────
const STAFF_ROLE_LABEL = {
  TENANT_OWNER: '대표',
  ADMIN: '경영지원',
  QC: '품질관리',
  EXEC: '영업',
};

// 신규/수정 폼의 직급 select 후보 순서 (메타관리자 기준 전체)
const STAFF_ROLE_ORDER = ['ADMIN', 'QC', 'EXEC', 'TENANT_OWNER'];

// ── 안전한 JSON 파싱 가드 (data-loader 의 _safeJson 과 동일 철학) ────
// server action requireRole 거부 시 307 → /403 HTML 이 옴.
// fetch 가 자동 follow → r.ok=true 지만 r.json() 은 실패.
// content-type 검사 + try-catch 로 null 처리해 크래시 방지.
async function _staffSafeJson(r) {
  if (!r || !r.ok) return null;
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) return null;
  try { return await r.json(); } catch { return null; }
}

// HTML escape (shared-ui.js 의 escapeHtmlSafe 우선, 없으면 폴백)
function _esc(s) {
  if (typeof escapeHtmlSafe === 'function') return escapeHtmlSafe(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 현재 사용자가 부여/지정할 수 있는 직급 목록.
 * - ADMIN / TENANT_OWNER (메타관리자): 모든 staff 직급. OWNER 만 TENANT_OWNER 도 부여 가능.
 * - QC / EXEC 팀관리자: 본인 role 만.
 * - 그 외(권한 없음): 빈 배열.
 */
function _assignableRoles() {
  const u = window.CURRENT_USER || {};
  const role = u.role;
  if (role === 'ADMIN' || role === 'TENANT_OWNER') {
    // ADMIN 은 TENANT_OWNER 를 부여할 수 없음(서버 canGrantRole 과 일치) — OWNER 만 가능
    return STAFF_ROLE_ORDER.filter((r) => r !== 'TENANT_OWNER' || role === 'TENANT_OWNER');
  }
  if (u.isTeamAdmin && (role === 'QC' || role === 'EXEC')) {
    return [role];
  }
  return [];
}

function _roleOptionsHTML(selected) {
  return _assignableRoles()
    .map((r) => `<option value="${r}"${r === selected ? ' selected' : ''}>${STAFF_ROLE_LABEL[r] || r}</option>`)
    .join('');
}

// ── 날짜 표시 (lastLoginAt ISO → 'YYYY-MM-DD HH:MM') ────────────────
function _fmtLastLogin(iso) {
  if (!iso) return '<span style="color:var(--text-muted);">-</span>';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return '-'; }
}

// ── 페이지 HTML 빌더 (4개 포털 공통) ─────────────────────────────────
function buildStaffMgmtPageHTML() {
  // 직급 필터: 메타관리자는 전체, 팀관리자는 자기 팀만 — 후보 == _assignableRoles ∪ 표시용
  const filterRoles = _assignableRoles();
  const roleFilterOptions = filterRoles.length > 1
    ? `<option value="">전체 직급</option>` +
      filterRoles.map((r) => `<option value="${r}">${STAFF_ROLE_LABEL[r] || r}</option>`).join('')
    : '';
  return `
    <div class="page-inner">
      <div class="main-header">
        <div>
          <div class="main-title">직원 관리</div>
          <div class="main-subtitle">직원 계정 조회 · 생성 · 직급/비밀번호 관리</div>
        </div>
      </div>
      <div class="search-bar" style="flex-wrap:wrap;gap:8px;">
        <input type="text" class="form-input" id="staff-search"
          placeholder="이름 / 이메일 검색..." oninput="filterStaff(this.value)">
        ${roleFilterOptions ? `
        <select class="form-select" id="staff-role-filter"
          onchange="filterStaff(document.getElementById('staff-search').value)" style="max-width:150px;">
          ${roleFilterOptions}
        </select>` : ''}
        <select class="form-select" id="staff-active-filter"
          onchange="filterStaff(document.getElementById('staff-search').value)" style="max-width:130px;">
          <option value="">전체 상태</option>
          <option value="true">활성</option>
          <option value="false">비활성</option>
        </select>
        <button class="btn btn-primary" onclick="showNewStaffForm()">+ 신규 직원</button>
      </div>
      <div class="text-sm text-muted mb-16" id="staff-summary"></div>
      <div id="staff-list"></div>
    </div>
  `;
}

// ── 직원 목록 렌더 ──────────────────────────────────────────────────
async function renderStaff(searchTerm) {
  const listEl = document.getElementById('staff-list');
  if (!listEl) return;
  const q = (searchTerm != null ? searchTerm : (document.getElementById('staff-search')?.value || '')).trim();
  const role = document.getElementById('staff-role-filter')?.value || '';
  const active = document.getElementById('staff-active-filter')?.value || '';

  listEl.innerHTML = `<div class="text-sm text-muted" style="padding:20px;">불러오는 중...</div>`;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (role) params.set('role', role);
  if (active) params.set('active', active);

  let rows = null;
  try {
    const r = await fetch('/api/users?' + params.toString(), { credentials: 'same-origin' });
    rows = await _staffSafeJson(r);
  } catch (err) {
    rows = null;
  }

  if (!Array.isArray(rows)) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px;">
      <div class="empty-state-text" style="color:var(--danger);">직원 목록을 불러오지 못했습니다. 권한이 없거나 세션이 만료되었을 수 있습니다.</div>
    </div>`;
    const sumEl = document.getElementById('staff-summary');
    if (sumEl) sumEl.textContent = '';
    return;
  }

  const sumEl = document.getElementById('staff-summary');
  if (sumEl) {
    const activeCount = rows.filter((u) => u.active).length;
    sumEl.innerHTML = `총 <strong>${rows.length}명</strong> | 활성 <strong>${activeCount}명</strong> | 비활성 <strong>${rows.length - activeCount}명</strong>`;
  }

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px;">
      <div class="empty-state-text">표시할 직원이 없습니다.</div>
    </div>`;
    return;
  }

  const bodyRows = rows.map((u) => {
    const roleLabel = STAFF_ROLE_LABEL[u.role] || u.role;
    const statusBadge = u.active
      ? '<span class="badge badge-complete">활성</span>'
      : '<span class="badge" style="background:var(--bg-soft);color:var(--text-muted);">비활성</span>';
    const teamAdminBadge = u.isTeamAdmin
      ? ' <span class="badge" style="background:var(--primary-lighter);color:var(--primary);font-size:11px;">팀관리자</span>'
      : '';
    // 액션 버튼: 활성 직원만 수정/비활성화/비번재발급.
    // 비활성 직원은 재활성화 endpoint 가 아직 없어 working 버튼 미제공 (아래 TODO 참고).
    let actions;
    if (u.active) {
      actions = `
        <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;" onclick="editStaff('${u.id}')">수정</button>
        <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;" onclick="resetStaffPassword('${u.id}')">비번재발급</button>
        <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;color:var(--danger);" onclick="deactivateStaff('${u.id}')">비활성화</button>
      `;
    } else {
      // TODO(STAFF-F): 재활성화 endpoint 추가 시 working 버튼으로 교체.
      //   현재 백엔드: actions/user.ts 의 reactivateUser() 는 존재하나
      //   /api/users/[id] 에 PATCH=updateUser(active 미반영) / DELETE=deactivate 만 연결됨.
      //   → 재활성화 HTTP route 없음. 임의 endpoint 발명 금지 → 준비중 표시.
      actions = `<span class="text-sm text-muted" style="font-size:11px;">재활성화(준비중)</span>`;
    }
    return `
      <tr>
        <td style="font-weight:600;">${_esc(u.name)}${teamAdminBadge}</td>
        <td style="color:var(--text-secondary);">${_esc(u.email)}</td>
        <td>${roleLabel}</td>
        <td>${statusBadge}</td>
        <td style="color:var(--text-secondary);font-size:12px;">${_fmtLastLogin(u.lastLoginAt)}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${actions}</div></td>
      </tr>
    `;
  }).join('');

  listEl.innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg-soft);text-align:left;">
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">이름</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">이메일</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">직급</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">상태</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">최근 로그인</th>
          <th style="padding:10px 12px;border-bottom:2px solid var(--border);">액션</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows.replace(/<td>/g, '<td style="padding:10px 12px;border-bottom:1px solid var(--border);">')}
      </tbody>
    </table>
    </div>
  `;
}

function filterStaff(term) {
  renderStaff(term);
}

// ── 공통: 커스텀 폼 모달 (footer 숨김 + 자체 버튼으로 async 제어) ────
// shared.js 의 showModal onConfirm 은 즉시 close 하므로,
// 검증/비동기/에러표시가 필요한 폼은 client-mgmt.js 패턴대로 자체 버튼을 둔다.
function _openStaffFormModal(title, bodyHTML) {
  showModal(title, bodyHTML);
  const overlay = document.querySelector('.modal-overlay');
  const footer = overlay?.querySelector('.modal-footer');
  if (footer) footer.style.display = 'none';
  return overlay;
}

function _closeTopModal() {
  document.querySelector('.modal-overlay')?.remove();
}

function _setFormError(msg) {
  const el = document.getElementById('staff-form-error');
  if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
}

// fieldErrors({field:[msg]}) 를 평탄화해 한 줄 메시지로
function _flattenFieldErrors(fieldErrors) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return '';
  const parts = [];
  for (const k of Object.keys(fieldErrors)) {
    const v = fieldErrors[k];
    if (Array.isArray(v) && v.length) parts.push(`${k}: ${v.join(', ')}`);
  }
  return parts.join(' / ');
}

// ── 신규 직원 폼 ────────────────────────────────────────────────────
function showNewStaffForm() {
  const roleOpts = _roleOptionsHTML(null);
  if (!roleOpts) { showToast('직원을 생성할 권한이 없습니다.', 'error'); return; }
  _openStaffFormModal('신규 직원 등록', `
    <div class="modal-form">
      <div id="staff-form-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      <div class="form-row">
        <div class="form-group">
          <label>이름 *</label>
          <input type="text" class="form-input" id="sf-name" placeholder="홍길동">
        </div>
        <div class="form-group">
          <label>직급 *</label>
          <select class="form-select" id="sf-role">${roleOpts}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이메일 *</label>
          <input type="text" class="form-input" id="sf-email" placeholder="user@altibio.local">
        </div>
        <div class="form-group">
          <label>전화</label>
          <input type="text" class="form-input" id="sf-phone" placeholder="010-0000-0000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>임시 비밀번호 *</label>
          <input type="text" class="form-input" id="sf-password" placeholder="8자 이상">
          <span class="form-note">최초 로그인 후 직원이 직접 변경하도록 안내하세요.</span>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">취소</button>
        <button class="btn btn-primary" id="sf-submit-btn" onclick="_submitNewStaff()">등록</button>
      </div>
    </div>
  `);
}

async function _submitNewStaff() {
  const btn = document.getElementById('sf-submit-btn');
  _setFormError('');
  const payload = {
    name: document.getElementById('sf-name')?.value.trim(),
    email: document.getElementById('sf-email')?.value.trim(),
    role: document.getElementById('sf-role')?.value,
    phone: document.getElementById('sf-phone')?.value.trim(),
    tempPassword: document.getElementById('sf-password')?.value,
  };
  if (!payload.name || !payload.email || !payload.tempPassword) {
    _setFormError('이름 · 이메일 · 임시 비밀번호는 필수입니다.');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '등록 중...'; }
  try {
    const r = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      const fe = data ? _flattenFieldErrors(data.fieldErrors) : '';
      _setFormError((data && data.error ? data.error : '등록 실패') + (fe ? ' (' + fe + ')' : ''));
      if (btn) { btn.disabled = false; btn.textContent = '등록'; }
      return;
    }
    // 성공: POST 는 created user object 를 201 로 반환
    _closeTopModal();
    showToast('직원이 등록되었습니다: ' + (data?.name || payload.name), 'success');
    renderStaff(document.getElementById('staff-search')?.value || '');
  } catch (err) {
    _setFormError(err.message || '등록 실패 (네트워크 오류)');
    if (btn) { btn.disabled = false; btn.textContent = '등록'; }
  }
}

// ── 직원 수정 폼 (이름 · 전화 · 직급[부여 가능 시]) — active 없음 ──
async function editStaff(id) {
  let u = null;
  try {
    const r = await fetch('/api/users/' + id, { credentials: 'same-origin' });
    u = await _staffSafeJson(r);
  } catch { u = null; }
  if (!u || !u.id) { showToast('직원 정보를 불러오지 못했습니다.', 'error'); return; }

  const assignable = _assignableRoles();
  // 대상의 현재 직급이 부여 가능 목록에 없으면 select 후보에 포함시켜 보존
  const roleListForEdit = assignable.includes(u.role) ? assignable : [u.role, ...assignable];
  const canEditRole = assignable.length > 0;
  const roleField = canEditRole
    ? `<div class="form-group">
         <label>직급</label>
         <select class="form-select" id="sf-role">
           ${roleListForEdit.map((r) => `<option value="${r}"${r === u.role ? ' selected' : ''}>${STAFF_ROLE_LABEL[r] || r}</option>`).join('')}
         </select>
       </div>`
    : `<div class="form-group">
         <label>직급</label>
         <input type="text" class="form-input" value="${STAFF_ROLE_LABEL[u.role] || u.role}" readonly style="background:var(--bg);">
       </div>`;

  _openStaffFormModal('직원 수정 — ' + _esc(u.name), `
    <div class="modal-form">
      <div id="staff-form-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      <div class="form-row">
        <div class="form-group">
          <label>이름 *</label>
          <input type="text" class="form-input" id="sf-name" value="${_esc(u.name)}">
        </div>
        ${roleField}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이메일</label>
          <input type="text" class="form-input" value="${_esc(u.email)}" readonly style="background:var(--bg);">
          <span class="form-note">이메일은 변경할 수 없습니다.</span>
        </div>
        <div class="form-group">
          <label>전화</label>
          <input type="text" class="form-input" id="sf-phone" value="${_esc(u.phone || '')}" placeholder="010-0000-0000">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">취소</button>
        <button class="btn btn-primary" id="sf-submit-btn" onclick="_submitEditStaff('${u.id}', ${canEditRole})">저장</button>
      </div>
    </div>
  `);
}

async function _submitEditStaff(id, canEditRole) {
  const btn = document.getElementById('sf-submit-btn');
  _setFormError('');
  const payload = {
    name: document.getElementById('sf-name')?.value.trim(),
    phone: document.getElementById('sf-phone')?.value.trim(),
  };
  if (canEditRole) {
    const roleEl = document.getElementById('sf-role');
    if (roleEl) payload.role = roleEl.value;
  }
  if (!payload.name) { _setFormError('이름은 필수입니다.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const r = await fetch('/api/users/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      const fe = data ? _flattenFieldErrors(data.fieldErrors) : '';
      _setFormError((data && data.error ? data.error : '수정 실패') + (fe ? ' (' + fe + ')' : ''));
      if (btn) { btn.disabled = false; btn.textContent = '저장'; }
      return;
    }
    _closeTopModal();
    showToast('직원 정보가 수정되었습니다', 'success');
    renderStaff(document.getElementById('staff-search')?.value || '');
  } catch (err) {
    _setFormError(err.message || '수정 실패 (네트워크 오류)');
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

// ── 비활성화 (DELETE) ───────────────────────────────────────────────
async function deactivateStaff(id) {
  if (!confirm('비활성화하시겠습니까?\n(계정은 삭제되지 않고 로그인만 차단됩니다)')) return;
  try {
    const r = await fetch('/api/users/' + id, { method: 'DELETE', credentials: 'same-origin' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      showToast((data && data.error) || '비활성화 실패', 'error');
      return;
    }
    // 응답에 warning(예: 영업담당자 배정 거래처) 이 있으면 함께 안내
    let msg = '비활성화됨';
    if (data && data.warning) msg += ' — ' + data.warning;
    showToast(msg, data && data.warning ? 'info' : 'success');
    renderStaff(document.getElementById('staff-search')?.value || '');
  } catch (err) {
    showToast(err.message || '비활성화 실패', 'error');
  }
}

// ── 재활성화 — 현재 endpoint 없음 (TODO STAFF-F) ────────────────────
// actions/user.ts 의 reactivateUser() 는 존재하나 HTTP route 미연결.
// 임의 endpoint 발명 금지 → 안내만.
function reactivateStaff(id) {
  showToast('재활성화 기능은 준비 중입니다. (관리자에게 문의)', 'info');
}

// ── 비밀번호 재발급 (POST /api/users/[id]/password) ─────────────────
function resetStaffPassword(id) {
  _openStaffFormModal('비밀번호 재발급', `
    <div class="modal-form">
      <div id="staff-form-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      <div class="form-group">
        <label>새 임시 비밀번호 *</label>
        <input type="text" class="form-input" id="sf-new-password" placeholder="8자 이상">
        <span class="form-note">변경 후 직원에게 직접 전달하세요.</span>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">취소</button>
        <button class="btn btn-primary" id="sf-submit-btn" onclick="_submitResetPassword('${id}')">재발급</button>
      </div>
    </div>
  `);
}

async function _submitResetPassword(id) {
  const btn = document.getElementById('sf-submit-btn');
  _setFormError('');
  const tempPassword = document.getElementById('sf-new-password')?.value;
  if (!tempPassword || tempPassword.length < 8) {
    _setFormError('비밀번호는 8자 이상이어야 합니다.');
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
  try {
    const r = await fetch('/api/users/' + id + '/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ tempPassword }),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      const fe = data ? _flattenFieldErrors(data.fieldErrors) : '';
      _setFormError((data && data.error ? data.error : '재발급 실패') + (fe ? ' (' + fe + ')' : ''));
      if (btn) { btn.disabled = false; btn.textContent = '재발급'; }
      return;
    }
    _closeTopModal();
    showToast('비밀번호가 변경되었습니다. 직원에게 전달하세요.', 'success');
  } catch (err) {
    _setFormError(err.message || '재발급 실패 (네트워크 오류)');
    if (btn) { btn.disabled = false; btn.textContent = '재발급'; }
  }
}

// ── 내 비밀번호 변경 (POST /api/me/password) — E5 에서 사용 ─────────
function changeMyPasswordUI() {
  _openStaffFormModal('비밀번호 변경', `
    <div class="modal-form">
      <div id="staff-form-error" style="display:none;color:var(--danger);font-size:13px;margin-bottom:8px;"></div>
      <div class="form-group">
        <label>현재 비밀번호 *</label>
        <input type="password" class="form-input" id="sf-cur-password" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label>새 비밀번호 *</label>
        <input type="password" class="form-input" id="sf-next-password" autocomplete="new-password" placeholder="8자 이상">
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">취소</button>
        <button class="btn btn-primary" id="sf-submit-btn" onclick="_submitMyPassword()">변경</button>
      </div>
    </div>
  `);
}

async function _submitMyPassword() {
  const btn = document.getElementById('sf-submit-btn');
  _setFormError('');
  const current = document.getElementById('sf-cur-password')?.value;
  const next = document.getElementById('sf-next-password')?.value;
  if (!current) { _setFormError('현재 비밀번호를 입력하세요.'); return; }
  if (!next || next.length < 8) { _setFormError('새 비밀번호는 8자 이상이어야 합니다.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '변경 중...'; }
  try {
    const r = await fetch('/api/me/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ current, next }),
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
    if (!r.ok || (data && data.ok === false)) {
      const fe = data ? _flattenFieldErrors(data.fieldErrors) : '';
      _setFormError((data && data.error ? data.error : '변경 실패') + (fe ? ' (' + fe + ')' : ''));
      if (btn) { btn.disabled = false; btn.textContent = '변경'; }
      return;
    }
    _closeTopModal();
    showToast('비밀번호가 변경되었습니다.', 'success');
  } catch (err) {
    _setFormError(err.message || '변경 실패 (네트워크 오류)');
    if (btn) { btn.disabled = false; btn.textContent = '변경'; }
  }
}

// ── window 노출 (onclick 핸들러용) ──────────────────────────────────
if (typeof window !== 'undefined') {
  window.buildStaffMgmtPageHTML = buildStaffMgmtPageHTML;
  window.renderStaff = renderStaff;
  window.filterStaff = filterStaff;
  window.showNewStaffForm = showNewStaffForm;
  window._submitNewStaff = _submitNewStaff;
  window.editStaff = editStaff;
  window._submitEditStaff = _submitEditStaff;
  window.deactivateStaff = deactivateStaff;
  window.reactivateStaff = reactivateStaff;
  window.resetStaffPassword = resetStaffPassword;
  window._submitResetPassword = _submitResetPassword;
  window.changeMyPasswordUI = changeMyPasswordUI;
  window._submitMyPassword = _submitMyPassword;
  window._assignableRoles = _assignableRoles;
}
