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

// ── 거래처 (5개) ──
const CLIENTS = [
  {
    id:'C001', name:'메디팜 의료기', type:'대리점', manager:'김대리',
    loginId:'medipharm', pw:'0010', phone:'010-1234-5678',
    address:'서울시 강남구 테헤란로 123 메디팜빌딩 5F',
    email:'kim@medipharm.co.kr',
    paymentType:'계좌이체', closingPeriod:'1일~25일',
    discounts:{ knee:5, upper:5, lower:3, sprint:0 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false
  },
  {
    id:'C002', name:'한빛정형외과', type:'병원', manager:'박원장',
    loginId:'hanbit', pw:'0011', phone:'010-5678-9012',
    address:'경기도 성남시 분당구 정자동 45-1 한빛메디컬 3F',
    email:'park@hanbit.kr',
    paymentType:'당월말카드', closingPeriod:'전달26일~당월25일',
    discounts:{ knee:10, upper:8, lower:5, sprint:3 },
    fixedPrices:{ P001: 19800 },
    invoiceType:'거래처', freeShipping:false
  },
  {
    id:'C003', name:'대한메디칼', type:'대리점', manager:'이과장',
    loginId:'daehan', pw:'0012', phone:'010-3333-4444',
    address:'부산시 해운대구 센텀중앙로 79 대한빌딩 2F',
    email:'lee@daehanmed.co.kr',
    paymentType:'계좌이체', closingPeriod:'1일~말일',
    discounts:{ knee:7, upper:6, lower:5, sprint:2 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false
  },
  {
    id:'C004', name:'세종재활의학과', type:'병원', manager:'최원장',
    loginId:'sejong', pw:'0013', phone:'010-7777-8888',
    address:'세종시 도움로 87 세종메디타워 4F',
    email:'choi@sejongrehab.kr',
    paymentType:'사용량카드', closingPeriod:'전달26일~당월25일',
    discounts:{ knee:12, upper:10, lower:8, sprint:5 },
    fixedPrices:{ P004: 24500, P017: 22000 },
    invoiceType:'거래처', freeShipping:false
  },
  {
    id:'C005', name:'미래의료기', type:'대리점', manager:'정사원',
    loginId:'mirae', pw:'0014', phone:'010-9999-0000',
    address:'대전시 유성구 대학로 99 미래빌딩 3F',
    email:'jung@miraemd.co.kr',
    paymentType:'3개월후결제', closingPeriod:'1일~25일',
    discounts:{ knee:3, upper:3, lower:2, sprint:0 },
    fixedPrices:{},
    invoiceType:'RTBIO', freeShipping:false
  },
];

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
  const c = CLIENTS.find(x => x.id === clientId);
  return c ? c.name : clientId;
}

// ── Helper: 거래처 객체 조회 ──
function getClient(clientId) {
  return CLIENTS.find(x => x.id === clientId);
}

// ── Helper: 제품명 조회 ──
function getProductName(productId) {
  const p = PRODUCTS.find(x => x.id === productId);
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
