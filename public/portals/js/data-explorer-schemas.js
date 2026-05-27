/**
 * 데이터 탐색기 — 테이블 스키마 정의 (메타데이터 기반 자동 폼/그리드)
 *
 * 구조:
 *   key         : 테이블 식별자 (전역 mock 배열 이름 기반)
 *   label       : 사이드 메뉴/select 노출명
 *   icon        : 메뉴 아이콘
 *   description : 부연 설명
 *   teams       : 접근 가능 팀 (admin/sales/qc/ceo)
 *   permissions : {read, create, update, delete} 팀별 권한
 *   pkField     : Primary key 컬럼 id
 *   sourceVar   : window 전역 배열 이름 (예: 'CLIENTS')
 *   columns     : [{id, label, type, ...}, ...] 컬럼 메타데이터
 *
 * 컬럼 type:
 *   text · number · currency · date · datetime · tel · email · textarea
 *   select(options:[...]) · multiselect(options:[...]) · boolean
 *   fk(targetTable, targetKey, displayField) — 외래키
 *   readonly · password
 *   computed(formula) — 계산 컬럼 (편집 불가)
 *
 * 컬럼 옵션:
 *   editable: true|false (기본 true)
 *   required: true|false
 *   inGrid: true|false (그리드 표시 여부, 기본 true)
 *   inForm: true|false (편집 폼 표시 여부, 기본 true)
 *   width: 그리드 컬럼 너비 (예: '120px')
 *   align: 'left'|'right'|'center'
 *   filter: true|false (필터 활성 여부)
 *   sort: true|false (정렬 가능 여부, 기본 true)
 */

