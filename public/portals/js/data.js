/**
 * RTBIO Prototype — Dummy Data
 * 모든 더미 데이터를 한 곳에서 관리
 */

// ── 제품 카테고리 ──
const CATEGORIES = [
  { id: 'all', name: '전체', color: '#1B3A5C', icon: '📋' },
  { id: 'knee', name: '무릎', color: '#1B3A5C', icon: '🦵' },
  { id: 'upper', name: '상지', color: '#00A8B5', icon: '💪' },
  { id: 'lower', name: '하지', color: '#F57C00', icon: '🦶' },
  { id: 'sprint', name: '스프린트', color: '#7C3AED', icon: '🩹' },
];

// ── 제품 목록 (28개) ──
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const PRODUCTS = [];
// ── 무료배송 기준 (카테고리별 최소 수량) ──
const FREE_SHIP_MIN = { knee: 20, upper: 25, lower: 20, sprint: 40 };
const SHIPPING_FEE = 4000;

// ── 마스터 가격표 (제품군 × 파트별 MSRP) ───────────────────────────────
// 경영지원팀 #3 (2026-05): 거래처별 할인율 단가.xlsx 시트2 자료 기반
// - 거래처는 모델(ricotap/sprint/baroweltfit/neo) 단위로 할인율을 가지고
//   파트(상지/하지/실린더)별 단가는 MSRP × 할인율로 자동 계산됨
// - 병원 거래처는 전 모델 0% 할인 (MSRP 그대로)
const MASTER_PRICES = {
  ricotap: {
    label: '리코탭플러스',
    parts: {
      upper:    { label: '상지', msrp: 36620 },
      lower:    { label: '하지', msrp: 28670 },
    },
  },
  sprint: {
    label: '리스프린트',
    parts: {
      upper:    { label: '상지',    msrp: 31330 },
      lower:    { label: '하지',    msrp: 47390 },
      cylinder: { label: '실린더',  msrp: 60350 },
    },
  },
  baroweltfit: {
    label: '바로웰핏',
    parts: {
      upper:    { label: '상지', msrp: 45730 },
    },
  },
  neo: {
    label: '알티네오',
    parts: {
      upper:       { label: '총판 상지',   msrp: 13500 },
      lower:       { label: '총판 하지',   msrp: 14300 },
      upperDealer: { label: '대리점 상지', msrp: 15500 },
      lowerDealer: { label: '대리점 하지', msrp: 16400 },
    },
  },
};

// 모델키 ↔ 카테고리 매핑 (기존 PRODUCTS.cat → MASTER_PRICES 모델키 추적용)
const MODEL_CATEGORY_MAP = {
  ricotap:     ['knee', 'upper', 'lower'],   // 리코탭플러스 ≒ knee/상지/하지
  sprint:      ['sprint'],                    // 리스프린트
  baroweltfit: ['upper'],                     // 바로웰핏 ≒ 상지 (어깨/팔)
  neo:         ['lower'],                     // 알티네오 ≒ 하지/발목
};

// 할인율 → 공급가 계산 헬퍼
// discountRate(예: 0.55) = 거래처가 MSRP의 55% 를 지불 → 45% off
function calcSupplyPrice(modelKey, partKey, discountRate) {
  const m = MASTER_PRICES[modelKey];
  if (!m || !m.parts[partKey]) return 0;
  const msrp = m.parts[partKey].msrp;
  return Math.round(msrp * (1 - (1 - discountRate))); // = msrp * rate
}

