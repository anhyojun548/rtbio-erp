/**
 * data-loader.js
 * prototype 의 mock 데이터(window.CLIENTS 등) 를 /api/* fetch 결과로 채움.
 *
 * 로딩 순서: data.js → data-loader.js → 나머지 스크립트 → 인라인 스크립트
 *
 * 전략:
 * 1. document.addEventListener('DOMContentLoaded', ...) 를 일시 패치
 *    → 인라인 스크립트가 등록한 핸들러를 큐에 적재
 * 2. /api/* fetch (병렬) 완료 → window.X 덮어쓰기
 * 3. 원래 addEventListener 복원 후 큐 순서대로 실행
 *
 * 이렇게 하면 prototype 의 renderXxx() 가 항상 API 데이터를 보게 됨.
 */
(function () {
  'use strict';

  /* ───────────────────────────────────────────
   * Step 1: DOMContentLoaded 인터셉트 설정
   * ─────────────────────────────────────────── */
  const _originalAddEventListener = document.addEventListener.bind(document);
  const _dclQueue = []; // { listener, options }

  document.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded') {
      _dclQueue.push({ listener, options });
      return;
    }
    return _originalAddEventListener(type, listener, options);
  };

  /* ───────────────────────────────────────────
   * Step 2: /api/* fetch (모두 병렬)
   * ─────────────────────────────────────────── */
  const loadPromise = (async () => {
    try {
      const endpoints = [
        '/api/me',
        '/api/clients',
        '/api/products',
        '/api/orders',
        '/api/invoices',
        '/api/payments',
        '/api/ledger',
        '/api/notices',
        '/api/udi',
        '/api/settings',
        '/api/manuals',
        '/api/procurement',
        '/api/data-explorer?limit=200',
        '/api/conferences',
        '/api/expiry',
      ];

      const responses = await Promise.all(endpoints.map(url => fetch(url)));

      // 401 → 세션 만료 처리
      if (responses.some(r => r.status === 401)) {
        console.warn('[data-loader] 401 세션 만료 — /login 이동');
        window.location.href = '/login';
        return;
      }

      const [
        me, clients, products, orders, invoices, payments,
        ledger, notices, udi, settings, manuals, procurement,
        txns, conferences, expiry,
      ] = await Promise.all(responses.map(r => (r.ok ? r.json() : null)));

      /* window.X 덮어쓰기 — data.js 의 mock 을 API 결과로 교체 */
      if (me)           window.CURRENT_USER       = me;
      if (clients)      window.CLIENTS             = Array.isArray(clients)    ? clients    : (clients.data    ?? []);
      if (products)     window.PRODUCTS            = Array.isArray(products)   ? products   : (products.data   ?? []);
      if (orders)       window.ORDERS              = Array.isArray(orders)     ? orders     : (orders.data     ?? []);
      if (invoices)     window.INVOICE_HISTORY     = Array.isArray(invoices)   ? invoices   : (invoices.data   ?? []);
      if (payments)     window.RECEIVABLES         = Array.isArray(payments)   ? payments   : (payments.data   ?? []);
      if (ledger)       window.LEDGERS             = Array.isArray(ledger)     ? ledger     : (ledger.data     ?? []);
      if (notices)      window.NOTICES             = Array.isArray(notices)    ? notices    : (notices.data    ?? []);
      if (udi)          window.UDI_REPORTS         = Array.isArray(udi)        ? udi        : (udi.data        ?? []);
      if (settings)     window.SETTINGS            = Array.isArray(settings)   ? settings   : (settings.data   ?? []);
      if (manuals)      window.QUALITY_DOCS        = Array.isArray(manuals)    ? manuals    : (manuals.data    ?? []);
      if (procurement)  window.PROCUREMENT_PROJECTS= Array.isArray(procurement)? procurement: (procurement.data ?? []);
      if (txns)         window.TRANSACTIONS        = (txns && txns.rows)       ? txns.rows  : (Array.isArray(txns) ? txns : []);
      if (conferences)  window.CONFERENCES         = Array.isArray(conferences)? conferences: (conferences.data ?? []);
      if (expiry)       window.EXPIRY_LOTS         = Array.isArray(expiry)     ? expiry     : (expiry.data     ?? []);

      console.info('[data-loader] loaded:', {
        clients:      (window.CLIENTS       || []).length,
        products:     (window.PRODUCTS      || []).length,
        orders:       (window.ORDERS        || []).length,
        invoices:     (window.INVOICE_HISTORY || []).length,
        notices:      (window.NOTICES       || []).length,
        udi:          (window.UDI_REPORTS   || []).length,
        transactions: (window.TRANSACTIONS  || []).length,
        conferences:  (window.CONFERENCES   || []).length,
        expiry:       (window.EXPIRY_LOTS   || []).length,
      });

      /* FIX-B4: 사이드바 사용자명 / 역할 / 아바타 → window.CURRENT_USER 반영 */
      _updateSidebarUser();
    } catch (err) {
      console.error('[data-loader] fetch failed — prototype mock data 유지됨', err);
    }
  })();

  /* ───────────────────────────────────────────
   * 사이드바 사용자 정보 업데이트
   * ─────────────────────────────────────────── */
  function _updateSidebarUser() {
    const u = window.CURRENT_USER;
    if (!u) return;
    const displayName = u.name || u.email || '';
    const roleLabelMap = {
      TENANT_OWNER: '대표이사',
      ADMIN:        '경영지원팀',
      EXEC:         '영업팀',
      QC:           '품질관리팀',
      CLIENT:       '거래처',
      SUPER_ADMIN:  '시스템관리자',
    };
    const roleLabel = roleLabelMap[u.role] || u.role || '';
    const avatarChar = displayName.charAt(0) || '?';

    document.querySelectorAll('.sidebar-user-name').forEach(el => {
      el.textContent = displayName;
    });
    document.querySelectorAll('.sidebar-user-role').forEach(el => {
      el.textContent = roleLabel;
    });
    document.querySelectorAll('.sidebar-user-avatar').forEach(el => {
      el.textContent = avatarChar;
    });
    console.info('[data-loader] sidebar user updated:', displayName, roleLabel);
  }

  /* ───────────────────────────────────────────
   * Step 3: DOMContentLoaded 복원 및 큐 실행
   * ─────────────────────────────────────────── */
  async function flushDCLQueue() {
    await loadPromise;

    // addEventListener 원복 (이후 등록은 즉시 실행)
    document.addEventListener = _originalAddEventListener;

    // 큐에 쌓인 핸들러를 등록 순서대로 실행
    const fakeEvent = new Event('DOMContentLoaded');
    for (const { listener } of _dclQueue) {
      try {
        if (typeof listener === 'function') {
          listener(fakeEvent);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(fakeEvent);
        }
      } catch (e) {
        console.warn('[data-loader] DOMContentLoaded handler error:', e);
      }
    }
    _dclQueue.length = 0;
  }

  // DOM 이 이미 파싱 완료됐을 수도 있음 (스크립트가 body 끝에 있는 경우)
  if (document.readyState === 'loading') {
    _originalAddEventListener('DOMContentLoaded', flushDCLQueue);
  } else {
    // DOM 이미 ready — 즉시 실행
    flushDCLQueue();
  }
})();