const DE_SCHEMAS = {
  // ════════════════════════════════════════════════════════════
  // 거래처 (Client)
  // ════════════════════════════════════════════════════════════
  client: {
    key: 'client',
    label: '거래처',
    icon: '',
    description: '대리점·병원 거래처 정보',
    teams: ['admin', 'sales', 'qc', 'ceo'],
    permissions: {
      admin: { read: true, create: true, update: true, delete: true },
      sales: { read: true, create: false, update: true, delete: false },
      qc:    { read: true, create: false, update: false, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'id',
    sourceVar: 'CLIENTS',
    apiBase: '/api/clients',
    columns: [
      { id: 'id',             label: '코드',         type: 'text',     required: true, width: '70px', filter: true },
      { id: 'name',           label: '거래처명',     type: 'text',     required: true, width: '140px', filter: true },
      { id: 'type',           label: '유형',         type: 'select',   options: ['대리점','병원','기타'], required: true, width: '70px', filter: true },
      { id: 'specialty',      label: '진료과',       type: 'select',   options: ['정형외과','재활의학과','마취통증','신경외과','요양병원','기타'], width: '100px', filter: true },
      { id: 'doctorCount',    label: '의사수',       type: 'number',   width: '70px', align: 'right'},
      { id: 'manager',        label: '담당자(내부)', type: 'text',     width: '90px'},
      { id: 'phone',          label: '연락처',       type: 'tel',      width: '130px'},
      { id: 'email',          label: '이메일',       type: 'email',    width: '160px', inGrid: false },
      { id: 'address',        label: '주소',         type: 'text',     width: '200px', inGrid: false },
      // 경영지원팀 #4 (2026-05): 병원결제방식 엑셀 자료 기반 옵션 확장
      { id: 'paymentType',    label: '결제방식',     type: 'select',
        options: [
          '당월 말(카드결제)', '당월 말(계좌입금)',
          '익월 말(카드결제)', '익월 말(계좌입금)', '익월 초(카드결제)',
          '사용량(카드결제)', '사용량(계좌입금)', '익월말 사용량 카드',
          '계좌이체', '당월말카드', '사용량카드', '3개월후결제',  // 기존 옵션 호환
        ],
        width: '160px', filter: true },
      // 경영지원팀 #4 (2026-05): 영업 담당자 (RTBIO 내부 직원)
      { id: 'salesRep',       label: '영업담당자',   type: 'select',
        options: ['박진우','배경동','신현호'],
        width: '100px', filter: true },
      { id: 'closingPeriod',  label: '마감기간',     type: 'text',     width: '120px'},
      { id: 'invoiceType',    label: '명세서양식',   type: 'select',   options: ['RTBIO','거래처'], width: '90px'},
      { id: 'freeShipping',   label: '무료배송',     type: 'boolean',  width: '80px', align: 'center'},
      { id: 'loginId',        label: '로그인ID',     type: 'text',     width: '100px', inGrid: false },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 제품 (Product)
  // ════════════════════════════════════════════════════════════
  product: {
    key: 'product',
    label: '제품',
    icon: '',
    description: '판매 제품 카탈로그',
    teams: ['admin', 'sales', 'qc', 'ceo'],
    permissions: {
      admin: { read: true, create: true, update: true, delete: true },
      sales: { read: true, create: false, update: false, delete: false },
      qc:    { read: true, create: true, update: true, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'id',
    sourceVar: 'PRODUCTS',
    apiBase: '/api/products',
    columns: [
      { id: 'id',             label: 'ID',          type: 'text',     required: true, width: '70px'},
      { id: 'sku',            label: 'SKU',         type: 'text',     required: true, width: '120px', filter: true },
      { id: 'name',           label: '제품명',       type: 'text',     required: true, width: '180px', filter: true },
      { id: 'category',       label: '카테고리',     type: 'select',   options: ['무릎','손목','팔꿈치','발목','어깨','쇄골','발가락','단족','보조기','기타'], required: true, width: '90px', filter: true },
      { id: 'basePrice',      label: '기본단가',     type: 'currency', required: true, width: '100px', align: 'right'},
      { id: 'sizes',          label: '사이즈',       type: 'multiselect', options: ['S','M','L','XL','Free'], width: '140px'},
      { id: 'unit',           label: '단위',         type: 'text',     width: '60px', inGrid: false },
      { id: 'safetyStock',    label: '안전재고',     type: 'number',   width: '90px', align: 'right'},
      { id: 'active',         label: '활성',         type: 'boolean',  width: '60px', align: 'center', filter: true },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 발주 (Order)
  // ════════════════════════════════════════════════════════════
  order: {
    key: 'order',
    label: '발주',
    icon: '',
    description: '거래처 발주 내역',
    teams: ['admin', 'sales', 'qc', 'ceo'],
    permissions: {
      admin: { read: true, create: true, update: true, delete: true },
      sales: { read: true, create: false, update: true, delete: false },
      qc:    { read: true, create: false, update: true, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'id',
    sourceVar: 'ORDERS',
    apiBase: null,  // read-only — DataExplorer 편집 비활성, 발주는 전용 페이지에서 처리
    columns: [
      { id: 'id',           label: '발주번호',  type: 'text',     required: true, width: '130px', filter: true },
      { id: 'clientId',     label: '거래처',    type: 'fk',       targetTable: 'client', targetKey: 'id', displayField: 'name', required: true, width: '130px', filter: true },
      { id: 'date',         label: '발주일',    type: 'date',     required: true, width: '100px', filter: true },
      { id: 'time',         label: '시간',      type: 'text',     width: '70px'},
      { id: 'status',       label: '상태',      type: 'select',   options: ['접수','확정','출고중','출고완료','보류','반려'], required: true, width: '80px', filter: true },
      { id: 'stage',        label: '단계',      type: 'select',   options: ['waiting','barcode','setting','packing','invoice','done'], width: '90px'},
      { id: 'assigneeId',   label: '담당자',    type: 'fk',       targetTable: 'qcStaff', targetKey: 'id', displayField: 'name', width: '90px'},
      { id: 'shippingType', label: '배송',      type: 'select',   options: ['택배','퀵','방문수령'], width: '70px'},
      { id: 'altAddress',   label: '대체주소',  type: 'textarea', width: '180px', inGrid: false },
      { id: 'items',        label: '품목',      type: 'readonly', width: '60px', align: 'center', computed: (row) => row.items ? row.items.length + '건': '0건'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 재고 (Inventory) — 제품별 사이즈별 재고 추적
  // ════════════════════════════════════════════════════════════
  inventory: {
    key: 'inventory',
    label: '재고',
    icon: '',
    description: '제품×사이즈별 재고 수량 (수정은 조정 행 추가만 가능)',
    teams: ['admin', 'qc', 'ceo'],
    permissions: {
      admin: { read: true, create: false, update: false, delete: false },
      qc:    { read: true, create: true,  update: false, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'key',  // composite: productId|size
    sourceVar: 'INVENTORY_FLAT',  // 별도 flatten 함수로 생성
    apiBase: null,  // composite pkField — 단순 PATCH 불가. 재고 조정은 별도 경로(/api/inventory/adjustment)
    columns: [
      { id: 'productId',     label: '제품ID',      type: 'fk',       targetTable: 'product', targetKey: 'id', displayField: 'name', required: true, width: '70px', filter: true },
      { id: 'productName',   label: '제품명',       type: 'readonly', width: '180px'},
      { id: 'size',          label: '사이즈',       type: 'select',   options: ['S','M','L','XL','Free'], required: true, width: '70px', filter: true },
      { id: 'physicalStock', label: '실재고',       type: 'number',   width: '90px', align: 'right'},
      { id: 'availableStock',label: '가용재고',     type: 'number',   width: '90px', align: 'right'},
      { id: 'reservedStock', label: '예약분',       type: 'readonly', width: '70px', align: 'right'},
      { id: 'safetyStock',   label: '안전재고',     type: 'number',   width: '90px', align: 'right'},
      { id: 'status',        label: '상태',         type: 'readonly', width: '80px', align: 'center'},
      { id: 'lastUpdated',   label: '최근수정',     type: 'datetime', width: '120px'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 입출고 트랜잭션 (Inventory Transaction)
  // 경영지원팀 #2 (2026-05): 거래처별/기간별/모델별/분류별/브랜드별 다차원 조회
  // ════════════════════════════════════════════════════════════
  inventoryTransaction: {
    key: 'inventoryTransaction',
    label: '입출고 내역',
    icon: '',
    description: '거래처·기간·모델·분류·브랜드별 입출고 트랜잭션 (다차원 조회)',
    teams: ['admin', 'sales', 'qc', 'ceo'],
    permissions: {
      admin: { read: true, create: false, update: false, delete: false },
      sales: { read: true, create: false, update: false, delete: false },
      qc:    { read: true, create: false, update: false, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'txnId',
    sourceVar: 'INVENTORY_TXNS',
    apiBase: '/api/data-explorer',  // 41K 거래원장 — 이미 wired
    columns: [
      { id: 'txnId',         label: '거래번호',  type: 'text',     width: '110px' },
      { id: 'date',          label: '일자',      type: 'date',     width: '100px', filter: true, sort: true },
      { id: 'period',        label: '기간',      type: 'select',   options: ['오늘','이번주','이번달','3개월','올해','전체'], width: '90px', filter: true, virtual: true, inGrid: false },
      { id: 'type',          label: '구분',      type: 'select',   options: ['입고','출고','반품','조정'], width: '70px', align: 'center', filter: true },
      { id: 'clientId',      label: '거래처',    type: 'fk',       targetTable: 'client', targetKey: 'id', displayField: 'name', width: '130px', filter: true },
      { id: 'productCode',   label: '제품코드',  type: 'text',     width: '100px' },
      { id: 'productName',   label: '제품명',    type: 'text',     width: '180px', filter: true },
      { id: 'brand',         label: '브랜드',    type: 'select',   options: ['리코탭플러스','리스프린트','바로웰핏','알티네오','리깁스','기타'], width: '110px', filter: true },
      { id: 'model',         label: '모델',      type: 'select',   options: ['ricotap','sprint','baroweltfit','neo','rigips','etc'], width: '90px', filter: true, inGrid: false },
      { id: 'category',      label: '분류',      type: 'select',   options: ['무릎','상지','하지','스프린트','기타'], width: '80px', filter: true },
      { id: 'size',          label: '사이즈',    type: 'select',   options: ['S','M','L','XL','Free'], width: '70px', filter: true },
      { id: 'qty',           label: '수량',      type: 'number',   width: '70px', align: 'right' },
      { id: 'unitPrice',     label: '단가',      type: 'currency', width: '90px', align: 'right' },
      { id: 'supplyAmount',  label: '공급가',    type: 'currency', width: '110px', align: 'right' },
      { id: 'vat',           label: '부가세',    type: 'currency', width: '90px', align: 'right' },
      { id: 'total',         label: '합계',      type: 'currency', width: '110px', align: 'right' },
      { id: 'warehouse',     label: '창고',      type: 'select',   options: ['본사창고','지점창고','반품센터'], width: '90px', filter: true },
      { id: 'orderRef',      label: '발주번호',  type: 'text',     width: '130px' },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // 거래명세서 (Invoice)
  // ════════════════════════════════════════════════════════════
  invoice: {
    key: 'invoice',
    label: '거래명세서',
    icon: '',
    description: '발행된 거래명세서',
    teams: ['admin', 'sales', 'ceo'],
    permissions: {
      admin: { read: true, create: true, update: true, delete: true },
      sales: { read: true, create: false, update: false, delete: false },
      ceo:   { read: true, create: false, update: false, delete: false },
    },
    pkField: 'id',
    sourceVar: 'INVOICE_HISTORY',
    apiBase: '/api/invoices',  // PATCH 만 의미있음 (DRAFT 편집). DELETE 는 서버에서 거부될 수 있음 (cancelInvoice 권장)
    columns: [
      { id: 'id',           label: '명세서번호',  type: 'text',     required: true, width: '160px', filter: true },
      { id: 'clientId',     label: '거래처',      type: 'fk',       targetTable: 'client', targetKey: 'id', displayField: 'name', required: true, width: '130px', filter: true },
      { id: 'issueDate',    label: '발행일',      type: 'date',     required: true, width: '110px', filter: true },
      { id: 'amount',       label: '금액',        type: 'currency', required: true, width: '110px', align: 'right'},
      { id: 'status',       label: '상태',        type: 'select',   options: ['ISSUED','SENT','CANCELLED'], required: true, width: '100px', filter: true },
      { id: 'sentAt',       label: '발송일시',    type: 'datetime', width: '140px'},
    ],
  },
};

/** 권한별 표시 가능한 테이블 키 목록 반환 */
function deListTablesForTeam(team) {
  return Object.values(DE_SCHEMAS).filter(s => (s.teams || []).includes(team));
}

/** 권한 체크 헬퍼 */
function deCan(schema, team, action) {
  const p = (schema.permissions && schema.permissions[team]) || {};
  return !!p[action];
}

/** Inventory 를 ProductId×Size 평면으로 펼치기
 *   - p.stock 이 객체 ({ S: 30, M: 50 }) 면 그대로
 *   - p.stock 이 숫자 (150) 면 sizes 배열로 균등 분배 (mock)
 */
function deBuildInventoryFlat() {
  const list = [];
  if (typeof PRODUCTS === 'undefined') return list;
  PRODUCTS.forEach(p => {
    const safety = p.safetyStock || 30;
    const stockByDay = (size, idx) => {
      // 일관된 mock 분배 — 사이즈별로 살짝 차이
      const base = typeof p.stock === 'number'? Math.floor(p.stock / (p.sizes?.length || 1)) : 50;
      return Math.max(0, base + (idx % 3) * 8 - (idx % 5) * 4);
    };
    const sizes = (p.sizes && p.sizes.length > 0) ? p.sizes : ['Free'];

    if (p.stock && typeof p.stock === 'object') {
      // 이미 사이즈별 객체
      Object.entries(p.stock).forEach(([size, physical]) => {
        const reserved = (p.reserved && p.reserved[size]) || Math.floor(physical * 0.1);
        const available = Math.max(0, physical - reserved);
        const status = physical <= 0 ? '품절': (physical <= safety ? '부족': '정상');
        list.push({
          key: `${p.id}|${size}`,
          productId: p.id,
          productName: p.name,
          size,
          physicalStock: physical,
          availableStock: available,
          reservedStock: reserved,
          safetyStock: safety,
          status,
          lastUpdated: p.lastUpdated || '2026-05-11',
        });
      });
    } else {
      // 숫자 / undefined — sizes 로 균등 분배
      sizes.forEach((size, idx) => {
        const physical = stockByDay(size, idx);
        const reserved = Math.floor(physical * 0.08);
        const available = Math.max(0, physical - reserved);
        const status = physical <= 0 ? '품절': (physical <= safety ? '부족': '정상');
        list.push({
          key: `${p.id}|${size}`,
          productId: p.id,
          productName: p.name,
          size,
          physicalStock: physical,
          availableStock: available,
          reservedStock: reserved,
          safetyStock: safety,
          status,
          lastUpdated: '2026-05-11',
        });
      });
    }
  });
  return list;
}

/** 전역 INVENTORY_FLAT 노출 (data.js 실행 후 한 번 호출) */
function deInitInventoryFlat() {
  window.INVENTORY_FLAT = deBuildInventoryFlat();
  window.INVENTORY_TXNS = deBuildInventoryTransactions();
}

/** 제품명 → 브랜드/모델 분류 (경영지원팀 #2)
 *   - 리코탭플러스 / 리스프린트 / 바로웰핏 / 알티네오 / 리깁스
 *   - 첫번째 매칭되는 키워드 반환
 */
function deClassifyBrand(productName) {
  const s = String(productName || '');
  if (s.includes('리코탭플러스') || s.includes('리코탭'))  return { brand: '리코탭플러스', model: 'ricotap' };
  if (s.includes('리스프린트'))                             return { brand: '리스프린트',   model: 'sprint' };
  if (s.includes('바로웰핏'))                                return { brand: '바로웰핏',     model: 'baroweltfit' };
  if (s.includes('알티네오'))                                return { brand: '알티네오',     model: 'neo' };
  if (s.includes('리깁스'))                                  return { brand: '리깁스',       model: 'rigips' };
  return { brand: '기타', model: 'etc' };
}

/** ORDERS + mock 입고 → 입출고 트랜잭션 평면 빌더 (경영지원팀 #2) */
function deBuildInventoryTransactions() {
  const list = [];
  if (typeof ORDERS === 'undefined' || typeof PRODUCTS === 'undefined') return list;
  const catMap = { knee: '무릎', upper: '상지', lower: '하지', sprint: '스프린트' };

  // ── 출고 (ORDERS 의 items 기반) ──
  ORDERS.forEach(order => {
    if (!order.items || order.items.length === 0) return;
    order.items.forEach((item, idx) => {
      const product = PRODUCTS.find(p => p.id === item.productId);
      if (!product) return;
      const { brand, model } = deClassifyBrand(product.name);
      const supply = (item.qty || 0) * (item.unitPrice || 0);
      const vat = Math.round(supply * 0.1);
      // 상태 → 입고/반품/조정 분기
      const isReturn = String(order.status || '').includes('반품');
      const type = isReturn ? '반품' : '출고';
      list.push({
        txnId: `${order.id}-L${idx + 1}`,
        date: order.date,
        type,
        clientId: order.clientId,
        productCode: product.sku || product.id,
        productName: product.name,
        brand,
        model,
        category: catMap[product.cat] || '기타',
        size: item.size,
        qty: isReturn ? -(item.qty || 0) : (item.qty || 0),
        unitPrice: item.unitPrice || 0,
        supplyAmount: isReturn ? -supply : supply,
        vat: isReturn ? -vat : vat,
        total: (isReturn ? -1 : 1) * (supply + vat),
        warehouse: '본사창고',
        orderRef: order.id,
      });
    });
  });

  // ── 입고 mock 더미 (자료 부족분 보강) ──
  // 1월부터 5월까지 월별 분산 입고 (각 제품 대표 사이즈)
  const recvMonths = ['2026-01-05', '2026-02-08', '2026-03-04', '2026-04-02', '2026-05-06'];
  let recvCounter = 0;
  PRODUCTS.forEach((p, pi) => {
    // 각 제품마다 2~3건의 입고 트랜잭션
    const cnt = 2 + (pi % 2);
    for (let i = 0; i < cnt; i++) {
      const date = recvMonths[(pi + i) % recvMonths.length];
      const size = (p.sizes && p.sizes[i % p.sizes.length]) || 'M';
      const qty = 20 + ((pi * 7 + i * 3) % 30);
      const unitPrice = p.basePrice;
      const supply = qty * unitPrice;
      const vat = Math.round(supply * 0.1);
      const { brand, model } = deClassifyBrand(p.name);
      list.push({
        txnId: `RECV-${String(++recvCounter).padStart(4, '0')}`,
        date,
        type: '입고',
        clientId: null,
        productCode: p.sku || p.id,
        productName: p.name,
        brand,
        model,
        category: catMap[p.cat] || '기타',
        size,
        qty,
        unitPrice,
        supplyAmount: supply,
        vat,
        total: supply + vat,
        warehouse: '본사창고',
        orderRef: null,
      });
    }
  });

  // 날짜 desc 정렬
  list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return list;
}

/** "기간" 필터 → 날짜 범위 변환 (오늘/이번주/이번달/3개월/올해/전체)
 *  - 로컬 타임존 기준 YYYY-MM-DD 포맷 (toISOString() 의 UTC 변환 문제 회피)
 */
function dePeriodToRange(periodLabel, now = new Date()) {
  if (!periodLabel || periodLabel === '전체') return null;
  const d = new Date(now);
  d.setHours(0,0,0,0);
  // 로컬 타임존 기준 포맷 — 시연용 데이터(prototype/ORDERS)가 KST 기준 YYYY-MM-DD 라 일치 필요
  const fmt = (x) => {
    const y = x.getFullYear();
    const m = String(x.getMonth()+1).padStart(2,'0');
    const dd= String(x.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  };
  if (periodLabel === '오늘') return { from: fmt(d), to: fmt(d) };
  if (periodLabel === '이번주') {
    const day = d.getDay() || 7; // Sun=0 → 7
    const monday = new Date(d); monday.setDate(d.getDate() - (day - 1));
    return { from: fmt(monday), to: fmt(d) };
  }
  if (periodLabel === '이번달') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return { from: fmt(first), to: fmt(d) };
  }
  if (periodLabel === '3개월') {
    const back = new Date(d); back.setMonth(d.getMonth() - 3);
    return { from: fmt(back), to: fmt(d) };
  }
  if (periodLabel === '올해') {
    const first = new Date(d.getFullYear(), 0, 1);
    return { from: fmt(first), to: fmt(d) };
  }
  return null;
}

/** const 선언된 data.js 의 mock 배열들을 window 에 노출 (DataExplorer 가 참조 가능하게) */
(function exposeData() {
  // data-loader 가 /api/* 로 채운 실 데이터를 보존 — mock 으로 덮어쓰지 않음
  // CLIENTS / PRODUCTS / ORDERS / INVOICE_HISTORY / RECEIVABLES 는 OR-guard:
  //   window.X 가 이미 채워져 있으면(data-loader 결과) 그대로, 아니면 mock fallback
  if (typeof CLIENTS !== 'undefined') window.CLIENTS = window.CLIENTS || CLIENTS;
  if (typeof PRODUCTS !== 'undefined') window.PRODUCTS = window.PRODUCTS || PRODUCTS;
  if (typeof ORDERS !== 'undefined') window.ORDERS = window.ORDERS || ORDERS;
  if (typeof INVOICE_HISTORY !== 'undefined') window.INVOICE_HISTORY = window.INVOICE_HISTORY || INVOICE_HISTORY;
  if (typeof QC_STAFF !== 'undefined') window.QC_STAFF = QC_STAFF;
  if (typeof RECEIVABLES !== 'undefined') window.RECEIVABLES = window.RECEIVABLES || RECEIVABLES;
  // 경영지원팀 #2: 데이터 탐색기 함수/스키마도 window 에 노출 (preview/test 용)
  if (typeof DE_SCHEMAS !== 'undefined') window.DE_SCHEMAS = DE_SCHEMAS;
  if (typeof deBuildInventoryFlat === 'function') window.deBuildInventoryFlat = deBuildInventoryFlat;
  if (typeof deBuildInventoryTransactions === 'function') window.deBuildInventoryTransactions = deBuildInventoryTransactions;
  if (typeof deInitInventoryFlat === 'function') window.deInitInventoryFlat = deInitInventoryFlat;
  if (typeof deClassifyBrand === 'function') window.deClassifyBrand = deClassifyBrand;
  if (typeof dePeriodToRange === 'function') window.dePeriodToRange = dePeriodToRange;
})();