// ── 거래처 (5개) ──
// ⚠️ addresses[]: 거래처별 복수 배송지 (하나의 거래처가 여러 창고/지점 운영 가능)
//                 발주 시 이 목록에서 선택 → 주문에 스냅샷 기록
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const CLIENTS = [];
// 경영지원팀 #4 (2026-05): 기존 5개 거래처에 salesRep / specialty / doctorCount 누락 보강
(function patchExistingClients() {
  const patches = {
    C001: { salesRep: '박진우', specialty: null, doctorCount: null },
    C002: { salesRep: '박진우', specialty: '정형외과',   doctorCount: 8 },
    C003: { salesRep: '배경동', specialty: null, doctorCount: null },
    C004: { salesRep: '배경동', specialty: '재활의학과', doctorCount: 5 },
    C005: { salesRep: '신현호', specialty: null, doctorCount: null },
  };
  CLIENTS.forEach(c => {
    if (patches[c.id]) Object.assign(c, patches[c.id]);
  });
})();

// 경영지원팀 #3 (2026-05): 거래처별 할인율 매트릭스 (model × discountRate)
// - 거래처별 할인율 단가.xlsx 시트2 자료 기반
// - 병원 거래처(type='병원')는 전 모델 1.0 (0% 할인, MSRP 그대로)
// - 대리점은 xlsx 의 실제 할인율 반영
(function addDiscountMatrix() {
  // xlsx 자료 기반 실제 거래처 매트릭스 (대리점만)
  const REAL_MATRIX = {
    // 대리점 → { ricotap, sprint, sprintCyl, baroweltfit, neo }
    // 1.0 = MSRP 그대로, 0.55 = 55% 지불 (45% off)
    '메디원팜':       { ricotap: 0.60, sprint: 0.65, sprintCyl: 0.60, baroweltfit: 0.45, neo: 0.60 },
    '에스케이메디칼': { ricotap: 0.55, sprint: 0.65, sprintCyl: 0.55, baroweltfit: 0.45, neo: 0.55 },
    '서아메디칼':     { ricotap: 0.55, sprint: 0.65, sprintCyl: 0.60, baroweltfit: 0.45, neo: 0.55 },
    '메디팜 의료기':  { ricotap: 0.55, sprint: 0.65, sprintCyl: 0.60, baroweltfit: 0.45, neo: 0.55 },
    '대한메디칼':     { ricotap: 0.55, sprint: 0.65, sprintCyl: 0.55, baroweltfit: 0.45, neo: 0.55 },
    '미래의료기':     { ricotap: 0.60, sprint: 0.65, sprintCyl: 0.60, baroweltfit: 0.45, neo: 0.60 },
  };
  // 병원 기본값 (할인 없음)
  const HOSPITAL_MATRIX = { ricotap: 1.00, sprint: 1.00, sprintCyl: 1.00, baroweltfit: 1.00, neo: 1.00 };
  // 대리점 기본값 (일반 대리점 표준 할인)
  const DEALER_MATRIX   = { ricotap: 0.55, sprint: 0.65, sprintCyl: 0.60, baroweltfit: 0.45, neo: 0.55 };

  CLIENTS.forEach(c => {
    if (REAL_MATRIX[c.name]) {
      c.discountMatrix = { ...REAL_MATRIX[c.name] };
    } else if (c.type === '병원') {
      c.discountMatrix = { ...HOSPITAL_MATRIX };
    } else {
      c.discountMatrix = { ...DEALER_MATRIX };
    }
  });
})();

// ── 품질관리팀 직원 (6명) ──
const QC_STAFF = [
  { id:'S001', name:'박진수', color:'#1B3A5C' },
  { id:'S002', name:'이미영', color:'#00A8B5' },
  { id:'S003', name:'김태호', color:'#F57C00' },
  { id:'S004', name:'정수빈', color:'#7C3AED' },
  { id:'S005', name:'한지원', color:'#D32F2F' },
  { id:'S006', name:'오현우', color:'#2E7D32' },
];

