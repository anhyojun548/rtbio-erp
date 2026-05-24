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
const PRODUCTS = [
  // 무릎 (7)
  { id:'P001', cat:'knee', name:'리코탭플러스 무릎 숏', sku:'RTP-KN-S01', sizes:['S','M','L','XL'], basePrice:22000, setQty:2, side:'편측', stock:150 },
  { id:'P002', cat:'knee', name:'리코탭플러스 무릎 롱', sku:'RTP-KN-L01', sizes:['S','M','L','XL'], basePrice:25000, setQty:2, side:'편측', stock:85 },
  { id:'P003', cat:'knee', name:'리코탭플러스 무릎 양측', sku:'RTP-KN-B01', sizes:['S','M','L'], basePrice:40000, setQty:1, side:'양측', stock:60 },
  { id:'P004', cat:'knee', name:'리깁스 무릎 숏', sku:'RGP-KN-S01', sizes:['S','M','L'], basePrice:28000, setQty:1, side:'편측', stock:95 },
  { id:'P005', cat:'knee', name:'리깁스 무릎 롱', sku:'RGP-KN-L01', sizes:['S','M','L','XL'], basePrice:32000, setQty:1, side:'편측', stock:70 },
  { id:'P006', cat:'knee', name:'무릎 보조기 A타입', sku:'KNB-A-001', sizes:['Free'], basePrice:45000, setQty:1, side:'-', stock:40 },
  { id:'P007', cat:'knee', name:'무릎 보조기 B타입', sku:'KNB-B-001', sizes:['S','M','L'], basePrice:52000, setQty:1, side:'-', stock:35 },

  // 상지 (7)
  { id:'P008', cat:'upper', name:'리코탭플러스 손목', sku:'RTP-WR-001', sizes:['S','M','L'], basePrice:19000, setQty:2, side:'편측', stock:200 },
  { id:'P009', cat:'upper', name:'리코탭플러스 손목 롱', sku:'RTP-WR-L01', sizes:['S','M','L'], basePrice:22000, setQty:2, side:'편측', stock:130 },
  { id:'P010', cat:'upper', name:'리코탭플러스 엄지', sku:'RTP-TH-001', sizes:['S','M','L'], basePrice:18000, setQty:2, side:'편측', stock:180 },
  { id:'P011', cat:'upper', name:'리깁스 팔꿈치', sku:'RGP-EL-001', sizes:['S','M','L'], basePrice:26000, setQty:1, side:'편측', stock:90 },
  { id:'P012', cat:'upper', name:'리깁스 손목', sku:'RGP-WR-001', sizes:['S','M','L'], basePrice:24000, setQty:1, side:'편측', stock:110 },
  { id:'P013', cat:'upper', name:'어깨 보조기', sku:'SHB-001', sizes:['Free'], basePrice:55000, setQty:1, side:'-', stock:25 },
  { id:'P014', cat:'upper', name:'팔걸이 슬링', sku:'SLG-001', sizes:['S','M','L'], basePrice:15000, setQty:1, side:'-', stock:150 },

  // 하지 (7)
  { id:'P015', cat:'lower', name:'리코탭플러스 발목', sku:'RTP-AN-001', sizes:['S','M','L'], basePrice:20000, setQty:2, side:'편측', stock:170 },
  { id:'P016', cat:'lower', name:'리코탭플러스 발목 롱', sku:'RTP-AN-L01', sizes:['S','M','L'], basePrice:23000, setQty:2, side:'편측', stock:100 },
  { id:'P017', cat:'lower', name:'리깁스 발목', sku:'RGP-AN-001', sizes:['S','M','L'], basePrice:25000, setQty:1, side:'편측', stock:120 },
  { id:'P018', cat:'lower', name:'리깁스 발목 롱', sku:'RGP-AN-L01', sizes:['S','M','L','XL'], basePrice:28000, setQty:1, side:'편측', stock:80 },
  { id:'P019', cat:'lower', name:'워커 (단족)', sku:'WKR-S-001', sizes:['S','M','L','XL'], basePrice:65000, setQty:1, side:'-', stock:45 },
  { id:'P020', cat:'lower', name:'워커 (장족)', sku:'WKR-L-001', sizes:['S','M','L','XL'], basePrice:75000, setQty:1, side:'-', stock:30 },
  { id:'P021', cat:'lower', name:'발목 보조기', sku:'ANB-001', sizes:['S','M','L'], basePrice:35000, setQty:1, side:'편측', stock:55 },

  // 스프린트 (7)
  { id:'P022', cat:'sprint', name:'리스프린트 손가락', sku:'RSP-FG-001', sizes:['S','M','L'], basePrice:12000, setQty:1, side:'-', stock:300 },
  { id:'P023', cat:'sprint', name:'리스프린트 손목', sku:'RSP-WR-001', sizes:['S','M','L'], basePrice:14000, setQty:1, side:'편측', stock:250 },
  { id:'P024', cat:'sprint', name:'리스프린트 발가락', sku:'RSP-TO-001', sizes:['S','M','L'], basePrice:11000, setQty:1, side:'-', stock:280 },
  { id:'P025', cat:'sprint', name:'리스프린트 발목', sku:'RSP-AN-001', sizes:['S','M','L'], basePrice:15000, setQty:1, side:'편측', stock:220 },
  { id:'P026', cat:'sprint', name:'리스프린트 코', sku:'RSP-NS-001', sizes:['Free'], basePrice:10000, setQty:1, side:'-', stock:200 },
  { id:'P027', cat:'sprint', name:'리스프린트 쇄골', sku:'RSP-CL-001', sizes:['S','M','L'], basePrice:16000, setQty:1, side:'-', stock:160 },
  { id:'P028', cat:'sprint', name:'리스프린트 늑골', sku:'RSP-RB-001', sizes:['M','L','XL'], basePrice:18000, setQty:1, side:'-', stock:140 },
];

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
const CLIENTS = [
  {
    id:'C001', name:'메디팜 의료기', type:'대리점', manager:'김대리',
    loginId:'medipharm', pw:'0010', phone:'010-1234-5678',
    address:'서울시 강남구 테헤란로 123 메디팜빌딩 5F',
    email:'kim@medipharm.co.kr',
    paymentType:'계좌이체', closingPeriod:'1일~25일',
    discounts:{ knee:5, upper:5, lower:3, sprint:0 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false,
    addresses:[
      { id:'A001-1', label:'본점 창고',     recipient:'김대리',   phone:'010-1234-5678', address:'서울시 강남구 테헤란로 123 메디팜빌딩 5F', memo:'평일 09:00~18:00 수령 가능', isDefault:true },
      { id:'A001-2', label:'강남 지점',     recipient:'이지점장', phone:'02-567-8910',   address:'서울시 강남구 역삼로 88 2층',              memo:'',                             isDefault:false },
      { id:'A001-3', label:'수원 물류센터', recipient:'박물류',   phone:'031-222-3333',  address:'경기도 수원시 영통구 광교로 45 A동 3층',   memo:'토요일 수령 불가',             isDefault:false },
    ],
  },
  {
    id:'C002', name:'한빛정형외과', type:'병원', manager:'박원장',
    loginId:'hanbit', pw:'0011', phone:'010-5678-9012',
    address:'경기도 성남시 분당구 정자동 45-1 한빛메디컬 3F',
    email:'park@hanbit.kr',
    paymentType:'당월말카드', closingPeriod:'전달26일~당월25일',
    discounts:{ knee:10, upper:8, lower:5, sprint:3 },
    fixedPrices:{ P001: 19800 },
    invoiceType:'거래처', freeShipping:false,
    addresses:[
      { id:'A002-1', label:'본관 구매팀', recipient:'구매과',  phone:'031-777-1000', address:'경기도 성남시 분당구 정자동 45-1 한빛메디컬 3F', memo:'반드시 구매과 경유 (직접 반입 불가)', isDefault:true },
      { id:'A002-2', label:'수술동 창고', recipient:'수술실팀', phone:'031-777-1077', address:'경기도 성남시 분당구 정자동 45-1 한빛메디컬 별관 2F', memo:'긴급 배송시에만 사용', isDefault:false },
    ],
  },
  {
    id:'C003', name:'대한메디칼', type:'대리점', manager:'이과장',
    loginId:'daehan', pw:'0012', phone:'010-3333-4444',
    address:'부산시 해운대구 센텀중앙로 79 대한빌딩 2F',
    email:'lee@daehanmed.co.kr',
    paymentType:'계좌이체', closingPeriod:'1일~말일',
    discounts:{ knee:7, upper:6, lower:5, sprint:2 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false,
    addresses:[
      { id:'A003-1', label:'부산 본점', recipient:'이과장',   phone:'010-3333-4444', address:'부산시 해운대구 센텀중앙로 79 대한빌딩 2F', memo:'', isDefault:true },
      { id:'A003-2', label:'울산 지점', recipient:'김지점장', phone:'052-222-3344',  address:'울산시 남구 삼산로 200 메디컬타워 5F',      memo:'', isDefault:false },
    ],
  },
  {
    id:'C004', name:'세종재활의학과', type:'병원', manager:'최원장',
    loginId:'sejong', pw:'0013', phone:'010-7777-8888',
    address:'세종시 도움로 87 세종메디타워 4F',
    email:'choi@sejongrehab.kr',
    paymentType:'사용량카드', closingPeriod:'전달26일~당월25일',
    discounts:{ knee:12, upper:10, lower:8, sprint:5 },
    fixedPrices:{ P004: 24500, P017: 22000 },
    invoiceType:'거래처', freeShipping:false,
    addresses:[
      { id:'A004-1', label:'본원',     recipient:'최원장', phone:'010-7777-8888', address:'세종시 도움로 87 세종메디타워 4F',    memo:'',                           isDefault:true },
      { id:'A004-2', label:'대전 분원', recipient:'김원장', phone:'042-888-9999',  address:'대전시 서구 둔산로 123 현대메디컬 2F', memo:'화/목 09~15시만 수령 가능', isDefault:false },
    ],
  },
  {
    id:'C005', name:'미래의료기', type:'대리점', manager:'정사원',
    loginId:'mirae', pw:'0014', phone:'010-9999-0000',
    address:'대전시 유성구 대학로 99 미래빌딩 3F',
    email:'jung@miraemd.co.kr',
    paymentType:'3개월후결제', closingPeriod:'1일~25일',
    discounts:{ knee:3, upper:3, lower:2, sprint:0 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false,
    addresses:[
      { id:'A005-1', label:'본점', recipient:'정사원', phone:'010-9999-0000', address:'대전시 유성구 대학로 99 미래빌딩 3F', memo:'', isDefault:true },
    ],
  },
  // 경영지원팀 #4 (2026-05): 병원결제방식.xlsx 자료 기반 추가 거래처 (15건)
  // - 결제방식: 당월말/익월말 (카드/계좌입금/사용량) 등 실제 엑셀 옵션
  // - salesRep: RTBIO 내부 영업담당자 (박진우/배경동/신현호)
  // - 진료과/의사수/할인율은 mock 값 + 기본 default
  ...[
    ['C006', '연세튼튼신경외과의원',   '신경외과',  4, '당월 말(카드결제)',     '박진우'],
    ['C007', '더편한마디의원',         '정형외과',  3, '익월 말(카드결제)',     '박진우'],
    ['C008', '신당서울휴재활의학과',   '재활의학과',5, '당월 말(계좌입금)',     '배경동'],
    ['C009', '안양탑정형외과의원',     '정형외과',  6, '익월말(계좌입금)',      '박진우'],
    ['C010', '편한마디정형외과의원',   '정형외과',  3, '당월 말(계좌입금)',     '배경동'],
    ['C011', '하정한정형외과',         '정형외과',  4, '당월 말(카드결제)',     '박진우'],
    ['C012', '성모윤정형외과',         '정형외과',  5, '익월 말(카드결제)',     '박진우'],
    ['C013', '늘푸른정형외과',         '정형외과',  7, '익월 말(카드결제)',     '배경동'],
    ['C014', '바른몸정형외과의원',     '정형외과',  3, '사용량(계좌입금)',      '박진우'],
    ['C015', '한맘플러스재활의학과의원','재활의학과',4, '사용량(카드결제)',      '박진우'],
    ['C016', '답십리연세정형외과의원', '정형외과',  3, '사용량 만큼(카드결제)', '박진우'],
    ['C017', '태능성모의원',           '재활의학과',2, '익월말 사용량 카드',    '배경동'],
    ['C018', '메디원팜',               null,        null, '계좌이체',           '박진우'],
    ['C019', '에스케이메디칼',         null,        null, '계좌이체',           '배경동'],
    ['C020', '서아메디칼',             null,        null, '계좌이체',           '신현호'],
  ].map(([id, name, specialty, doctorCount, paymentType, salesRep]) => ({
    id, name,
    type: specialty ? '병원' : '대리점',
    specialty, doctorCount,
    manager: '담당자',
    salesRep,
    loginId: id.toLowerCase(), pw: '0000',
    phone: '010-0000-0000',
    address: '주소 미입력',
    email: '',
    paymentType,
    closingPeriod: paymentType.includes('익월') ? '전달26일~당월25일' : '1일~25일',
    discounts: { knee: 5, upper: 5, lower: 5, sprint: 5 },
    fixedPrices: {},
    invoiceType: '거래처', freeShipping: false,
    addresses: [{
      id: id + '-1', label: '본관', recipient: '담당자',
      phone: '010-0000-0000', address: '주소 미입력', memo: '', isDefault: true,
    }],
  })),
];

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

// ── 샘플 발주 데이터 (12건) ──
const ORDERS = [
  // 접수 (오늘, 아직 미확정) — 3건
  { id:'ORD-0411-001', clientId:'C001', date:'2026-04-11', time:'09:32', status:'접수',
    stage:null, assigneeId:null, shippingType:'택배', altAddress:null,
    items:[
      { productId:'P001', size:'M', qty:10, unitPrice:20900 },
      { productId:'P008', size:'M', qty:20, unitPrice:18050 },
    ]
  },
  { id:'ORD-0411-002', clientId:'C002', date:'2026-04-11', time:'10:15', status:'접수',
    stage:null, assigneeId:null, shippingType:'택배', altAddress:'분당 서울대병원 정형외과 3층',
    items:[
      { productId:'P004', size:'L', qty:5, unitPrice:24500 },
      { productId:'P017', size:'M', qty:8, unitPrice:22000 },
      { productId:'P022', size:'S', qty:30, unitPrice:11640 },
    ]
  },
  { id:'ORD-0411-003', clientId:'C005', date:'2026-04-11', time:'11:45', status:'접수',
    stage:null, assigneeId:null, shippingType:'방문수령', altAddress:null,
    items:[
      { productId:'P015', size:'L', qty:15, unitPrice:19400 },
    ]
  },

  // 확정 (오늘, 당일출고 확정됨) — 3건
  { id:'ORD-0411-004', clientId:'C003', date:'2026-04-11', time:'08:10', status:'확정',
    stage:'waiting', assigneeId:'S001', shippingType:'택배', altAddress:null,
    items:[
      { productId:'P002', size:'L', qty:8, unitPrice:23250 },
      { productId:'P011', size:'M', qty:5, unitPrice:24440 },
    ]
  },
  { id:'ORD-0411-005', clientId:'C004', date:'2026-04-11', time:'08:45', status:'확정',
    stage:'barcode', assigneeId:'S002', shippingType:'택배',
    altAddress:'세종시 조치원읍 세종로 12 세종병원 물리치료실',
    items:[
      { productId:'P001', size:'S', qty:20, unitPrice:19800 },
      { productId:'P003', size:'M', qty:5, unitPrice:35200 },
    ]
  },
  { id:'ORD-0411-006', clientId:'C001', date:'2026-04-11', time:'09:00', status:'확정',
    stage:'setting', assigneeId:'S003', shippingType:'택배', altAddress:null,
    items:[
      { productId:'P019', size:'L', qty:3, unitPrice:63050 },
      { productId:'P025', size:'M', qty:15, unitPrice:15000 },
    ]
  },

  // 출고중 — 3건
  { id:'ORD-0411-007', clientId:'C002', date:'2026-04-11', time:'07:50', status:'출고중',
    stage:'packing', assigneeId:'S004', shippingType:'택배', altAddress:null,
    items:[
      { productId:'P005', size:'M', qty:6, unitPrice:28800 },
      { productId:'P010', size:'L', qty:10, unitPrice:16560 },
    ]
  },
  { id:'ORD-0411-008', clientId:'C003', date:'2026-04-11', time:'07:30', status:'출고중',
    stage:'invoice', assigneeId:'S005', shippingType:'택배', altAddress:null,
    items:[
      { productId:'P023', size:'M', qty:40, unitPrice:14000 },
    ]
  },
  { id:'ORD-0410-009', clientId:'C005', date:'2026-04-10', time:'14:20', status:'출고중',
    stage:'done', assigneeId:'S006', shippingType:'퀵', altAddress:null,
    items:[
      { productId:'P006', size:'Free', qty:3, unitPrice:43650 },
    ]
  },

  // 완료 (이전 날짜) — 3건
  { id:'ORD-0410-010', clientId:'C001', date:'2026-04-10', time:'09:15', status:'완료',
    stage:'done', assigneeId:'S001', shippingType:'택배', altAddress:null, trackingNo:'CJ123456789012',
    items:[
      { productId:'P001', size:'M', qty:15, unitPrice:20900 },
      { productId:'P015', size:'S', qty:10, unitPrice:19400 },
    ]
  },
  { id:'ORD-0409-011', clientId:'C004', date:'2026-04-09', time:'10:00', status:'완료',
    stage:'done', assigneeId:'S002', shippingType:'택배', altAddress:null, trackingNo:'CJ987654321098',
    items:[
      { productId:'P002', size:'L', qty:5, unitPrice:22000 },
    ]
  },
  { id:'ORD-0408-012', clientId:'C002', date:'2026-04-08', time:'11:30', status:'완료',
    stage:'done', assigneeId:'S003', shippingType:'택배', altAddress:null, trackingNo:'HJ112233445566',
    items:[
      { productId:'P027', size:'M', qty:20, unitPrice:15520 },
      { productId:'P013', size:'Free', qty:2, unitPrice:50600 },
    ]
  },
];

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
  const p = (window.PRODUCTS || PRODUCTS).find(x => x.id === productId);
  return p ? p.name : productId;
}

// ── Helper: 직원명 조회 ──
function getStaffName(staffId) {
  const s = QC_STAFF.find(x => x.id === staffId);
  return s ? s.name : '-';
}

// ── 오늘 통계 (대시보드용) ──
const TODAY = '2026-04-11';
const todayOrders = ORDERS.filter(o => o.date === TODAY);
const todayRevenue = todayOrders.reduce((sum, o) => sum + calcOrderTotal(o), 0);
const pendingOrders = ORDERS.filter(o => o.status === '접수').length;
const shippingOrders = ORDERS.filter(o => o.status === '확정' || o.status === '출고중').length;

// ── 미수금 더미 ──
const RECEIVABLES = [
  { clientId:'C001', amount: 3250000, overdueDays: 0 },
  { clientId:'C002', amount: 1870000, overdueDays: 5 },
  { clientId:'C003', amount: 4520000, overdueDays: 12 },
  { clientId:'C004', amount: 980000, overdueDays: 0 },
  { clientId:'C005', amount: 2150000, overdueDays: 25 },
];
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
const QUALITY_DOCS = [
  // 1. 품질경영매뉴얼
  { id:'DOC-001', code:'',         category:'MANUAL',    title:'품질경영매뉴얼(주식회사 알티바이오)', filename:'품질경영매뉴얼(주식회사 알티바이오).hwp', size:155136, version:'1.0', updatedAt:'2025-12-15' },
  // 2. 품질경영절차서 (RTB-QP-401 ~ 806, 16개)
  { id:'DOC-101', code:'RTB-QP-401', category:'PROCEDURE', title:'문서관리',              filename:'RTB-QP-401 문서관리.hwp',           size:55296,  version:'2.1', updatedAt:'2025-11-20' },
  { id:'DOC-102', code:'RTB-QP-402', category:'PROCEDURE', title:'기록관리',              filename:'RTB-QP-402 기록관리.hwp',           size:45056,  version:'2.0', updatedAt:'2025-10-10' },
  { id:'DOC-103', code:'RTB-QP-501', category:'PROCEDURE', title:'경영검토',              filename:'RTB-QP-501 경영검토.hwp',           size:38912,  version:'1.5', updatedAt:'2025-09-15' },
  { id:'DOC-104', code:'RTB-QP-601', category:'PROCEDURE', title:'교육훈련',              filename:'RTB-QP-601 교육훈련.hwp',           size:47104,  version:'2.0', updatedAt:'2025-12-01' },
  { id:'DOC-105', code:'RTB-QP-701', category:'PROCEDURE', title:'계약검토',              filename:'RTB-QP-701 계약검토.hwp',           size:46592,  version:'1.8', updatedAt:'2025-11-05' },
  { id:'DOC-106', code:'RTB-QP-702', category:'PROCEDURE', title:'설계 및 개발관리',       filename:'RTB-QP-702 설계 및 개발관리.hwp',    size:63488,  version:'2.2', updatedAt:'2025-12-20' },
  { id:'DOC-107', code:'RTB-QP-703', category:'PROCEDURE', title:'구매관리',              filename:'RTB-QP-703 구매관리.hwp',           size:48640,  version:'2.0', updatedAt:'2025-11-30' },
  { id:'DOC-108', code:'RTB-QP-704', category:'PROCEDURE', title:'자재 및 제품 관리',      filename:'RTB-QP-704 자재 및 제품 관리.hwp',   size:45056,  version:'1.9', updatedAt:'2025-10-25' },
  { id:'DOC-109', code:'RTB-QP-705', category:'PROCEDURE', title:'공정관리 감독',          filename:'RTB-QP-705 공정관리 감독.hwp',       size:45056,  version:'1.7', updatedAt:'2025-09-20' },
  { id:'DOC-110', code:'RTB-QP-707', category:'PROCEDURE', title:'식별 및 추적관리',       filename:'RTB-QP-707 식별 및 추적관리.hwp',    size:45056,  version:'2.0', updatedAt:'2025-12-10' },
  { id:'DOC-111', code:'RTB-QP-801', category:'PROCEDURE', title:'고객불만처리',           filename:'RTB-QP-801 고객불만처리.hwp',       size:48640,  version:'2.1', updatedAt:'2026-01-15' },
  { id:'DOC-112', code:'RTB-QP-802', category:'PROCEDURE', title:'내부품질감사',           filename:'RTB-QP-802 내부품질감사.hwp',       size:43008,  version:'1.8', updatedAt:'2025-10-30' },
  { id:'DOC-113', code:'RTB-QP-803', category:'PROCEDURE', title:'시험 및 검사관리',       filename:'RTB-QP-803 시험 및 검사관리.hwp',    size:43520,  version:'2.0', updatedAt:'2025-11-12' },
  { id:'DOC-114', code:'RTB-QP-804', category:'PROCEDURE', title:'부적합품 관리',          filename:'RTB-QP-804 부적합품 관리.hwp',       size:43520,  version:'1.9', updatedAt:'2025-12-05' },
  { id:'DOC-115', code:'RTB-QP-805', category:'PROCEDURE', title:'데이터분석',             filename:'RTB-QP-805 데이터분석.hwp',          size:299520, version:'2.3', updatedAt:'2026-02-01' },
  { id:'DOC-116', code:'RTB-QP-806', category:'PROCEDURE', title:'시정 및 예방조치',       filename:'RTB-QP-806 시정 및 예방조치.hwp',    size:46592,  version:'2.0', updatedAt:'2025-11-25' },
  // 3. 양식모음 — 주요 양식 (실제 폴더 90+ 중 핵심 30개)
  { id:'DOC-201', code:'F401-1', category:'FORM',   title:'품질문서관리대장',         filename:'(F401-1)품질문서관리대장(완료).hwp',         size:25600, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-202', code:'F401-2', category:'FORM',   title:'외부출처문서관리대장',     filename:'(F401-2)외부출처문서관리대장(완료).hwp',     size:26112, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-203', code:'F402-1', category:'FORM',   title:'정보열람서',              filename:'(F402-1)정보열람서(완료).hwp',              size:20992, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-204', code:'F501-1', category:'FORM',   title:'경영검토회의록',          filename:'(F501-1)경영검토회의록(완료).hwp',          size:20480, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-205', code:'F601-1', category:'FORM',   title:'교육훈련계획표',          filename:'(F601-1)교육훈련계획표(완료).hwp',          size:23040, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-206', code:'F601-2', category:'FORM',   title:'교육훈련보고서',          filename:'(F601-2)교육훈련보고서(완료).hwp',          size:30208, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-207', code:'F601-4', category:'FORM',   title:'자격인정서',              filename:'(F601-4)자격인정서(완료).hwp',              size:28672, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-208', code:'F601-5', category:'FORM',   title:'개인별 이력카드',         filename:'(F601-5)개인별 이력카드(완료).hwp',         size:26624, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-209', code:'F701-1', category:'FORM',   title:'주문접수 및 검토대장',     filename:'(F701-1)주문접수 및 검토대장(완료).hwp',     size:34304, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-210', code:'F701-2', category:'FORM',   title:'견적서',                  filename:'(F701-2)견적서(완료).hwp',                  size:22528, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-211', code:'F703-1', category:'FORM',   title:'외주업체 등록대장',       filename:'(F703-1)외주업체 등록대장(완료).hwp',       size:20992, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-212', code:'F703-2', category:'FORM',   title:'외주업체평가표',          filename:'(F703-2)외주업체평가표(완료).hwp',          size:44032, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-213', code:'F703-4', category:'FORM',   title:'발주서',                  filename:'(F703-4)발주서(완료).hwp',                  size:24576, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-214', code:'F703-6', category:'FORM',   title:'품질보증협정서',          filename:'(F703-6)품질보증협정서(완료).docx',         size:20367, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-215', code:'F704-1', category:'FORM',   title:'취급보관점검표',          filename:'(F704-1)취급보관점검표(완료).hwp',          size:43008, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-216', code:'F704-2', category:'FORM',   title:'자재입출고대장',          filename:'(F704-2)자재입출고대장(완료).hwp',          size:29184, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-217', code:'F704-3', category:'FORM',   title:'제품입출고대장',          filename:'(F704-3)제품입출고대장(완료).hwp',          size:20992, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-218', code:'F704-4', category:'FORM',   title:'온습도점검표',            filename:'(F704-4)온습도점검표(완료).hwp',            size:30208, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-219', code:'F705-1', category:'FORM',   title:'생산(의뢰)계획서',        filename:'(F705-1)생산(의뢰)계획서(완료).hwp',        size:25600, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-220', code:'F705-2', category:'FORM',   title:'제조기록서',              filename:'(F705-2)제조기록서(완료).hwp',              size:24576, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-221', code:'F705-4', category:'FORM',   title:'제조공정도',              filename:'(F705-4)제조공정도(완료).hwp',              size:27136, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-222', code:'F705-5', category:'FORM',   title:'작업표준서',              filename:'(F705-5)작업표준서(완료).hwp',              size:33280, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-223', code:'F706-1', category:'FORM',   title:'장비목록대장',            filename:'(F706-1)장비목록대장(완료).hwp',            size:24576, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-224', code:'F706-3', category:'FORM',   title:'교정점검계획표',          filename:'(F706-3)교정점검계획표(완료).hwp',          size:26112, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-225', code:'F707-2', category:'FORM',   title:'제품 식별기호관리대장',    filename:'(F707-2)제품 식별기호관리대장(완료).hwp',    size:51712, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-226', code:'F801-1', category:'FORM',   title:'고객불만접수대장',        filename:'(F801-1)고객불만접수대장(완료).hwp',        size:18432, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-227', code:'F801-3', category:'FORM',   title:'고객만족도평가표',        filename:'(F801-3)고객만족도평가표(완료).hwp',        size:48640, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-228', code:'F801-5', category:'FORM',   title:'고객불만 접수처리 보고서', filename:'(F801-5)고객불만 접수처리 보고서(완료).doc', size:46592, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-229', code:'F802-2', category:'FORM',   title:'내부품질감사체크리스트',  filename:'(F802-2)내부품질감사체크리스트(완료).hwp',  size:22016, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-230', code:'F803-1', category:'FORM',   title:'입고검사성적서',          filename:'(F803-1)입고검사성적서(완료).hwp',          size:81408, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-231', code:'F803-2', category:'FORM',   title:'최종검사성적서',          filename:'(F803-2)최종검사성적서(완료).hwp',          size:25088, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-232', code:'F804-1', category:'FORM',   title:'부적합품보고서',          filename:'(F804-1)부적합품보고서(완료).hwp',          size:25600, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-233', code:'F806-1', category:'FORM',   title:'시정및예방조치 보고서',   filename:'(F806-1)시정및예방조치 보고서-1번(완료).hwp', size:25600, version:'1.0', updatedAt:'2025-08-01' },
  { id:'DOC-234', code:'',       category:'FORM',   title:'의료기기이상사례보고서',   filename:'의료기기이상사례보고서.hwp',                size:31744, version:'1.0', updatedAt:'2025-08-01' },
];

const QUALITY_DOC_CATEGORY_LABEL = {
  MANUAL:    '품질경영매뉴얼',
  PROCEDURE: '품질경영절차서',
  FORM:      '양식모음',
  EXAMPLE:   '작성예시',
};

// ── 2. 공지사항 (Notice) ────────────────────────────────────────────
// 거래처/내부 양쪽 발송 + 전체/병원/대리점/특정 업체 타겟팅
const NOTICES = [
  { id:'N001', title:'2026 설 연휴 배송 일정 안내',
    body:'2월 9일~13일 설 연휴로 출고가 잠시 중단됩니다. 마지막 출고: 2월 8일 16시, 재개: 2월 14일 09시',
    target:'ALL', targetIds:[], priority:'HIGH',
    createdBy:'경영지원팀', createdAt:'2026-01-25 10:30', expiresAt:'2026-02-15',
    pinned:true, readBy:['C001','C002','C003'] },
  { id:'N002', title:'리코탭플러스 무릎 신규 사이즈 (XXL) 출시',
    body:'대형 사이즈(XXL) 가 추가되었습니다. 기존 사이즈와 동일한 단가로 발주 가능합니다.',
    target:'DEALER', targetIds:[], priority:'NORMAL',
    createdBy:'경영지원팀', createdAt:'2026-03-15 14:20', expiresAt:null,
    pinned:false, readBy:['C001'] },
  { id:'N003', title:'발주 마감 시간 변경 안내',
    body:'4월부터 당일 출고 마감 시간이 14시 → 15시로 변경됩니다. 퀵 배송은 13시 마감 유지.',
    target:'ALL', targetIds:[], priority:'NORMAL',
    createdBy:'품질관리팀', createdAt:'2026-03-28 09:00', expiresAt:'2026-04-30',
    pinned:false, readBy:[] },
  { id:'N004', title:'[병원] UDI 공급내역 보고 협조 안내',
    body:'2026년 4월부터 모든 병원 거래처는 UDI 공급내역 보고가 의무화됩니다. 발주 시 사업자등록번호 확인 부탁드립니다.',
    target:'HOSPITAL', targetIds:[], priority:'HIGH',
    createdBy:'경영지원팀', createdAt:'2026-03-30 11:00', expiresAt:null,
    pinned:true, readBy:['C002'] },
  { id:'N005', title:'한빛정형외과 전용 — 특별 할인 안내',
    body:'5월 한 달간 리코탭플러스 시리즈 추가 5% 할인 적용됩니다.',
    target:'SPECIFIC', targetIds:['C002'], priority:'NORMAL',
    createdBy:'영업팀', createdAt:'2026-04-30 16:00', expiresAt:'2026-05-31',
    pinned:false, readBy:[] },
];

// ── 3. 발주 프로젝트 카드 (Procurement Project) ────────────────────
// 베트남 본사 → 생산 발주 → 항공/선박 분할 입고 트래킹
// 카테고리: 원단(FABRIC) / 부자재(MATERIAL) / 제품(PRODUCT)
const PROCUREMENT_PROJECTS = [
  {
    id:'PROJ-2026-01', code:'PRJ260101', orderDate:'2026-01-05', plannedArrival:'2026-02-15',
    category:'PRODUCT', title:'2026년 1월 생산발주 — 리코탭플러스 시리즈',
    status:'COMPLETED', // PENDING / IN_PRODUCTION / SHIPPING / PARTIAL / COMPLETED
    totalQty:5000, receivedQty:5000,
    items:[
      { productId:'P001', size:'M', orderedQty:1500, receivedQty:1500, unitPrice:11000 },
      { productId:'P001', size:'L', orderedQty:1200, receivedQty:1200, unitPrice:11000 },
      { productId:'P002', size:'M', orderedQty:1300, receivedQty:1300, unitPrice:12500 },
      { productId:'P008', size:'M', orderedQty:1000, receivedQty:1000, unitPrice:9500 },
    ],
    shipments:[
      { id:'SH-2026-01-A', shipmentType:'AIR',  shipDate:'2026-01-25', arrivalDate:'2026-02-01', qty:2000, status:'ARRIVED' },
      { id:'SH-2026-01-B', shipmentType:'SEA',  shipDate:'2026-01-30', arrivalDate:'2026-02-15', qty:3000, status:'ARRIVED' },
    ],
    note:'순조롭게 전량 입고 완료', createdBy:'안이사',
  },
  {
    id:'PROJ-2026-02', code:'PRJ260201', orderDate:'2026-02-10', plannedArrival:'2026-03-25',
    category:'PRODUCT', title:'2026년 2월 생산발주 — 리스프린트 + 알티네오',
    status:'COMPLETED',
    totalQty:4200, receivedQty:4200,
    items:[
      { productId:'P022', size:'M', orderedQty:1500, receivedQty:1500, unitPrice:6000 },
      { productId:'P023', size:'L', orderedQty:1200, receivedQty:1200, unitPrice:7000 },
      { productId:'P015', size:'M', orderedQty:1500, receivedQty:1500, unitPrice:10000 },
    ],
    shipments:[
      { id:'SH-2026-02-A', shipmentType:'AIR',  shipDate:'2026-03-01', arrivalDate:'2026-03-08', qty:1500, status:'ARRIVED' },
      { id:'SH-2026-02-B', shipmentType:'SEA',  shipDate:'2026-03-05', arrivalDate:'2026-03-23', qty:2700, status:'ARRIVED' },
    ],
    note:'예정보다 2일 빨리 입고', createdBy:'안이사',
  },
  {
    id:'PROJ-2026-03', code:'PRJ260301', orderDate:'2026-03-10', plannedArrival:'2026-04-25',
    category:'PRODUCT', title:'2026년 3월 생산발주',
    status:'PARTIAL',
    totalQty:6000, receivedQty:4200,
    items:[
      { productId:'P001', size:'M', orderedQty:2000, receivedQty:2000, unitPrice:11000 },
      { productId:'P022', size:'L', orderedQty:1500, receivedQty:1500, unitPrice:6000 },
      { productId:'P004', size:'M', orderedQty:1500, receivedQty:700,  unitPrice:14000 },
      { productId:'P017', size:'M', orderedQty:1000, receivedQty:0,    unitPrice:12500 },
    ],
    shipments:[
      { id:'SH-2026-03-A', shipmentType:'AIR',  shipDate:'2026-04-01', arrivalDate:'2026-04-08', qty:3500, status:'ARRIVED' },
      { id:'SH-2026-03-B', shipmentType:'SEA',  shipDate:'2026-04-10', arrivalDate:'2026-04-22', qty:700,  status:'ARRIVED' },
      { id:'SH-2026-03-C', shipmentType:'SEA',  shipDate:'2026-04-28', arrivalDate:'2026-05-20', qty:1800, status:'IN_TRANSIT' },
    ],
    note:'P017 미입고 — 선적 일정 5월 말 예정', createdBy:'안이사',
  },
  {
    id:'PROJ-2026-04', code:'PRJ260401', orderDate:'2026-04-08', plannedArrival:'2026-05-30',
    category:'PRODUCT', title:'2026년 4월 생산발주',
    status:'SHIPPING',
    totalQty:5500, receivedQty:0,
    items:[
      { productId:'P002', size:'L', orderedQty:1500, receivedQty:0, unitPrice:12500 },
      { productId:'P022', size:'S', orderedQty:2000, receivedQty:0, unitPrice:6000 },
      { productId:'P008', size:'M', orderedQty:2000, receivedQty:0, unitPrice:9500 },
    ],
    shipments:[
      { id:'SH-2026-04-A', shipmentType:'AIR',  shipDate:'2026-05-10', arrivalDate:'2026-05-17', qty:2000, status:'IN_TRANSIT' },
      { id:'SH-2026-04-B', shipmentType:'SEA',  shipDate:'2026-05-15', arrivalDate:'2026-06-05', qty:3500, status:'IN_TRANSIT' },
    ],
    note:'5월 중순 1차 입고 예정', createdBy:'안이사',
  },
  {
    id:'PROJ-2026-05', code:'PRJ260501', orderDate:'2026-05-08', plannedArrival:'2026-06-25',
    category:'PRODUCT', title:'2026년 5월 생산발주',
    status:'IN_PRODUCTION',
    totalQty:4800, receivedQty:0,
    items:[
      { productId:'P001', size:'L',  orderedQty:1500, receivedQty:0, unitPrice:11000 },
      { productId:'P003', size:'M',  orderedQty:1000, receivedQty:0, unitPrice:18000 },
      { productId:'P022', size:'M',  orderedQty:2300, receivedQty:0, unitPrice:6000 },
    ],
    shipments:[],
    note:'생산 진행 중 — 출고 5월 말 예정', createdBy:'안이사',
  },
  // 원단/부자재 발주
  {
    id:'PROJ-2026-FB-01', code:'PRJ260301F', orderDate:'2026-03-01', plannedArrival:'2026-04-10',
    category:'FABRIC', title:'네오프렌 원단 발주 (2026년 1차)',
    status:'COMPLETED', totalQty:3000, receivedQty:3000,
    items:[
      { productId:null, productName:'네오프렌 원단 (롤)', size:'-', orderedQty:3000, receivedQty:3000, unitPrice:5500 },
    ],
    shipments:[
      { id:'SH-FB-01', shipmentType:'SEA', shipDate:'2026-03-15', arrivalDate:'2026-04-08', qty:3000, status:'ARRIVED' },
    ],
    note:'네오프렌 원자재 안정 확보', createdBy:'안이사',
  },
  {
    id:'PROJ-2026-MT-01', code:'PRJ260401M', orderDate:'2026-04-05', plannedArrival:'2026-05-15',
    category:'MATERIAL', title:'벨크로/지퍼 부자재 발주',
    status:'PARTIAL', totalQty:8000, receivedQty:5000,
    items:[
      { productId:null, productName:'벨크로 테이프 (M)', size:'-', orderedQty:5000, receivedQty:5000, unitPrice:200 },
      { productId:null, productName:'YKK 지퍼 (롤)',    size:'-', orderedQty:3000, receivedQty:0,    unitPrice:850 },
    ],
    shipments:[
      { id:'SH-MT-01-A', shipmentType:'AIR', shipDate:'2026-04-20', arrivalDate:'2026-04-25', qty:5000, status:'ARRIVED' },
      { id:'SH-MT-01-B', shipmentType:'SEA', shipDate:'2026-05-01', arrivalDate:'2026-05-22', qty:3000, status:'IN_TRANSIT' },
    ],
    note:'지퍼 5/22 입고 예정', createdBy:'안이사',
  },
];

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
const UDI_REPORTS = [
  { id:'UDI-2026-03', reportMonth:'2026-03', submittedAt:'2026-04-15 14:00',
    submittedBy:'경영지원팀(김태은)', status:'SUBMITTED',
    totalItems:48, totalQty:312, hospitalCount:7,
    receiptNumber:'UDI-20260415-0042' },
  { id:'UDI-2026-04', reportMonth:'2026-04', submittedAt:null,
    submittedBy:null, status:'PENDING',
    totalItems:0, totalQty:0, hospitalCount:0,
    receiptNumber:null },
];

// 거래처 사업자등록번호 (UDI 보고시 필수)
const CLIENT_BUSINESS_NO = {
  C002:'123-45-67890', C004:'234-56-78901',
  C006:'345-67-89012', C007:'456-78-90123', C008:'567-89-01234',
  C009:'678-90-12345', C010:'789-01-23456', C011:'890-12-34567',
  C012:'901-23-45678', C013:'012-34-56789', C014:'123-45-67891',
  C015:'234-56-78902', C016:'345-67-89013', C017:'456-78-90124',
};

// ── 7-1. 거래명세서 이력 (2026-05-12 미팅: 재발행/재발송 횟수 추적) ──
const INVOICE_HISTORY = [
  { id:'INV-202604-001', clientId:'C001', issueDate:'2026-04-05', amount:1640815,
    status:'SENT', sentAt:'2026-04-05 14:30',
    issueCount:1, sendCount:1,
    issueLog:[
      { at:'2026-04-05 11:00', by:'경영지원팀(김태은)', type:'ISSUE' },
      { at:'2026-04-05 14:30', by:'경영지원팀(김태은)', type:'SEND' },
    ] },
  { id:'INV-202604-002', clientId:'C002', issueDate:'2026-04-08', amount:3120440,
    status:'SENT', sentAt:'2026-04-12 10:00',
    issueCount:2, sendCount:2,
    issueLog:[
      { at:'2026-04-08 09:30', by:'경영지원팀(김태은)', type:'ISSUE' },
      { at:'2026-04-08 09:35', by:'경영지원팀(김태은)', type:'SEND' },
      { at:'2026-04-11 16:20', by:'경영지원팀(김태은)', type:'REISSUE' },
      { at:'2026-04-12 10:00', by:'경영지원팀(김태은)', type:'RESEND' },
    ] },
  { id:'INV-202604-003', clientId:'C003', issueDate:'2026-04-10', amount:982150,
    status:'ISSUED', sentAt:null,
    issueCount:1, sendCount:0,
    issueLog:[{ at:'2026-04-10 13:15', by:'경영지원팀(김태은)', type:'ISSUE' }] },
  { id:'INV-202604-004', clientId:'C004', issueDate:'2026-04-09', amount:2456000,
    status:'SENT', sentAt:'2026-04-09 17:00',
    issueCount:1, sendCount:1,
    issueLog:[
      { at:'2026-04-09 15:00', by:'경영지원팀(김태은)', type:'ISSUE' },
      { at:'2026-04-09 17:00', by:'경영지원팀(김태은)', type:'SEND' },
    ] },
  { id:'INV-202604-005', clientId:'C005', issueDate:'2026-04-11', amount:735200,
    status:'CANCELLED', sentAt:null,
    issueCount:1, sendCount:0,
    issueLog:[
      { at:'2026-04-11 10:00', by:'경영지원팀(김태은)', type:'ISSUE' },
      { at:'2026-04-11 14:30', by:'경영지원팀(김태은)', type:'CANCEL' },
    ] },
];

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
  { id:'박진우', name:'박진우', email:'jw.park@altibio.co.kr', phone:'010-1111-2222',
    clientIds:['C001','C002','C006','C007','C009','C011','C014','C015','C016','C018'],
    targetMonthly: 12000000,
    monthlyAchievement: { '2026-04': 8420000, '2026-03': 11200000, '2026-02': 9800000 } },
  { id:'배경동', name:'배경동', email:'kd.bae@altibio.co.kr', phone:'010-3333-4444',
    clientIds:['C003','C004','C008','C010','C013','C017','C019'],
    targetMonthly: 10000000,
    monthlyAchievement: { '2026-04': 6920000, '2026-03': 9450000, '2026-02': 10100000 } },
  { id:'신현호', name:'신현호', email:'hh.shin@altibio.co.kr', phone:'010-5555-6666',
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
