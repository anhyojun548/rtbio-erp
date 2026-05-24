/**
 * RTBIO Prototype — 시스템 설정 공통 모듈 (settings-shared.js)
 *
 * admin-portal · qc-portal 공통 사용.
 * 저장 키 통일: 'rtbio-tenant-settings' (localStorage).
 * 기존 'qc-portal-settings' 키는 자동 마이그레이션.
 *
 * 공개 API:
 *   SettingsModule.init({ hostId, allowedTabs?, portal? })
 *   SettingsModule.render(tab?)
 *   SettingsModule.save()
 *   SettingsModule.reset()
 *   SettingsModule.getValue(key)
 *   SettingsModule.getAll()
 *
 * 하위 호환 (qc-portal/admin-portal 기존 함수):
 *   window.loadSettings, window.saveSettings, window.resetSettings, window.renderSettings
 */
(function (global) {
  'use strict';

  // ── 기본값 ───────────────────────────────────────────────────────
  const DEFAULTS = {
    // 업무시간
    workStart: '09:00',
    workEnd:   '18:00',
    lunchStart: '12:00',
    lunchEnd:   '13:00',
    // 출고
    parcelCutoff: '15:30',
    quickCutoff:  '17:00',
    dailyLimit:   300,        // 수량 기준
    // 재고
    stockWarn:     60,
    stockCritical: 30,
    // 보안
    sessionTtlHours: 2,
    loginFailLock:   5,
    // 회사 정보
    companyName:   '주식회사 알티바이오 (RTBIO)',
    bizNumber:     '123-45-67890',
    ceo:           '홍길동',
    bizType:       '제조업, 도매업',
    bizItem:       '의료기기, 의료용품',
    address:       '서울시 강남구 테헤란로 521 RTBIO빌딩',
    phone:         '02-1234-5678',
    fax:           '02-1234-5679',
    // 이메일
    smtpHost:      'smtp.rtbio.co.kr',
    smtpPort:      587,
    senderEmail:   'admin@rtbio.co.kr',
  };

  const STORAGE_KEY = 'rtbio-tenant-settings';
  const LEGACY_KEY  = 'qc-portal-settings'; // qc 호환

  // ── 모듈 상태 ────────────────────────────────────────────────────
  let _hostId = 'settings-content';
  let _tabBarId = 'settings-tab-bar';
  let _currentTab = 'basic';
  let _allowedTabs = ['basic', 'inventory', 'company', 'email', 'suppliers'];

  const TABS = [
    { id: 'basic',     label: '⏰ 기본 설정' },
    { id: 'inventory', label: '📦 재고 설정' },
    { id: 'company',   label: '🏢 회사 정보' },
    { id: 'email',     label: '✉️ 이메일' },
    { id: 'suppliers', label: '🤝 공급업체' },
  ];

  // ── 저장소 ────────────────────────────────────────────────────────
  function loadStorage() {
    let saved = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
      else {
        // 레거시 키 마이그레이션
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          saved = JSON.parse(legacy);
          localStorage.setItem(STORAGE_KEY, legacy);
        }
      }
    } catch (e) { saved = {}; }
    return Object.assign({}, DEFAULTS, saved);
  }
  function saveStorage(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      // 레거시 키도 같이 갱신 (qc-portal 기존 코드 호환)
      localStorage.setItem(LEGACY_KEY, JSON.stringify(s));
      return true;
    } catch (e) { return false; }
  }

  // ── 초기화 ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    if (opts.hostId)      _hostId = opts.hostId;
    if (opts.tabBarId)    _tabBarId = opts.tabBarId;
    if (Array.isArray(opts.allowedTabs) && opts.allowedTabs.length) {
      _allowedTabs = opts.allowedTabs;
      if (!_allowedTabs.includes(_currentTab)) _currentTab = _allowedTabs[0];
    }
    // 탭 바를 모듈이 직접 그릴 수도 있게
    if (opts.renderTabBar) renderTabBar();
  }

  // ── 탭 바 렌더 (옵션) ─────────────────────────────────────────────
  function renderTabBar() {
    const bar = document.getElementById(_tabBarId);
    if (!bar) return;
    bar.innerHTML = TABS.filter(t => _allowedTabs.includes(t.id)).map(t => `
      <button class="tab-btn ${t.id === _currentTab ? 'active' : ''}" data-tab="${t.id}" onclick="SettingsModule.render('${t.id}')">${t.label}</button>
    `).join('');
  }

  // ── 메인 렌더 ────────────────────────────────────────────────────
  function render(tab) {
    if (tab) {
      if (!_allowedTabs.includes(tab)) tab = _allowedTabs[0];
      _currentTab = tab;
    }
    // 탭 active 갱신
    document.querySelectorAll(`#${_tabBarId} .tab-btn`).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === _currentTab);
    });

    const host = document.getElementById(_hostId);
    if (!host) return;
    const s = loadStorage();

    if (_currentTab === 'basic') {
      host.innerHTML = renderBasic(s);
    } else if (_currentTab === 'inventory') {
      host.innerHTML = renderInventory(s);
    } else if (_currentTab === 'company') {
      host.innerHTML = renderCompany(s);
    } else if (_currentTab === 'email') {
      host.innerHTML = renderEmail(s);
    } else if (_currentTab === 'suppliers') {
      host.innerHTML = renderSuppliers(s);
    }
  }

  // ── 기본 설정 ────────────────────────────────────────────────────
  function renderBasic(s) {
    return `
      <div class="settings-form" style="max-width:720px;">
        <div class="settings-section-title">⏰ 업무 시간</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>업무 시작</label>
            <input type="time" class="form-input" id="setting-work-start" value="${s.workStart}">
          </div>
          <div class="form-group">
            <label>업무 종료</label>
            <input type="time" class="form-input" id="setting-work-end" value="${s.workEnd}">
          </div>
        </div>
        <div class="form-group">
          <label>점심시간</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="time" class="form-input" id="setting-lunch-start" value="${s.lunchStart}" style="flex:1;">
            <span>~</span>
            <input type="time" class="form-input" id="setting-lunch-end" value="${s.lunchEnd}" style="flex:1;">
          </div>
        </div>

        <div class="settings-section-title" style="margin-top:24px;">📦 출고 마감</div>
        <div class="form-group">
          <label>택배 접수 마감 시각 <span style="color:var(--text-muted);font-size:12px;">(이후는 익일 출고)</span></label>
          <input type="time" class="form-input" id="setting-parcel-cutoff" value="${s.parcelCutoff}">
        </div>
        <div class="form-group">
          <label>퀵배송 마감 시각</label>
          <input type="time" class="form-input" id="setting-quick-cutoff" value="${s.quickCutoff}">
        </div>
        <div class="form-group">
          <label>일일 출고 처리 한도 <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(수량 기준)</span></label>
          <input type="number" class="form-input" id="setting-daily-limit" value="${s.dailyLimit}" min="1" step="10">
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">발주 건수가 아닌 <strong>실제 출고 수량</strong> 기준</div>
        </div>

        <div class="settings-section-title" style="margin-top:24px;">🔐 보안</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>세션 유효 시간 (시간)</label>
            <input type="number" class="form-input" id="setting-session-ttl" value="${s.sessionTtlHours}" min="1" max="24">
          </div>
          <div class="form-group">
            <label>로그인 실패 잠금 (회)</label>
            <input type="number" class="form-input" id="setting-login-fail" value="${s.loginFailLock}" min="3" max="10">
          </div>
        </div>

        ${renderActionsRow()}
      </div>
    `;
  }

  // ── 재고 설정 ────────────────────────────────────────────────────
  function renderInventory(s) {
    return `
      <div class="settings-form" style="max-width:720px;">
        <div class="settings-section-title">📊 재고 임계치</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>경고 임계치 (개)</label>
            <input type="number" class="form-input" id="setting-stock-warn" value="${s.stockWarn}" min="0">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">이 수량 이하면 LOW 단계</div>
          </div>
          <div class="form-group">
            <label>부족 임계치 (개)</label>
            <input type="number" class="form-input" id="setting-stock-critical" value="${s.stockCritical}" min="0">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">이 수량 이하면 OUT 단계</div>
          </div>
        </div>
        <div style="background:#FFF8E1;padding:12px 16px;border-radius:8px;font-size:13px;color:#795548;margin-top:16px;">
          ⚠️ 임계치는 사이즈별 안전재고 계산에 사용됩니다. 부족 임계치 ≤ 경고 임계치 권장.
        </div>
        ${renderActionsRow()}
      </div>
    `;
  }

  // ── 회사 정보 ────────────────────────────────────────────────────
  function renderCompany(s) {
    return `
      <div class="settings-form" style="max-width:720px;">
        <div class="settings-section-title">🏢 회사 기본 정보</div>
        <div class="form-group">
          <label>회사명</label>
          <input type="text" class="form-input" id="setting-company-name" value="${escapeAttr(s.companyName)}">
        </div>
        <div class="form-group">
          <label>사업자등록번호</label>
          <input type="text" class="form-input" id="setting-biz-number" value="${escapeAttr(s.bizNumber)}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>대표자</label>
            <input type="text" class="form-input" id="setting-ceo" value="${escapeAttr(s.ceo)}">
          </div>
          <div class="form-group">
            <label>업태</label>
            <input type="text" class="form-input" id="setting-biz-type" value="${escapeAttr(s.bizType)}">
          </div>
        </div>
        <div class="form-group">
          <label>종목</label>
          <input type="text" class="form-input" id="setting-biz-item" value="${escapeAttr(s.bizItem)}">
        </div>

        <div class="settings-section-title" style="margin-top:24px;">📍 연락처</div>
        <div class="form-group">
          <label>주소</label>
          <input type="text" class="form-input" id="setting-address" value="${escapeAttr(s.address)}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>전화번호</label>
            <input type="text" class="form-input" id="setting-phone" value="${escapeAttr(s.phone)}">
          </div>
          <div class="form-group">
            <label>팩스번호</label>
            <input type="text" class="form-input" id="setting-fax" value="${escapeAttr(s.fax)}">
          </div>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">* 거래명세서·세금계산서에 자동으로 표시됩니다.</p>

        ${renderActionsRow()}
      </div>
    `;
  }

  // ── 이메일 ────────────────────────────────────────────────────────
  function renderEmail(s) {
    return `
      <div class="settings-form" style="max-width:720px;">
        <div class="settings-section-title">✉️ SMTP 설정</div>
        <div class="form-group">
          <label>SMTP Host</label>
          <input type="text" class="form-input" id="setting-smtp-host" value="${escapeAttr(s.smtpHost)}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>SMTP Port</label>
            <input type="number" class="form-input" id="setting-smtp-port" value="${s.smtpPort}">
          </div>
          <div class="form-group">
            <label>발신 이메일</label>
            <input type="email" class="form-input" id="setting-sender-email" value="${escapeAttr(s.senderEmail)}">
          </div>
        </div>
        <div style="background:#E3F2FD;padding:12px 16px;border-radius:8px;font-size:13px;color:#1565C0;margin-top:16px;">
          💡 실개발 단계에서 Daum SMTP (smtp.daum.net:465 SSL) 사용 예정.
        </div>

        ${renderActionsRow()}
      </div>
    `;
  }

  // ── 공급업체 (admin만) ───────────────────────────────────────────
  function renderSuppliers(s) {
    const suppliers = [
      { name: '메디텍코리아', contact: '02-555-1234', manager: '박영수', email: 'park@meditek.co.kr' },
      { name: '한국의료기',   contact: '031-777-5678', manager: '이정환', email: 'lee@hankookmed.co.kr' },
      { name: '글로벌메드',   contact: '02-333-9012', manager: '김미선', email: 'kim@globalmed.co.kr' },
    ];
    return `
      <div class="table-wrap" style="max-width:900px;">
        <table class="data-table">
          <thead><tr>
            <th>업체명</th><th>연락처</th><th>담당자</th><th>이메일</th><th>액션</th>
          </tr></thead>
          <tbody>
            ${suppliers.map(sp => `
              <tr>
                <td class="fw-600">${escapeHtml(sp.name)}</td>
                <td>${escapeHtml(sp.contact)}</td>
                <td>${escapeHtml(sp.manager)}</td>
                <td>${escapeHtml(sp.email)}</td>
                <td><button class="btn btn-outline btn-sm" onclick="showToast('수정 모드로 전환되었습니다','info')">수정</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:16px;">
        <button class="btn btn-primary" onclick="showToast('신규 공급업체 등록 화면이 열렸습니다','info')">+ 신규 등록</button>
      </div>
    `;
  }

  // ── 액션 영역 (저장/초기화) ──────────────────────────────────────
  function renderActionsRow() {
    return `
      <div style="margin-top:24px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="SettingsModule.reset()">기본값 복원</button>
        <button class="btn btn-primary" onclick="SettingsModule.save()">💾 저장</button>
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
        저장 시 브라우저(localStorage)에 보관됩니다. 실개발 단계에서는 테넌트 설정 DB에 저장됩니다.
      </div>
    `;
  }

  // ── 저장 — localStorage + PATCH /api/settings (서버 동기화) ────────
  function save() {
    const current = loadStorage();
    const get = id => {
      const el = document.getElementById(id);
      return el ? el.value : undefined;
    };
    const getInt = id => {
      const v = get(id);
      const n = parseInt(v, 10);
      return isNaN(n) ? undefined : n;
    };

    const updates = {};
    // 탭별로 현재 화면에 있는 필드만 수집
    if (_currentTab === 'basic') {
      Object.assign(updates, {
        workStart:       get('setting-work-start'),
        workEnd:         get('setting-work-end'),
        lunchStart:      get('setting-lunch-start'),
        lunchEnd:        get('setting-lunch-end'),
        parcelCutoff:    get('setting-parcel-cutoff'),
        quickCutoff:     get('setting-quick-cutoff'),
        dailyLimit:      getInt('setting-daily-limit'),
        sessionTtlHours: getInt('setting-session-ttl'),
        loginFailLock:   getInt('setting-login-fail'),
      });
    } else if (_currentTab === 'inventory') {
      Object.assign(updates, {
        stockWarn:     getInt('setting-stock-warn'),
        stockCritical: getInt('setting-stock-critical'),
      });
    } else if (_currentTab === 'company') {
      Object.assign(updates, {
        companyName: get('setting-company-name'),
        bizNumber:   get('setting-biz-number'),
        ceo:         get('setting-ceo'),
        bizType:     get('setting-biz-type'),
        bizItem:     get('setting-biz-item'),
        address:     get('setting-address'),
        phone:       get('setting-phone'),
        fax:         get('setting-fax'),
      });
    } else if (_currentTab === 'email') {
      Object.assign(updates, {
        smtpHost:    get('setting-smtp-host'),
        smtpPort:    getInt('setting-smtp-port'),
        senderEmail: get('setting-sender-email'),
      });
    }

    // undefined 제거
    Object.keys(updates).forEach(function(k) { if (updates[k] === undefined) delete updates[k]; });

    const merged = Object.assign({}, current, updates);
    // 1. 로컬 저장 (오프라인 fallback)
    saveStorage(merged);

    // 2. 서버 동기화 — PATCH /api/settings (bulk: items 배열 형식)
    // TENANT_SETTING_KEYS 와 일치하는 키만 전송
    var SERVER_KEYS = ['business_hour_start', 'business_hour_end', 'shipping_cutoff', 'reorder_multiplier', 'vat_rate'];
    var KEY_MAP = {
      workStart:      'business_hour_start',
      workEnd:        'business_hour_end',
      parcelCutoff:   'shipping_cutoff',
      stockWarn:      'reorder_multiplier', // 경고 임계치 → reorder_multiplier 근사
      // 나머지는 서버 스키마 없음 — localStorage 전용
    };
    var serverItems = [];
    Object.keys(updates).forEach(function(k) {
      var serverKey = KEY_MAP[k];
      if (serverKey && updates[k] !== undefined && updates[k] !== null) {
        serverItems.push({ key: serverKey, value: String(updates[k]) });
      }
    });

    if (serverItems.length > 0 && global.apiClient && typeof global.apiClient.patch === 'function') {
      global.apiClient.patch('/api/settings', { items: serverItems })
        .then(function() {
          if (typeof showToast === 'function') showToast('설정이 저장되었습니다', 'success');
        })
        .catch(function(err) {
          // 서버 저장 실패 시에도 로컬엔 저장됨 — 경고만 표시
          if (typeof showToast === 'function') showToast('로컬 저장 완료 (서버 동기화 실패: ' + (err && err.message || '오류') + ')', 'warning');
        });
    } else {
      if (typeof showToast === 'function') showToast('설정이 저장되었습니다', 'success');
    }
  }

  // ── 초기화 ────────────────────────────────────────────────────────
  function reset() {
    const proceed = () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_KEY);
      } catch (e) {}
      render();
      if (typeof showToast === 'function') showToast('기본값으로 복원되었습니다', 'info');
    };
    if (typeof showModal === 'function') {
      showModal('기본값 복원', '모든 설정을 기본값으로 되돌리시겠습니까?', proceed);
    } else if (confirm('모든 설정을 기본값으로 되돌리시겠습니까?')) {
      proceed();
    }
  }

  // ── 외부 read API ────────────────────────────────────────────────
  function getValue(key) { return loadStorage()[key]; }
  function getAll() { return loadStorage(); }

  // ── 유틸 ─────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 공개 API ──────────────────────────────────────────────────────
  global.SettingsModule = {
    init,
    render,
    save,
    reset,
    renderTabBar,
    getValue,
    getAll,
    DEFAULTS,
    STORAGE_KEY,
    TABS,
  };

  // 하위 호환
  global.renderSettings = render;
  global.saveSettings   = save;
  global.resetSettings  = reset;
  global.loadSettings   = function () {
    // qc-portal 의 기존 동작: 정적 input 들에 값 채워넣기
    const s = loadStorage();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('setting-work-start',     s.workStart);
    set('setting-work-end',       s.workEnd);
    set('setting-lunch-start',    s.lunchStart);
    set('setting-lunch-end',      s.lunchEnd);
    set('setting-parcel-cutoff',  s.parcelCutoff);
    set('setting-quick-cutoff',   s.quickCutoff);
    set('setting-daily-limit',    s.dailyLimit);
    set('setting-stock-warn',     s.stockWarn);
    set('setting-stock-critical', s.stockCritical);
  };

})(window);