// ── 출고 단계 ──
const SHIP_STAGES = [
  { id:'waiting', name:'대기', icon:'⏳', color:'#F57C00' },
  { id:'barcode', name:'바코드출력', icon:'🏷️', color:'#7C3AED' },
  { id:'setting', name:'세팅', icon:'⚙️', color:'#2B5797' },
  { id:'packing', name:'포장', icon:'📦', color:'#00838F' },
  { id:'invoice', name:'송장', icon:'🚚', color:'#1B3A5C' },
  { id:'done', name:'출고완료', icon:'✅', color:'#2E7D32' },
];

// 2026-06 fix: KST 기준 날짜 (이전엔 toISOString() 의 UTC 기준이라 KST 자정~오전 9시
// 사이에 어제 날짜로 잡혔고, mock ORDERS 의 date 가 2026-04-11 로 박혀 있어 "오늘 확정/
// 오늘 출고" 카운터가 항상 0이었음)
function getKstDateString(offsetDays) {
  const todayKst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  if (!offsetDays) return todayKst;
  const [y, m, d] = todayKst.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,'0')}-${String(base.getUTCDate()).padStart(2,'0')}`;
}
const _TODAY = getKstDateString(0);
const _D_MINUS_1 = getKstDateString(-1);
const _D_MINUS_2 = getKstDateString(-2);
const _D_MINUS_3 = getKstDateString(-3);

// ── 샘플 발주 데이터 (12건) ──
// 날짜는 항상 "오늘 기준" 으로 살아 움직임 — ID 의 0411 등은 식별자라 그대로 유지.
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const ORDERS = [];
// ── Helper: 발주 금액 계산 ──
function calcOrderTotal(order) {
  return order.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
}

// ── Helper: 거래처명 조회 ──
function getClientName(clientId) {
  const c = (window.CLIENTS || CLIENTS).find(x => x.id === clientId);
  return c ? c.name : clientId;
}

// ── Helper: 거래처 객체 조회 ──
function getClient(clientId) {
  return (window.CLIENTS || CLIENTS).find(x => x.id === clientId);
}

// ── Helper: 제품명 조회 ──
function getProductName(productId) {
  // 1) 그룹 PRODUCTS (window.PRODUCTS) 우선
  const p = (window.PRODUCTS || PRODUCTS).find(x => x.id === productId);
  if (p) return p.name;
  // 2) DB 실제 productId 역인덱스 — data-loader 가 채움 (그룹핑 후 OrderItem.productId 매핑)
  const real = window.PRODUCTS_BY_REAL_ID && window.PRODUCTS_BY_REAL_ID[productId];
  if (real) return real.name;
  return productId;
}

// ── Helper: 직원명 조회 ──
function getStaffName(staffId) {
  const s = QC_STAFF.find(x => x.id === staffId);
  return s ? s.name : '-';
}

// ── 오늘 통계 (대시보드용) ──
// 2026-05 동적화 — 칸반 "오늘" 필터, 대시보드 today stats 가 실 데이터 기준 동작하도록.
// 2026-06: TODAY 는 KST 기준으로 ORDERS 정의 전(_TODAY)에서 계산 — 여기선 별칭만 노출.
const TODAY = _TODAY;
const todayOrders = ORDERS.filter(o => o.date === TODAY);
const todayRevenue = todayOrders.reduce((sum, o) => sum + calcOrderTotal(o), 0);
const pendingOrders = ORDERS.filter(o => o.status === '접수').length;
const shippingOrders = ORDERS.filter(o => o.status === '확정' || o.status === '출고중').length;

// ── 미수금 더미 ──
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const RECEIVABLES = [];
const totalReceivables = RECEIVABLES.reduce((s, r) => s + r.amount, 0);

// ── 월 매출 더미 ──
const MONTHLY_REVENUE = 47850000;
const DAILY_REVENUES = [
  { date:'04-05', amount:4200000 },
  { date:'04-06', amount:0 },
  { date:'04-07', amount:5100000 },
  { date:'04-08', amount:6300000 },
  { date:'04-09', amount:4800000 },
  { date:'04-10', amount:5500000 },
  { date:'04-11', amount: todayRevenue },
];

// ════════════════════════════════════════════════════════════════════
// 2026-05-12 미팅 반영: 핵심 신규 데이터 모델
// ════════════════════════════════════════════════════════════════════

// ── 1. 매뉴얼·절차서·양식 카탈로그 ─────────────────────────────────
// docs/품질경영메뉴얼 등(주식회사 알티바이오) 폴더 실제 파일 인덱스
// 분류: MANUAL(매뉴얼) / PROCEDURE(절차서) / FORM(양식) / EXAMPLE(작성예시)
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const QUALITY_DOCS = [];
const QUALITY_DOC_CATEGORY_LABEL = {
  MANUAL:    '품질경영매뉴얼',
  PROCEDURE: '품질경영절차서',
  FORM:      '양식모음',
  EXAMPLE:   '작성예시',
};

// ── 2. 공지사항 (Notice) ────────────────────────────────────────────
// 거래처/내부 양쪽 발송 + 전체/병원/대리점/특정 업체 타겟팅
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const NOTICES = [];
// ── 3. 발주 프로젝트 카드 (Procurement Project) ────────────────────
// 베트남 본사 → 생산 발주 → 항공/선박 분할 입고 트래킹
// 카테고리: 원단(FABRIC) / 부자재(MATERIAL) / 제품(PRODUCT)
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const PROCUREMENT_PROJECTS = [];
const PROJECT_CATEGORY_LABEL = { FABRIC:'원단', MATERIAL:'부자재', PRODUCT:'제품' };
const PROJECT_STATUS_LABEL = {
  PENDING:'대기', IN_PRODUCTION:'생산중', SHIPPING:'출고중',
  PARTIAL:'부분입고', COMPLETED:'입고완료',
};
const SHIPMENT_TYPE_LABEL = { AIR:'항공', SEA:'선박', TRUCK:'육로' };
const SHIPMENT_STATUS_LABEL = { PENDING:'대기', IN_TRANSIT:'운송중', ARRIVED:'입고완료' };

// ── 4. 발주 수정 이력 (Order Edit History) ─────────────────────────
const ORDER_EDIT_HISTORY = [
  { id:'EH-001', orderId:'ORD-0411-004', editedAt:'2026-04-11 13:25', editedBy:'경영지원팀(김태은)',
    action:'QTY_UPDATE', before:{ productId:'P002', size:'L', qty:8 }, after:{ productId:'P002', size:'L', qty:6 },
    reason:'거래처 요청 — 2개 차감' },
  { id:'EH-002', orderId:'ORD-0411-006', editedAt:'2026-04-11 14:00', editedBy:'경영지원팀(김태은)',
    action:'ITEM_REMOVE', before:{ productId:'P025', size:'M', qty:15 }, after:null,
    reason:'전량 반품 요청 (마감 전)' },
];

// ── 5. 웹 알림 (Notification) ───────────────────────────────────────
const NOTIFICATIONS = [
  { id:'NTF-001', type:'ORDER_EDIT', title:'발주 수정 알림',
    message:'ORD-0411-004 수량이 8 → 6 로 변경되었습니다 (경영지원팀)',
    targetTeam:'QC', targetUser:null, relatedId:'ORD-0411-004',
    createdAt:'2026-04-11 13:25', readAt:null, urgent:true },
  { id:'NTF-002', type:'STOCK_LOW', title:'재고 부족 경고',
    message:'리코탭플러스 무릎 숏 (M) 재고 5개 미만',
    targetTeam:'QC', targetUser:null, relatedId:'P001',
    createdAt:'2026-04-10 09:00', readAt:'2026-04-10 09:30', urgent:false },
  { id:'NTF-003', type:'NOTICE', title:'새 공지사항',
    message:'2026 설 연휴 배송 일정 안내',
    targetTeam:'ALL', targetUser:null, relatedId:'N001',
    createdAt:'2026-01-25 10:30', readAt:null, urgent:false },
  { id:'NTF-004', type:'PROJECT_ARRIVAL', title:'베트남 입고 알림',
    message:'PROJ-2026-03 항공편 입고 완료 (3,500개)',
    targetTeam:'QC', targetUser:null, relatedId:'PROJ-2026-03',
    createdAt:'2026-04-08 14:00', readAt:'2026-04-08 14:15', urgent:false },
  { id:'NTF-005', type:'INVOICE_RESEND', title:'거래명세서 재발행',
    message:'한빛정형외과 4월 거래명세서가 재발행되었습니다 (2회차)',
    targetTeam:'ADMIN', targetUser:null, relatedId:'INV-2026-04-002',
    createdAt:'2026-04-12 10:00', readAt:null, urgent:false },
];

// ── 6. UDI 공급내역 보고 데이터 ─────────────────────────────────────
// 의료기기통합정보시스템 (udiportal.mfds.go.kr) 공급내역 보고용
// 보고기한: 공급한 달 익월 말일
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const UDI_REPORTS = [];
// 거래처 사업자등록번호 (UDI 보고시 필수)
const CLIENT_BUSINESS_NO = {
  C002:'123-45-67890', C004:'234-56-78901',
  C006:'345-67-89012', C007:'456-78-90123', C008:'567-89-01234',
  C009:'678-90-12345', C010:'789-01-23456', C011:'890-12-34567',
  C012:'901-23-45678', C013:'012-34-56789', C014:'123-45-67891',
  C015:'234-56-78902', C016:'345-67-89013', C017:'456-78-90124',
};

// ── 7-1. 거래명세서 이력 (2026-05-12 미팅: 재발행/재발송 횟수 추적) ──
// 2026-06: mock 제거 — data-loader.js 의 /api/* fetch 결과로 채워짐. fetch 실패 시 빈 화면.
const INVOICE_HISTORY = [];
// ── 8-pre. 영업 담당자 매핑 (기존 admin-portal 에서 이관, 3개 포털 공통 사용) ──
// 2026-05-18: 거래처관리 페이지를 admin/exec/qc 3개 포털 공통화하기 위해 data.js 로 이관
const SALES_REPS = [
  { id:'REP01', name:'김대영' },
  { id:'REP02', name:'이수진' },
  { id:'REP03', name:'박민호' },
];
const CLIENT_REP_MAP = { C001:'REP01', C002:'REP02', C003:'REP01', C004:'REP03', C005:'REP02' };
let customClientTypes = ['대리점', '병원', '기타']; // user can add more

// ── 8. 영업 사원 마스터 (2026-05-12 미팅: 마스터 계정 + 인센티브 계산) ──
const SALES_REP_MASTERS = [
  { id:'박진우', name:'박진우', email:'jw.park@rtbio.com', phone:'010-1111-2222',
    clientIds:['C001','C002','C006','C007','C009','C011','C014','C015','C016','C018'],
    targetMonthly: 12000000,
    monthlyAchievement: { '2026-04': 8420000, '2026-03': 11200000, '2026-02': 9800000 } },
  { id:'배경동', name:'배경동', email:'kd.bae@rtbio.com', phone:'010-3333-4444',
    clientIds:['C003','C004','C008','C010','C013','C017','C019'],
    targetMonthly: 10000000,
    monthlyAchievement: { '2026-04': 6920000, '2026-03': 9450000, '2026-02': 10100000 } },
  { id:'신현호', name:'신현호', email:'hh.shin@rtbio.com', phone:'010-5555-6666',
    clientIds:['C005','C012','C020'],
    targetMonthly: 8000000,
    monthlyAchievement: { '2026-04': 4310000, '2026-03': 7820000, '2026-02': 8100000 } },
];

// ── 7. 패키징 정보 (출고 시 박스 수) ────────────────────────────────
// orderId → { boxCount, weight, trackingNumbers[] }
const PACKAGING_INFO = {
  'ORD-0411-001': { boxCount:2, weight:'4.5kg', trackingNumbers:['1234-5678-9012','2345-6789-0123'] },
  'ORD-0411-004': { boxCount:1, weight:'2.8kg', trackingNumbers:['3456-7890-1234'] },
  'ORD-0411-005': { boxCount:3, weight:'6.2kg', trackingNumbers:['4567-8901-2345','5678-9012-3456','6789-0123-4567'] },
};

// ── 글로벌 노출 (data-explorer 등에서 window.X 로 접근) ───────────────
// ※ data-loader.js 가 /api/* 결과로 덮어쓸 변수는 mock removed — data-loader fills 로 표시.
//   helper 함수·lookup 테이블은 변경하지 않음.
(function exposeData() {
  if (typeof window === 'undefined') return;
  window.CATEGORIES = CATEGORIES;
  // mock removed — data-loader fills (via /api/products)
  window.PRODUCTS = window.PRODUCTS || PRODUCTS;
  // mock removed — data-loader fills (via /api/clients)
  window.CLIENTS = window.CLIENTS || CLIENTS;
  window.MASTER_PRICES = MASTER_PRICES;
  window.MODEL_CATEGORY_MAP = MODEL_CATEGORY_MAP;
  window.calcSupplyPrice = calcSupplyPrice;
  window.QC_STAFF = QC_STAFF;
  window.SHIP_STAGES = SHIP_STAGES;
  // mock removed — data-loader fills (via /api/orders)
  window.ORDERS = window.ORDERS || ORDERS;
  // mock removed — data-loader fills (via /api/payments → RECEIVABLES)
  window.RECEIVABLES = window.RECEIVABLES || RECEIVABLES;
  window.FREE_SHIP_MIN = FREE_SHIP_MIN;
  window.SHIPPING_FEE = SHIPPING_FEE;
  // 2026-05-12 미팅 반영 신규 데이터
  // mock removed — data-loader fills (via /api/manuals)
  window.QUALITY_DOCS = window.QUALITY_DOCS || QUALITY_DOCS;
  window.QUALITY_DOC_CATEGORY_LABEL = QUALITY_DOC_CATEGORY_LABEL;
  // mock removed — data-loader fills (via /api/notices)
  window.NOTICES = window.NOTICES || NOTICES;
  // mock removed — data-loader fills (via /api/procurement)
  window.PROCUREMENT_PROJECTS = window.PROCUREMENT_PROJECTS || PROCUREMENT_PROJECTS;
  window.PROJECT_CATEGORY_LABEL = PROJECT_CATEGORY_LABEL;
  window.PROJECT_STATUS_LABEL = PROJECT_STATUS_LABEL;
  window.SHIPMENT_TYPE_LABEL = SHIPMENT_TYPE_LABEL;
  window.SHIPMENT_STATUS_LABEL = SHIPMENT_STATUS_LABEL;
  window.ORDER_EDIT_HISTORY = ORDER_EDIT_HISTORY;
  window.NOTIFICATIONS = NOTIFICATIONS;
  // mock removed — data-loader fills (via /api/udi)
  window.UDI_REPORTS = window.UDI_REPORTS || UDI_REPORTS;
  window.CLIENT_BUSINESS_NO = CLIENT_BUSINESS_NO;
  window.PACKAGING_INFO = PACKAGING_INFO;
  // mock removed — data-loader fills (via /api/invoices → INVOICE_HISTORY)
  window.INVOICE_HISTORY = window.INVOICE_HISTORY || INVOICE_HISTORY;
  window.SALES_REP_MASTERS = SALES_REP_MASTERS;
  window.SALES_REPS = SALES_REPS;
  window.CLIENT_REP_MAP = CLIENT_REP_MAP;
  window.customClientTypes = customClientTypes;
})();
