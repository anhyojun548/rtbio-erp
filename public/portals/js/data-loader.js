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

/* ─────────────────────────────────────────────────────────────
 * API enum → prototype mock 형식 어댑터 (FIX-B5)
 *
 * DB/API 는 영문 enum 을 반환하지만, prototype JS 는 한글 값으로 분기함.
 * 이 매핑 + normalize 함수가 그 간극을 해소한다.
 *
 * 주의:
 *   - INVOICE_HISTORY (SENT/ISSUED/CANCELLED) 와 UDI_REPORTS (SUBMITTED/PENDING) 는
 *     prototype mock 도 영문 enum 을 그대로 사용하므로 변환하지 않는다.
 *   - _typeEnum / _statusEnum 에 원본 영문 값을 보존해 두어
 *     API 쓰기 호출 시 다시 영문으로 변환할 수 있게 한다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ───────────────────────────────────────────
   * [FIX-B5] 매핑 테이블
   * ─────────────────────────────────────────── */

  /** Client.type: DB enum → prototype 한글 */
  var CLIENT_TYPE_MAP = {
    HOSPITAL: '병원',
    AGENCY:   '대리점',
    OTHER:    '기타',
  };

  /**
   * Order.status: DB enum → prototype 한글
   *
   * admin-portal.html 의 일부 오래된 분기는 이미
   *   o.status === '접수' || o.status === 'SUBMITTED'
   * 처럼 두 값을 모두 허용하므로 변환 후에도 안전하다.
   */
  var ORDER_STATUS_MAP = {
    DRAFT:     '임시저장',
    SUBMITTED: '접수',
    CONFIRMED: '확정',
    SHIPPING:  '출고중',
    COMPLETED: '완료',
    CANCELLED: '취소',
    HELD:      '보류',
    REJECTED:  '반려',
  };

  /* INVOICE_HISTORY.status 는 prototype mock 이 영문(SENT/ISSUED/CANCELLED)을
   * 그대로 사용하고 admin-portal.html 도 영문으로 분기하므로 변환 불필요. */

  /* UDI_REPORTS.status 도 prototype/admin 양쪽이 영문(SUBMITTED/PENDING)으로 비교하므로
   * 변환 불필요. */

  /**
   * normalize 함수들
   * - 원본 영문 enum 을 _typeEnum / _statusEnum 에 보존해 두어
   *   API POST/PATCH 시 원래 값으로 다시 변환 가능하게 한다.
   */

  function normalizeClient(c) {
    if (!c || typeof c !== 'object') return c;
    var mapped = CLIENT_TYPE_MAP[c.type];
    var base = mapped
      ? Object.assign({}, c, { type: mapped, _typeEnum: c.type })
      : Object.assign({}, c);
    // prototype 호환 derived fields (API 응답에 없는 필드 fallback)
    // prototype 의 client card / getClientById 등이 참조하는 필드들
    base.manager        = base.manager        || base.representative || base.contactName || '-';
    base.salesRep       = base.salesRep       || base.salesRepName   || '-';
    base.paymentMethod  = base.paymentMethod  || base.paymentTerms   || '계좌이체';
    base.closingPeriod  = base.closingPeriod  || '1월~말일';
    base.priceListName  = base.priceListName  || 'RTBIO';
    base.discounts      = base.discounts      || {};
    base.fixedPrices    = base.fixedPrices    || [];
    return base;
  }

  function normalizeOrder(o) {
    if (!o || typeof o !== 'object') return o;
    var mapped = ORDER_STATUS_MAP[o.status];
    return mapped
      ? Object.assign({}, o, { status: mapped, _statusEnum: o.status })
      : o;
  }

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
        '/api/data-explorer?limit=10000',  // 매출 집계 정확도 (41K 중 최근 10K)
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

      /* window.X 덮어쓰기 — data.js 의 mock 을 API 결과로 교체
       *
       * [FIX-B5] normalizeClient / normalizeOrder 를 통해
       * DB 영문 enum → prototype 한글 값으로 정규화.
       *
       * normalizeClient : Client.type  HOSPITAL→병원, AGENCY→대리점, OTHER→기타
       * normalizeOrder  : Order.status DRAFT→임시저장, SUBMITTED→접수, CONFIRMED→확정,
       *                               SHIPPING→출고중, COMPLETED→완료, CANCELLED→취소,
       *                               HELD→보류, REJECTED→반려
       *
       * INVOICE_HISTORY / UDI_REPORTS 는 prototype 과 API 양쪽이 영문 enum 을
       * 그대로 사용하므로 변환하지 않는다.
       */
      if (me)           window.CURRENT_USER       = me;
      if (clients)      window.CLIENTS             = (Array.isArray(clients)    ? clients    : (clients.data    ?? [])).map(normalizeClient);
      if (products)     window.PRODUCTS            = Array.isArray(products)   ? products   : (products.data   ?? []);
      if (orders)       window.ORDERS              = (Array.isArray(orders)     ? orders     : (orders.data     ?? [])).map(normalizeOrder);
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

      // FINAL 진단: DOMContentLoaded 큐 실행 이후 실제 데이터 양 확인
      // (data-explorer-schemas.js 의 exposeData 가 OR-guard 로 덮어쓰지 않는지 검증)
      console.info('[data-loader] FINAL:', {
        clients:     (window.CLIENTS  || []).length,
        products:    (window.PRODUCTS || []).length,
        orders:      (window.ORDERS   || []).length,
        firstClient: window.CLIENTS && window.CLIENTS[0] ? window.CLIENTS[0].name : null,
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
