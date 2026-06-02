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
    var base = mapped
      ? Object.assign({}, o, { status: mapped, _statusEnum: o.status })
      : Object.assign({}, o);
    // QA fix(2026-06-02): 칸반 단계이동/SHIP 트랜잭션이 order.shipmentId 를 참조함.
    // /api/orders 가 include 한 최신 shipment(배열 1건)를 평탄화해 매핑.
    var ship = (Array.isArray(o.shipments) && o.shipments.length) ? o.shipments[0] : null;
    if (ship) {
      base.shipmentId = ship.id;
      if (ship.currentStageId) base.currentStageId = ship.currentStageId;
    }
    return base;
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
   * Step 2: /api/* fetch
   *
   * 역할 분기:
   *  - CLIENT  → /api/client-portal/bootstrap 단일 호출
   *             (admin 전용 endpoint 들은 requireRole 로 /403 됨)
   *  - 그 외     → 기존 15개 endpoint 병렬 호출
   *
   * 둘 다 /api/me 결과를 먼저 얻어 분기한다.
   * ─────────────────────────────────────────── */
  const loadPromise = (async () => {
    try {
      // 1) /api/me 로 role 확인
      const meRes = await fetch('/api/me');
      if (meRes.status === 401) {
        console.warn('[data-loader] 401 세션 만료 — /login 이동');
        window.location.href = '/login';
        return;
      }
      const me = meRes.ok ? await meRes.json() : null;
      if (me) window.CURRENT_USER = me;

      // 2-A) CLIENT 분기 — 단일 bootstrap endpoint
      if (me && me.role === 'CLIENT') {
        const bsRes = await fetch('/api/client-portal/bootstrap');
        if (bsRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (!bsRes.ok) {
          console.error('[data-loader] client-portal/bootstrap failed', bsRes.status);
          return;
        }
        const bs = await bsRes.json();

        /* ── prototype 호환 변환 헬퍼 ─────────────────────────────────── */

        // 제품명 → prototype 4 카테고리 (knee/upper/lower/sprint) 추정
        function _inferProductCat(name) {
          const s = String(name || '');
          if (/knee|무릎/i.test(s)) return 'knee';
          if (/elbow|shoulder|wrist|thumb|arm|팔꿈치|어깨|손목|엄지|상지|팔/i.test(s)) return 'upper';
          if (/ankle|calf|hip|leg|foot|발목|종아리|발|하지|허벅지/i.test(s)) return 'lower';
          if (/splint|스프린트|부목/i.test(s)) return 'sprint';
          return 'knee'; // fallback
        }

        // Decimal string → number (PostgreSQL Decimal 은 fetch 후 string 으로 옴)
        function _num(v) {
          if (v === null || v === undefined) return 0;
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        }

        /* ── 정규화 단계 ──────────────────────────────────────────────── */

        const normClient   = bs.client ? [normalizeClient(bs.client)] : [];

        // PRODUCTS — 핵심 변환: 사이즈별 별도 Product 로 저장된 DB 행들을 base name 으로 그룹핑.
        //
        // DB 패턴: "BAROWELLFIT L" "BAROWELLFIT M" "BAROWELLFIT S" "BAROWELLFIT XL" 각각 별도 Product
        // prototype 기대: { name: "BAROWELLFIT", sizes: ['S','M','L','XL'] } 1개로 그룹핑
        //
        // 알고리즘:
        //  1) 이름 끝의 (괄호 그룹) 분리 — "RECOTAP PLUS KNEE L(블랙)" → base="RECOTAP PLUS KNEE L", paren="(블랙)"
        //  2) base 마지막 토큰이 size (S/M/L/XL/XXL/XS/F/Free) 이면 제거 + 그 size 를 추출
        //  3) baseName = (size 제거된 base + paren) 으로 그룹핑
        //  4) 각 그룹은 합성 product (id=대표, sizes=수집된 size 집합, _sizeMap={size→realProductId})

        const SIZE_TOKENS_UC = ['XXL','XS','XL','S','M','L','F','FREE'];
        const SIZE_ORDER = { 'XS':0,'S':1,'M':2,'L':3,'XL':4,'XXL':5,'F':98,'Free':99,'STD':100 };

        function _parseProductSize(name) {
          const trimmed = String(name || '').trim();
          // 괄호 그룹 추출 (마지막 괄호만)
          const parenMatch = trimmed.match(/^(.+?)(\s*\([^()]*\))\s*$/);
          let base = parenMatch ? parenMatch[1].trim() : trimmed;
          const paren = parenMatch ? parenMatch[2] : '';
          // 마지막 공백 토큰 검사
          const tokens = base.split(/\s+/);
          if (tokens.length >= 2) {
            const last = tokens[tokens.length - 1];
            if (SIZE_TOKENS_UC.includes(last.toUpperCase())) {
              base = tokens.slice(0, -1).join(' ');
              const sizeLabel = last.toUpperCase() === 'FREE' ? 'Free' : last.toUpperCase();
              return { baseName: (base + paren).trim(), size: sizeLabel };
            }
          }
          return { baseName: (base + paren).trim(), size: 'Free' };
        }

        const _groupMap = new Map(); // baseName → group object
        for (const p of (bs.products || [])) {
          const { baseName, size } = _parseProductSize(p.name);
          let g = _groupMap.get(baseName);
          if (!g) {
            g = {
              id: 'G-' + p.id, // group id (대표 product id prefix)
              name: baseName,
              cat: _inferProductCat(baseName),
              basePrice: _num(p.basePrice),
              sizes: [],
              setQty: 1,
              side: '편측',
              stock: 0,
              sku: p.code || '',
              _sizeMap: {},        // { size: realProductId }
              _sizeRealSize: {},   // { size: realProductSizeId (첫 ProductSize.id) }
              _sizeBasePrice: {},  // { size: basePrice number }
              _members: [],        // 원본 Product[] 보존
              _category: p.category,
            };
            _groupMap.set(baseName, g);
          }
          // 같은 size 중복 시 첫 등록 유지, 가격은 평균보다 첫 것 사용
          if (!g.sizes.includes(size)) g.sizes.push(size);
          g._sizeMap[size] = g._sizeMap[size] || p.id;
          if (Array.isArray(p.sizes) && p.sizes[0]) {
            g._sizeRealSize[size] = g._sizeRealSize[size] || p.sizes[0].id;
          }
          g._sizeBasePrice[size] = _num(p.basePrice);
          g._members.push(p);
        }

        const normProducts = Array.from(_groupMap.values()).map(g => {
          // 정렬: S, M, L, XL, XXL, ...
          g.sizes.sort((a,b) => (SIZE_ORDER[a]||50) - (SIZE_ORDER[b]||50));
          // 대표 단가 = 첫 사이즈의 가격 (없으면 그룹 자체 basePrice)
          const firstSizePrice = g._sizeBasePrice[g.sizes[0]];
          if (firstSizePrice) g.basePrice = firstSizePrice;
          // sku 표기를 그룹용으로
          g.sku = g.sku || '';
          // sizes 비어 있으면 Free
          if (!g.sizes.length) g.sizes = ['Free'];
          return g;
        });

        // 발주내역 카드의 제품명 매핑을 위해 realProductId → groupId 역인덱스 작성
        // OrderItem.productId 는 realProductId 인데, 발주폼은 groupId 사용.
        // 카드 표시 시 getProductName(realProductId) 가 mock 폴백되는 것을 막기 위해
        // 별도의 PRODUCTS_BY_REAL_ID 맵을 window 에 노출.
        const _realIdToGroup = {};
        for (const g of normProducts) {
          for (const sz of g.sizes) {
            const realId = g._sizeMap[sz];
            if (realId) _realIdToGroup[realId] = { name: g.name + (sz !== 'Free' ? ' ' + sz : ''), groupId: g.id, size: sz };
          }
        }
        window.PRODUCTS_BY_REAL_ID = _realIdToGroup;

        // ORDERS — prototype 호환 alias 적용
        //  · orderDate(ISO Date) → date 'YYYY-MM-DD' 문자열 (renderHistory 의 o.date.startsWith)
        //  · items[i]: quantity → qty, unitPrice/lineTotal Decimal string → number
        //  · shippingType: '택배' default (prototype 표시용)
        //  · time: '00:00' default
        const normOrders = (bs.orders || []).map(o => {
          const norm = normalizeOrder(o);
          if (norm.orderDate && !norm.date) {
            try { norm.date = new Date(norm.orderDate).toISOString().slice(0, 10); } catch (e) { norm.date = ''; }
          }
          if (!norm.time) norm.time = '00:00';
          if (!norm.shippingType) norm.shippingType = '택배';
          if (Array.isArray(norm.items)) {
            norm.items = norm.items.map(it => Object.assign({}, it, {
              qty: it.qty != null ? _num(it.qty) : _num(it.quantity),
              unitPrice: _num(it.unitPrice),
              basePriceAtOrder: _num(it.basePriceAtOrder),
              lineTotal: _num(it.lineTotal),
              size: it.size || it.sizeCode || '',
              cat: _inferProductCat((normProducts.find(pp => pp.id === it.productId) || {}).name),
            }));
          }
          return norm;
        });

        const normInvoices = bs.invoices || [];
        // QA fix(2026-06-02): Prisma Decimal 은 문자열로 직렬화됨 → amount 를 숫자로 정규화
        // (합계 reduce 시 `+` 문자열 연결로 NaN→₩0 되는 버그 클래스 근본 차단)
        const normPayments = (bs.payments || []).map(p => ({ ...p, amount: Number(p.amount) || 0 }));
        const normLedgers  = bs.ledgers  || [];
        const normNotices  = bs.notices  || [];

        // window.* 노출 (외부 코드/디버깅용)
        window.CLIENTS = normClient;
        window.PRODUCTS = normProducts;
        window.ORDERS = normOrders;
        window.INVOICE_HISTORY = normInvoices;
        window.INVOICES = normInvoices;
        window.RECEIVABLES = normPayments;
        window.PAYMENTS = normPayments;
        window.LEDGERS = normLedgers;
        window.NOTICES = normNotices;
        window.UDI_REPORTS = [];
        window.SETTINGS = [];
        window.QUALITY_DOCS = [];
        window.PROCUREMENT_PROJECTS = [];
        window.TRANSACTIONS = [];
        window.CONFERENCES = [];
        window.EXPIRY_LOTS = [];

        // ── 핵심: data.js 의 module-scope `const` 변수는 window.X = ... 로 덮을 수 없음.
        //         in-place mutation (length=0 + push) 으로 실제 데이터를 교체한다.
        //         이래야 prototype 의 renderHistory/renderExcelForm 등이 보는 ORDERS/PRODUCTS 가 실제 데이터로 바뀜.
        const _replace = (arr, next) => {
          if (!arr || !Array.isArray(arr)) return;
          arr.length = 0;
          for (let i = 0; i < next.length; i++) arr.push(next[i]);
        };
        try { if (typeof CLIENTS    !== 'undefined') _replace(CLIENTS,    normClient);   } catch (e) {}
        try { if (typeof PRODUCTS   !== 'undefined') _replace(PRODUCTS,   normProducts); } catch (e) {}
        try { if (typeof ORDERS     !== 'undefined') _replace(ORDERS,     normOrders);   } catch (e) {}
        try { if (typeof INVOICE_HISTORY !== 'undefined') _replace(INVOICE_HISTORY, normInvoices); } catch (e) {}
        try { if (typeof RECEIVABLES !== 'undefined') _replace(RECEIVABLES, normPayments); } catch (e) {}
        try { if (typeof NOTICES    !== 'undefined') _replace(NOTICES,    normNotices);  } catch (e) {}
        try { if (typeof QUALITY_DOCS !== 'undefined') _replace(QUALITY_DOCS, []);       } catch (e) {}
        try { if (typeof PROCUREMENT_PROJECTS !== 'undefined') _replace(PROCUREMENT_PROJECTS, []); } catch (e) {}

        console.info('[data-loader] CLIENT bootstrap loaded:', {
          client: window.CLIENTS[0]?.name,
          products: window.PRODUCTS.length,
          orders: window.ORDERS.length,
          invoices: window.INVOICE_HISTORY.length,
          payments: window.RECEIVABLES.length,
          ledgers: window.LEDGERS.length,
          notices: window.NOTICES.length,
        });
        _updateSidebarUser();
        return;
      }

      // 2-B) 관리자 분기 — 기존 15-endpoint + KanbanColumn 병렬 호출
      const endpoints = [
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
        '/api/data-explorer?limit=10000',
        '/api/conferences',
        '/api/expiry',
        '/api/shipments/columns',  // ⭐ ENH-2: KanbanColumn 6단계 (DB cuid 매핑용)
      ];

      const responses = await Promise.all(endpoints.map(url => fetch(url)));

      if (responses.some(r => r.status === 401)) {
        console.warn('[data-loader] 401 세션 만료 — /login 이동');
        window.location.href = '/login';
        return;
      }

      // 안전한 JSON 파싱 — server action requireRole 거부 시 307 → /403 페이지 HTML 이 옴.
      // fetch 가 자동 follow 해서 r.ok=true 지만 r.json() 실패. content-type 검사 + try-catch 로 null 처리.
      const _safeJson = async (r) => {
        if (!r.ok) return null;
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) return null;
        try { return await r.json(); } catch { return null; }
      };

      const [
        clients, products, orders, invoices, payments,
        ledger, notices, udi, settings, manuals, procurement,
        txns, conferences, expiry,
        kanbanCols,  // ⭐ ENH-2
      ] = await Promise.all(responses.map(_safeJson));

      // 권한 거부 로그 (디버그용)
      const _denied = [];
      endpoints.forEach((url, i) => {
        const r = responses[i];
        if (!r.ok) _denied.push(`${url} (${r.status})`);
        else {
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          if (!ct.includes('application/json')) _denied.push(`${url} (non-JSON)`);
        }
      });
      if (_denied.length) console.warn('[data-loader] 권한 거부 / 비-JSON endpoint:', _denied);

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
      // prototype 칸반 stage 매핑: DB Order 에는 stage 필드가 없음. Shipment 가 있다면 currentStage 로 매핑.
      const STAGE_BY_STATUS = { 확정: 'waiting', 출고중: 'packing', 완료: 'done' };
      // 1) 정규화 단계 (window.*)
      const _normClients  = clients   ? (Array.isArray(clients)  ? clients  : (clients.data  ?? [])).map(normalizeClient) : [];
      const _normProducts = products  ? (Array.isArray(products) ? products : (products.data ?? [])) : [];
      const _normOrders   = orders    ? (Array.isArray(orders)   ? orders   : (orders.data   ?? [])).map(o => {
        const norm = normalizeOrder(o);
        // prototype 호환 alias: orderDate → date 'YYYY-MM-DD', time '00:00', shippingType '택배' default
        if (norm.orderDate && !norm.date) {
          try { norm.date = new Date(norm.orderDate).toISOString().slice(0, 10); } catch (e) { norm.date = ''; }
        }
        if (!norm.time) norm.time = '00:00';
        if (!norm.shippingType) norm.shippingType = '택배';
        // 칸반 stage default — CONFIRMED → 'waiting' (첫 컬럼 진입) / SHIPPING → 'packing' (중간) / COMPLETED → 'done'
        if (!norm.stage) norm.stage = STAGE_BY_STATUS[norm.status] || null;
        if (Array.isArray(norm.items)) {
          norm.items = norm.items.map(it => Object.assign({}, it, {
            qty: it.qty != null ? Number(it.qty) : Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || 0),
          }));
        }
        return norm;
      }) : [];
      const _normInvoices = invoices  ? (Array.isArray(invoices) ? invoices : (invoices.data ?? [])) : [];
      const _normPayments = (payments  ? (Array.isArray(payments) ? payments : (payments.data ?? [])) : []).map(p => ({ ...p, amount: Number(p.amount) || 0 }));
      const _normLedger   = ledger    ? (Array.isArray(ledger)   ? ledger   : (ledger.data   ?? [])) : [];
      const _normNotices  = notices   ? (Array.isArray(notices)  ? notices  : (notices.data  ?? [])) : [];
      const _normUdi      = udi       ? (Array.isArray(udi)      ? udi      : (udi.data      ?? [])) : [];
      const _normSettings = settings  ? (Array.isArray(settings) ? settings : (settings.data ?? [])) : [];
      const _normManuals  = manuals   ? (Array.isArray(manuals)  ? manuals  : (manuals.data  ?? [])) : [];
      const _normProcure  = procurement? (Array.isArray(procurement)? procurement: (procurement.data ?? [])) : [];
      const _normTxns     = txns      ? ((txns && txns.rows) ? txns.rows : (Array.isArray(txns) ? txns : [])) : [];
      const _normConf     = conferences? (Array.isArray(conferences)? conferences: (conferences.data ?? [])) : [];
      const _normExpiry   = expiry    ? (Array.isArray(expiry)   ? expiry   : (expiry.data   ?? [])) : [];
      // ⭐ ENH-2: KanbanColumn 정렬 (sortOrder asc) — prototype moveToNextStage 가 인덱스로 참조
      const _normKanban   = kanbanCols ? (Array.isArray(kanbanCols) ? kanbanCols : []).slice().sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0)) : [];

      // 2) window.* 노출
      window.CLIENTS              = _normClients;
      window.PRODUCTS             = _normProducts;
      window.ORDERS               = _normOrders;
      window.INVOICE_HISTORY      = _normInvoices;
      window.INVOICES             = _normInvoices;
      window.RECEIVABLES          = _normPayments;
      window.PAYMENTS             = _normPayments;
      window.LEDGERS              = _normLedger;
      window.NOTICES              = _normNotices;
      window.UDI_REPORTS          = _normUdi;
      window.SETTINGS             = _normSettings;
      window.QUALITY_DOCS         = _normManuals;
      window.PROCUREMENT_PROJECTS = _normProcure;
      window.TRANSACTIONS         = _normTxns;
      window.CONFERENCES          = _normConf;
      window.EXPIRY_LOTS          = _normExpiry;
      window.KANBAN_DB_COLUMNS    = _normKanban; // ⭐ ENH-2

      // 3) data.js module-scope const 변수 in-place mutation
      //    (CLIENT branch 와 동일한 패턴 — window.X = ... 만으로는 prototype 코드의 ORDERS 참조를 교체 못함)
      const _replaceAdmin = (arr, next) => {
        if (!arr || !Array.isArray(arr)) return;
        arr.length = 0;
        for (let i = 0; i < next.length; i++) arr.push(next[i]);
      };
      try { if (typeof CLIENTS              !== 'undefined') _replaceAdmin(CLIENTS,              _normClients);  } catch (e) {}
      try { if (typeof PRODUCTS             !== 'undefined') _replaceAdmin(PRODUCTS,             _normProducts); } catch (e) {}
      try { if (typeof ORDERS               !== 'undefined') _replaceAdmin(ORDERS,               _normOrders);   } catch (e) {}
      try { if (typeof INVOICE_HISTORY      !== 'undefined') _replaceAdmin(INVOICE_HISTORY,      _normInvoices); } catch (e) {}
      try { if (typeof RECEIVABLES          !== 'undefined') _replaceAdmin(RECEIVABLES,          _normPayments); } catch (e) {}
      try { if (typeof NOTICES              !== 'undefined') _replaceAdmin(NOTICES,              _normNotices);  } catch (e) {}
      try { if (typeof QUALITY_DOCS         !== 'undefined') _replaceAdmin(QUALITY_DOCS,         _normManuals);  } catch (e) {}
      try { if (typeof PROCUREMENT_PROJECTS !== 'undefined') _replaceAdmin(PROCUREMENT_PROJECTS, _normProcure);  } catch (e) {}

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
