/* ══════════════════════════════════════════
   Widget Dashboard — Prototype Logic
   ══════════════════════════════════════════ */
(function () {
'use strict';

// ── Color Palette ──
const COLORS = {
  primary: '#1B3A5C',
  accent: '#00A8B5',
  success: '#2E7D32',
  warning: '#F57C00',
  danger: '#D32F2F',
  purple: '#7C3AED',
  chart: ['#1B3A5C','#00A8B5','#F57C00','#7C3AED','#2E7D32','#D32F2F','#E91E63','#3F51B5']
};

// ── Widget Type Definitions ──
const WIDGET_TYPES = [
  { id: 'kpi', name: 'KPI 카드', icon: '🔢', desc: '단일 숫자 + 설명', defaultW: 3, defaultH: 2 },
  { id: 'vbar', name: '세로 막대 그래프', icon: '📊', desc: '카테고리별 비교', defaultW: 6, defaultH: 4 },
  { id: 'hbar', name: '가로 막대 그래프', icon: '📶', desc: '순위/비중 시각화', defaultW: 6, defaultH: 4 },
  { id: 'table', name: '표', icon: '📋', desc: '목록/상세 데이터', defaultW: 6, defaultH: 4 },
  { id: 'donut', name: '도넛 차트', icon: '🍩', desc: '비율/구성 시각화', defaultW: 4, defaultH: 4 },
  { id: 'line', name: '라인 차트', icon: '📈', desc: '시계열 추세', defaultW: 6, defaultH: 4 },
  { id: 'gauge', name: '게이지', icon: '🎯', desc: '목표 대비 달성률', defaultW: 3, defaultH: 3 },
];

// ── Preset Widgets (pre-configured) ──
// 2026-05-22: roles 필드 추가 — exec/ceo/admin/qc 별 노출 제어. 없으면 모두 노출 (하위 호환).
const PRESETS = [
  { name: '이번 달 매출', type: 'kpi', preset: 'monthly_sales', desc: '당월 누적 매출액', w: 3, h: 2, roles: ['exec','ceo','admin'] },
  { name: '오늘 발주', type: 'kpi', preset: 'today_orders', desc: '금일 접수된 발주 건수', w: 3, h: 2, roles: ['exec','ceo','admin'] },
  { name: '총 미수금', type: 'kpi', preset: 'total_ar', desc: '미수금 합계 + 연체 건수', w: 3, h: 2, roles: ['exec','ceo','admin'] },
  { name: '활성 거래처', type: 'kpi', preset: 'active_clients', desc: '현재 거래 중인 거래처 수', w: 3, h: 2, roles: ['exec','ceo','admin'] },
  { name: '최근 7일 매출 추이', type: 'vbar', preset: 'weekly_sales', desc: '일별 매출 막대 그래프', w: 6, h: 4, roles: ['exec','ceo'] },
  { name: '거래처별 매출 비중', type: 'hbar', preset: 'client_share', desc: '거래처별 매출 비율', w: 6, h: 4, roles: ['exec','ceo'] },
  { name: '오늘 발주 현황', type: 'table', preset: 'today_order_list', desc: '금일 발주 목록 (상태 포함)', w: 6, h: 5, roles: ['exec','admin'] },
  { name: '품목별 매출 구성', type: 'donut', preset: 'product_mix', desc: '제품 카테고리별 매출 비율', w: 4, h: 4, roles: ['exec','ceo'] },
  { name: '월별 매출 추이', type: 'line', preset: 'monthly_trend', desc: '최근 6개월 매출 트렌드', w: 6, h: 4, roles: ['exec','ceo'] },
  { name: '월 매출 목표 달성률', type: 'gauge', preset: 'sales_target', desc: '목표 대비 현재 달성 퍼센트', w: 3, h: 3, roles: ['exec','ceo'] },
  { name: '재고 부족 품목', type: 'table', preset: 'low_stock', desc: '안전재고 미달 품목 목록', w: 6, h: 4, roles: ['admin','qc','ceo'] },
  { name: '미수금 거래처', type: 'table', preset: 'ar_clients', desc: '미수금 보유 거래처 + 연체일', w: 6, h: 4, roles: ['exec','admin','ceo'] },
  { name: '거래처별 담당자 목록', type: 'table', preset: 'client_reps', desc: '거래처 / 담당자 / 연락처 / 최근거래일', w: 6, h: 5, roles: ['exec'] },
  // 2026-05-12 미팅 신규 위젯 — 베트남 발주는 임원/관리 위주
  { name: '베트남 발주 입고 현황', type: 'table', preset: 'procurement_status', desc: '월별 발주 → 항공/선박 입고 트래킹 (대표님 핵심 요청)', w: 8, h: 5, roles: ['ceo','admin'] },
  { name: '생산발주 진행률', type: 'gauge', preset: 'production_progress', desc: '이번달 베트남 발주 입고율', w: 3, h: 3, roles: ['ceo','admin'] },
  { name: '운송중 선적 알림', type: 'table', preset: 'in_transit_shipments', desc: '항공/선박 운송중 + 예상 입항일', w: 6, h: 4, roles: ['ceo','admin'] },
  { name: '원부자재 발주 비율', type: 'donut', preset: 'material_split', desc: '원단/부자재/제품 발주 비율 (대표님 요청)', w: 4, h: 4, roles: ['ceo','admin'] },
  { name: 'UDI 보고 현황', type: 'kpi', preset: 'udi_status', desc: '월별 UDI 공급내역 보고 현황', w: 3, h: 2, roles: ['ceo','admin'] },
  { name: '미확인 알림', type: 'kpi', preset: 'unread_notifications', desc: '미확인 알림 개수', w: 3, h: 2, roles: ['exec','ceo','admin','qc'] },
];

// 2026-05-22: 현재 대시보드 role (init 시점에 설정) — 'exec' / 'ceo' / 'admin' / 'qc' / null=전체
let _currentDashboardRole = null;
function getVisiblePresets() {
  if (!_currentDashboardRole) return PRESETS;
  return PRESETS.filter(function (p) {
    return !p.roles || p.roles.indexOf(_currentDashboardRole) !== -1;
  });
}

// ── Dynamic Dashboard Data (data-loader 가 채운 window.* 로 계산) ──
function _fmtKRW(n) { return '₩' + Math.round(n).toLocaleString(); }
function _yyyymm(d) { return d.toISOString().slice(0, 7); }
function _today() { return new Date().toISOString().slice(0, 10); }
// 데이터의 가장 최신 거래월 (TRANSACTIONS 분포가 과거일 때 의미있는 KPI 표시)
function _latestDataMonth() {
  var txns = window.TRANSACTIONS || [];
  if (!txns.length) return _yyyymm(new Date());
  var max = '';
  for (var i = 0; i < txns.length; i++) {
    var d = (txns[i].txnDate || '').slice(0, 7);
    if (d > max) max = d;
  }
  return max || _yyyymm(new Date());
}
function _last7Days() {
  var days = [];
  var now = new Date();
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const MOCK = {
  get monthly_sales() {
    var ym = _latestDataMonth();  // 데이터의 가장 최신 월 (현재 월이 비어있을 때)
    var sales = (window.TRANSACTIONS || [])
      .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(ym); })
      .reduce(function (s, t) { return s + Number(t.totalAmount || 0); }, 0);
    return { value: _fmtKRW(sales), desc: ym + ' 누적', change: '', changeDir: 'up' };
  },

  get today_orders() {
    var today = _today();
    var count = (window.ORDERS || [])
      .filter(function (o) { return (o.createdAt || o.orderDate || '').startsWith(today); })
      .length;
    return { value: count + '건', desc: '금일 접수된 발주', change: '', changeDir: 'up' };
  },

  get total_ar() {
    var sum = (window.LEDGERS || [])
      .reduce(function (s, l) { return s + Number(l.balance || 0); }, 0);
    var overdue = (window.LEDGERS || []).filter(function (l) { return Number(l.balance || 0) > 0; }).length;
    return { value: _fmtKRW(sum), desc: overdue > 0 ? ('잔액 ' + overdue + '건') : '연체 없음', change: '', changeDir: 'down' };
  },

  get active_clients() {
    var clients = (window.CLIENTS || []).filter(function (c) { return c.active !== false; });
    var dealer = clients.filter(function (c) { return c.type === '대리점' || c._typeEnum === 'AGENCY'; }).length;
    var hospital = clients.filter(function (c) { return c.type === '병원' || c._typeEnum === 'HOSPITAL'; }).length;
    return { value: clients.length + '개', desc: '대리점 ' + dealer + ' / 병원 ' + hospital, change: '', changeDir: '' };
  },

  get weekly_sales() {
    // 데이터의 가장 최근 거래 7일 (현재 날짜가 데이터 외라면)
    var txns = window.TRANSACTIONS || [];
    var maxDate = '';
    for (var i = 0; i < txns.length; i++) {
      var d = (txns[i].txnDate || '').slice(0, 10);
      if (d > maxDate) maxDate = d;
    }
    var anchorDate = maxDate ? new Date(maxDate) : new Date();
    var days = [];
    for (var j = 6; j >= 0; j--) {
      var d2 = new Date(anchorDate);
      d2.setDate(d2.getDate() - j);
      days.push(d2.toISOString().slice(0, 10));
    }
    var data = days.map(function (day) {
      var sum = (window.TRANSACTIONS || [])
        .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(day); })
        .reduce(function (s, t) { return s + Number(t.totalAmount || 0); }, 0);
      return Math.round(sum);
    });
    return { labels: days.map(function (d) { return d.slice(5); }), data: data };
  },

  get client_share() {
    // 데이터 최신 월의 거래처별 매출 Top 5
    var ym = _latestDataMonth();
    var byClient = {};
    (window.TRANSACTIONS || [])
      .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(ym); })
      .forEach(function (t) {
        var key = t.clientName || t.clientCode || '미지정';
        byClient[key] = (byClient[key] || 0) + Number(t.totalAmount || 0);
      });
    var sorted = Object.entries(byClient).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    return {
      labels: sorted.map(function (e) { var n = e[0]; return n.length > 10 ? n.slice(0, 10) + '…' : n; }),
      data: sorted.map(function (e) { return Math.round(e[1]); }),
    };
  },

  get today_order_list() {
    var today = _today();
    var orders = (window.ORDERS || [])
      .filter(function (o) { return (o.createdAt || o.orderDate || '').startsWith(today); })
      .slice(0, 10);
    return {
      headers: ['발주번호','거래처','금액','상태','시간'],
      rows: orders.length === 0
        ? [['—','오늘 발주 없음','—','—','—']]
        : orders.map(function (o) {
            return [
              o.orderNumber || o.id,
              (o.client && o.client.name) || o.clientName || '-',
              _fmtKRW(Number(o.totalAmount || 0)),
              o.status || '-',
              (o.createdAt || '').slice(11, 16),
            ];
          }),
    };
  },

  get product_mix() {
    // 데이터 최신 월의 카테고리별 매출 비중
    var ym = _latestDataMonth();
    var byCat = {};
    (window.TRANSACTIONS || [])
      .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(ym); })
      .forEach(function (t) {
        var cat = t.category || '기타';
        byCat[cat] = (byCat[cat] || 0) + Number(t.totalAmount || 0);
      });
    var sorted = Object.entries(byCat).sort(function (a, b) { return b[1] - a[1]; });
    return {
      labels: sorted.map(function (e) { return e[0]; }),
      data: sorted.map(function (e) { return Math.round(e[1]); }),
    };
  },

  get monthly_trend() {
    // 데이터의 가장 최근 월 기준 최근 6개월 매출
    var latestYM = _latestDataMonth();
    var anchor = new Date(latestYM + '-01');
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    var data = months.map(function (m) {
      var sum = (window.TRANSACTIONS || [])
        .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(m); })
        .reduce(function (s, t) { return s + Number(t.totalAmount || 0); }, 0);
      return Math.round(sum);
    });
    return { labels: months.map(function (m) { return m.slice(5) + '월'; }), data: data };
  },

  get sales_target() {
    var ym = _latestDataMonth();
    var sales = (window.TRANSACTIONS || [])
      .filter(function (t) { return t.kind === 'SALE' && (t.txnDate || '').startsWith(ym); })
      .reduce(function (s, t) { return s + Number(t.totalAmount || 0); }, 0);
    var target = 50000000;
    var pct = target > 0 ? Math.min(100, (sales / target) * 100) : 0;
    return { value: pct, label: pct.toFixed(1) + '%', target: _fmtKRW(target) };
  },

  get low_stock() {
    // window.PRODUCTS 의 사이즈 중 reorderPoint 보다 낮은 재고
    var rows = [];
    (window.PRODUCTS || []).forEach(function (p) {
      (p.sizes || []).forEach(function (s) {
        var stock = s.availableStock || 0;
        var rop = s.reorderPoint || 0;
        if (rop > 0 && stock < rop) {
          rows.push([p.code, p.name + ' (' + s.sizeCode + ')', String(stock), String(rop), String(rop - stock)]);
        }
      });
    });
    return {
      headers: ['품목코드','품목명','현재고','안전재고','부족분'],
      rows: rows.length === 0 ? [['—','재고 부족 없음','—','—','—']] : rows.slice(0, 10),
    };
  },

  get ar_clients() {
    var rows = (window.LEDGERS || [])
      .filter(function (l) { return Number(l.balance || 0) > 0; })
      .sort(function (a, b) { return Number(b.balance) - Number(a.balance); })
      .slice(0, 10)
      .map(function (l) {
        return [
          (l.client && l.client.name) || l.clientCode || '-',
          _fmtKRW(Number(l.balance)),
          '-',
          Number(l.balance) > 5000000 ? '위험' : '주의',
        ];
      });
    return {
      headers: ['거래처','미수금','연체일','상태'],
      rows: rows.length === 0 ? [['—','미수금 없음','—','—']] : rows,
    };
  },

  // C-4: 거래처+담당자 프리셋
  get client_reps() {
    var rows = (window.CLIENTS || []).slice(0, 10).map(function (c) {
      return [
        c.name,
        c.type || '-',
        c.salesRep || '-',
        c.phone || '-',
        '-',
      ];
    });
    return {
      headers: ['거래처','유형','담당 영업사원','연락처','최근 거래일'],
      rows: rows.length === 0 ? [['—','—','—','—','—']] : rows,
    };
  },

  // 2026-05-12 미팅: 대표님 핵심 요청 — 베트남 발주 입고 트래킹
  get procurement_status() {
    var projects = (window.PROCUREMENTS || window.PROCUREMENT_PROJECTS || []);
    return {
      headers: ['발주월','카테고리','발주량','입고량','진행률','선적'],
      rows: projects.length === 0
        ? [['—','발주 없음','—','—','—','—']]
        : projects.slice(0, 7).map(function (p) {
          var total = Number(p.totalQty || 0);
          var recv = Number(p.receivedQty || 0);
          var pct = total > 0 ? Math.round(recv / total * 100) : 0;
          var ships = (p.shipments || []).map(function (s) { return s.shipmentType === 'AIR' ? '✈️' : '🚢'; }).join(' ');
          var cat = { FABRIC: '원단', MATERIAL: '부자재', PRODUCT: '제품' }[p.category] || p.category || '-';
          return [
            (p.orderDate || '').slice(0, 7),
            cat,
            total.toLocaleString(),
            recv.toLocaleString(),
            pct + '%',
            ships,
          ];
        }),
    };
  },

  get production_progress() {
    var projects = (window.PROCUREMENTS || window.PROCUREMENT_PROJECTS || []);
    var active = projects.filter(function (p) { return p.status !== 'COMPLETED'; });
    var total = active.reduce(function (s, p) { return s + Number(p.totalQty || 0); }, 0);
    var received = active.reduce(function (s, p) { return s + Number(p.receivedQty || 0); }, 0);
    var pct = total > 0 ? Math.round(received / total * 100) : 100;
    return { value: pct, label: pct + '%', target: '입고완료' };
  },

  get in_transit_shipments() {
    var projects = (window.PROCUREMENTS || window.PROCUREMENT_PROJECTS || []);
    var transit = [];
    projects.forEach(function (p) {
      (p.shipments || []).filter(function (s) { return s.status === 'IN_TRANSIT'; }).forEach(function (s) {
        transit.push([
          s.shipmentType === 'AIR' ? '✈️ 항공' : '🚢 선박',
          p.code,
          s.shipDate,
          s.arrivalDate,
          (s.qty || 0).toLocaleString() + '개',
        ]);
      });
    });
    return {
      headers: ['수단','프로젝트','출항일','입항예정','수량'],
      rows: transit.length > 0 ? transit : [['-','입항 대기 없음','-','-','-']],
    };
  },

  get material_split() {
    var projects = (window.PROCUREMENTS || window.PROCUREMENT_PROJECTS || []);
    var totals = { 원단: 0, 부자재: 0, 제품: 0 };
    projects.forEach(function (p) {
      var k = { FABRIC: '원단', MATERIAL: '부자재', PRODUCT: '제품' }[p.category];
      if (k) totals[k] += Number(p.totalQty || 0);
    });
    return { labels: Object.keys(totals), data: Object.values(totals) };
  },

  get udi_status() {
    var reports = (window.UDI_REPORTS || []);
    var pending = reports.filter(function (r) { return r.status === 'PENDING' || !r.submittedAt; }).length;
    var ym = _yyyymm(new Date());
    return { value: pending + '건', desc: ym + ' 보고 대기', change: '', changeDir: '' };
  },

  get unread_notifications() {
    var notifs = (window.NOTIFICATIONS || []);
    var unread = notifs.filter(function (n) { return !n.readAt; }).length;
    return { value: unread + '건', desc: '미확인 알림', change: '', changeDir: unread > 0 ? 'up' : '' };
  },
};

// ── Table column definitions (mock schema) ──
const TABLE_COLUMNS = {
  orders: [
    { id: 'order_no', name: '발주번호', type: 'text' },
    { id: 'client', name: '거래처', type: 'text' },
    { id: 'amount', name: '금액', type: 'number' },
    { id: 'status', name: '상태', type: 'select', options: ['접수','확정','출고중','완료','취소'] },
    { id: 'order_date', name: '주문일', type: 'date' },
    { id: 'delivery_date', name: '납기일', type: 'date' },
    { id: 'product', name: '제품', type: 'text' },
    { id: 'qty', name: '수량', type: 'number' },
  ],
  products: [
    { id: 'code', name: '품목코드', type: 'text' },
    { id: 'name', name: '품목명', type: 'text' },
    { id: 'category', name: '카테고리', type: 'select', options: ['수술용품','진단기기','소모품','보호구','기타'] },
    { id: 'price', name: '단가', type: 'number' },
    { id: 'stock', name: '재고', type: 'number' },
    { id: 'min_stock', name: '안전재고', type: 'number' },
  ],
  inventory: [
    { id: 'product', name: '제품', type: 'text' },
    { id: 'physical', name: '실재고', type: 'number' },
    { id: 'available', name: '가용재고', type: 'number' },
    { id: 'reserved', name: '예약수량', type: 'number' },
    { id: 'warehouse', name: '창고', type: 'select', options: ['본사','물류센터','지방'] },
    { id: 'last_in', name: '최종입고일', type: 'date' },
  ],
  clients: [
    { id: 'name', name: '거래처명', type: 'text' },
    { id: 'type', name: '유형', type: 'select', options: ['대리점','병원','약국','기타'] },
    { id: 'region', name: '지역', type: 'text' },
    { id: 'total_sales', name: '총매출', type: 'number' },
    { id: 'ar_balance', name: '미수금', type: 'number' },
    { id: 'last_order', name: '최근주문', type: 'date' },
  ],
  payments: [
    { id: 'client', name: '거래처', type: 'text' },
    { id: 'amount', name: '입금액', type: 'number' },
    { id: 'method', name: '입금방법', type: 'select', options: ['계좌이체','카드','현금','어음'] },
    { id: 'date', name: '입금일', type: 'date' },
    { id: 'invoice', name: '대상청구서', type: 'text' },
  ],
};

const OPERATORS = {
  text: ['=','≠','포함','시작','끝'],
  number: ['=','≠','>','<','≥','≤'],
  date: ['=','≠','>','<','≥','≤'],
  select: ['=','≠'],
};

// ── Mock preview data ──
const PREVIEW_DATA = {
  orders: [
    { order_no:'ORD-0411-001', client:'메디팜 의료기', amount:'570,000', status:'접수', order_date:'2026-04-11', product:'수술용 장갑', qty:'200' },
    { order_no:'ORD-0411-002', client:'한빛정형외과', amount:'647,700', status:'접수', order_date:'2026-04-11', product:'진단키트', qty:'50' },
    { order_no:'ORD-0411-004', client:'대한메디칼', amount:'308,200', status:'확정', order_date:'2026-04-11', product:'소독알코올', qty:'100' },
    { order_no:'ORD-0411-007', client:'한빛정형외과', amount:'338,400', status:'출고중', order_date:'2026-04-11', product:'보호장갑', qty:'150' },
    { order_no:'ORD-0411-008', client:'대한메디칼', amount:'560,000', status:'출고중', order_date:'2026-04-11', product:'마스크', qty:'500' },
  ],
  products: [
    { code:'MED-0042', name:'수술용 장갑 (M)', category:'수술용품', price:'2,500', stock:'120', min_stock:'200' },
    { code:'MED-0078', name:'일회용 마스크 (50매)', category:'소모품', price:'12,000', stock:'80', min_stock:'300' },
    { code:'MED-0123', name:'소독용 알코올 500ml', category:'소모품', price:'8,500', stock:'45', min_stock:'100' },
  ],
  inventory: [
    { product:'수술용 장갑', physical:'120', available:'80', reserved:'40', warehouse:'본사', last_in:'2026-04-08' },
    { product:'일회용 마스크', physical:'80', available:'60', reserved:'20', warehouse:'본사', last_in:'2026-04-05' },
    { product:'소독알코올', physical:'45', available:'45', reserved:'0', warehouse:'물류센터', last_in:'2026-04-02' },
  ],
  clients: [
    { name:'메디팜 의료기', type:'대리점', region:'서울', total_sales:'14,916,500', ar_balance:'0', last_order:'2026-04-11' },
    { name:'한빛정형외과', type:'병원', region:'경기', total_sales:'13,977,000', ar_balance:'3,200,000', last_order:'2026-04-11' },
    { name:'대한메디칼', type:'대리점', region:'부산', total_sales:'8,682,000', ar_balance:'8,500,000', last_order:'2026-04-11' },
  ],
  payments: [
    { client:'메디팜 의료기', amount:'5,000,000', method:'계좌이체', date:'2026-04-10', invoice:'INV-0403' },
    { client:'세종재활의학과', amount:'2,800,000', method:'카드', date:'2026-04-09', invoice:'INV-0402' },
  ],
};

// ── Grid Init ──
var grid;
var widgetCounter = 0;

// ── C-1: Global Date Range & Widget Override ──
var GLOBAL_DATE_KEY = 'rtbio_global_date';
var DATE_LABELS = {
  'today': '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
  'month': '이번 달',
  'custom': '커스텀'
};

function getGlobalDateRange() {
  try {
    var saved = localStorage.getItem(GLOBAL_DATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { range: '30d', from: '2026-04-01', to: '2026-04-16' };
}

function saveGlobalDateRange(obj) {
  localStorage.setItem(GLOBAL_DATE_KEY, JSON.stringify(obj));
}

function getEffectiveDateLabel(el) {
  var ovr = el && el.dataset.widgetDateOverride;
  if (ovr) return '🔶 ' + DATE_LABELS[ovr] + ' (override)';
  var g = getGlobalDateRange();
  return DATE_LABELS[g.range] || '전역';
}

function initGrid() {
  grid = GridStack.init({
    column: 12,
    cellHeight: 60,
    margin: 10,
    animate: true,
    float: false,
    removable: false,
    resizable: { handles: 'se,sw' },
  }, '#gridStack');

  grid.on('change', function () { saveDashboard(); });
}

// ── Render Widget Content ──
function renderWidgetContent(type, preset, elId) {
  var data = preset ? MOCK[preset] : null;
  var el = document.getElementById(elId);
  if (!el) return;

  switch (type) {
    case 'kpi':
      if (data) {
        el.innerHTML =
          '<div class="kpi-value">' + data.value + '</div>' +
          '<div class="kpi-desc">' + data.desc + '</div>' +
          (data.change ? '<div class="kpi-change ' + data.changeDir + '">' + (data.changeDir === 'up' ? '▲' : '▼') + ' ' + data.change + '</div>' : '');
      } else {
        el.innerHTML = '<div class="kpi-value">—</div><div class="kpi-desc">데이터 소스를 설정하세요</div>';
      }
      break;

    case 'vbar':
      if (data) {
        el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
        var ctx = el.querySelector('canvas').getContext('2d');
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: [{
              data: data.data.map(function (v) { return v / 10000; }),
              backgroundColor: data.data.map(function (v, i) { return i === data.data.length - 1 ? COLORS.accent : '#D1D5DB'; }),
              borderRadius: 4,
              barPercentage: 0.6,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function (c) { return c.parsed.y + '만원'; } } }
            },
            scales: {
              y: { display: false },
              x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
          }
        });
      }
      break;

    case 'hbar':
      if (data) {
        el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
        var ctx = el.querySelector('canvas').getContext('2d');
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: [{
              data: data.data,
              backgroundColor: COLORS.chart.slice(0, data.labels.length),
              borderRadius: 4,
              barPercentage: 0.7,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function (c) { return '₩' + c.parsed.x.toLocaleString(); } } }
            },
            scales: {
              x: { display: false },
              y: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
          }
        });
      }
      break;

    case 'table':
      if (data) {
        var html = '<div style="overflow:auto;flex:1;"><table class="widget-table"><thead><tr>';
        data.headers.forEach(function (h) { html += '<th>' + h + '</th>'; });
        html += '</tr></thead><tbody>';
        data.rows.forEach(function (row) {
          html += '<tr>';
          row.forEach(function (cell, i) {
            if (data.headers[i] === '상태') {
              html += '<td><span class="status-badge status-' + cell + '">' + cell + '</span></td>';
            } else {
              html += '<td>' + cell + '</td>';
            }
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
      }
      break;

    case 'donut':
      if (data) {
        el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
        var ctx = el.querySelector('canvas').getContext('2d');
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: data.labels,
            datasets: [{
              data: data.data,
              backgroundColor: COLORS.chart.slice(0, data.labels.length),
              borderWidth: 0,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
              tooltip: { callbacks: { label: function (c) { return c.label + ' ' + c.parsed + '%'; } } }
            }
          }
        });
      }
      break;

    case 'line':
      if (data) {
        el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
        var ctx = el.querySelector('canvas').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [{
              data: data.data.map(function (v) { return v / 10000; }),
              borderColor: COLORS.accent,
              backgroundColor: 'rgba(0,168,181,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: COLORS.accent,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function (c) { return c.parsed.y + '만원'; } } }
            },
            scales: {
              y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, callback: function (v) { return v / 100 + '백만'; } } },
              x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
          }
        });
      }
      break;

    case 'gauge':
      if (data) {
        el.innerHTML =
          '<div class="gauge-wrapper">' +
            '<div class="gauge-canvas-wrap"><canvas width="160" height="90"></canvas></div>' +
            '<div class="gauge-label">' + data.label + '</div>' +
            '<div class="gauge-sub">목표: ' + data.target + '</div>' +
          '</div>';
        var ctx = el.querySelector('canvas').getContext('2d');
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            datasets: [{
              data: [data.value, 100 - data.value],
              backgroundColor: [COLORS.accent, '#E5E7EB'],
              borderWidth: 0,
            }]
          },
          options: {
            responsive: false,
            circumference: 180,
            rotation: -90,
            cutout: '75%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
          }
        });
      }
      break;
  }
}

/* ══════════════════════════════════════════
   Spec Widget Renderer (executeWidgetSpec 결과)
   ──────────────────────────────────────────
   prototype MOCK 위젯과 공존. config.spec 이 있는 위젯만 이 경로로 렌더.
   GET /api/dashboard/widgets/{id}/data → WidgetResult { kind, value?, series?, rows?, comparison? }
   ══════════════════════════════════════════ */

var _HAS_CHART = (typeof Chart !== 'undefined');

// ── format 적용 (spec.format.value) ──
function _fmtSpecValue(n, format) {
  var v = Number(n) || 0;
  var f = (format && format.value) || {};
  var locale = f.locale || 'ko-KR';
  var decimals = (typeof f.decimals === 'number') ? f.decimals : 0;
  var out;
  if (f.compact) {
    // 큰 수 축약 (₩1.2억 / 3.4만)
    var abs = Math.abs(v);
    if (abs >= 1e8) out = (v / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
    else if (abs >= 1e4) out = (v / 1e4).toFixed(1).replace(/\.0$/, '') + '만';
    else out = v.toLocaleString(locale);
  } else if (f.type === 'percent') {
    out = v.toFixed(decimals) + '%';
  } else {
    out = v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return (f.prefix || '') + out + (f.suffix || '');
}

// ── thresholds → 색상 선택 (gauge/kpi) ──
function _pickThresholdColor(value, style, fallback) {
  if (!style || !Array.isArray(style.thresholds) || !style.thresholds.length) return fallback;
  var chosen = fallback;
  // value 이상인 threshold 중 가장 큰 것의 색
  style.thresholds
    .slice()
    .sort(function (a, b) { return a.value - b.value; })
    .forEach(function (t) { if (value >= t.value) chosen = t.color; });
  return chosen;
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── div-bar 폴백 (Chart.js 없을 때 bar/hbar/line/pie/donut) ──
function _renderBarFallback(el, series, color) {
  var max = series.reduce(function (m, p) { return Math.max(m, Number(p.value) || 0); }, 0) || 1;
  var html = '<div class="spec-bar-fallback" style="display:flex;flex-direction:column;gap:6px;padding:4px 2px;overflow:auto;flex:1;">';
  series.forEach(function (p) {
    var pct = Math.max(2, Math.round((Number(p.value) || 0) / max * 100));
    html += '' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:11px;">' +
        '<span style="flex:0 0 80px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + _escapeHtml(p.label) + '">' + _escapeHtml(p.label) + '</span>' +
        '<span style="flex:1;background:#eef1f4;border-radius:4px;height:14px;position:relative;">' +
          '<span style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;background:' + (color || COLORS.accent) + ';border-radius:4px;"></span>' +
        '</span>' +
        '<span style="flex:0 0 auto;font-variant-numeric:tabular-nums;color:var(--text);">' + (Number(p.value) || 0).toLocaleString() + '</span>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── series 차트 (bar / hbar / line / pie / donut) ──
function _renderSpecChart(el, kind, series, style) {
  var color = (style && style.color) || COLORS.accent;
  if (!series || !series.length) {
    el.innerHTML = '<div class="kpi-desc" style="padding:16px;text-align:center;">데이터 없음</div>';
    return;
  }
  if (!_HAS_CHART) { _renderBarFallback(el, series, color); return; }

  el.innerHTML = '<div class="chart-container"><canvas></canvas></div>';
  var ctx = el.querySelector('canvas').getContext('2d');
  var labels = series.map(function (p) { return p.label; });
  var values = series.map(function (p) { return Number(p.value) || 0; });

  if (kind === 'pie' || kind === 'donut') {
    new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: COLORS.chart.slice(0, labels.length), borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: kind === 'donut' ? '65%' : '0%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } }
      }
    });
  } else if (kind === 'line') {
    new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ data: values, borderColor: color, backgroundColor: 'rgba(0,168,181,0.1)', fill: true, tension: 0.3, pointRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  } else {
    // bar / hbar
    var isH = (kind === 'hbar');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: isH ? COLORS.chart.slice(0, labels.length) : color,
          borderRadius: 4, barPercentage: 0.7,
        }]
      },
      options: {
        indexAxis: isH ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: isH
          ? { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }
          : { y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } }
      }
    });
  }
}

// ── gauge (value = 0~100 가정, 아니면 0 으로 클램프 표시) ──
function _renderSpecGauge(el, value, style, format) {
  var pct = Math.max(0, Math.min(100, Number(value) || 0));
  var color = _pickThresholdColor(pct, style, (style && style.color) || COLORS.accent);
  el.innerHTML =
    '<div class="gauge-wrapper">' +
      '<div class="gauge-canvas-wrap"><canvas width="160" height="90"></canvas></div>' +
      '<div class="gauge-label">' + _fmtSpecValue(value, format) + '</div>' +
      '<div class="gauge-sub">달성률</div>' +
    '</div>';
  if (!_HAS_CHART) {
    // 폴백: 막대형 진행률
    el.querySelector('.gauge-canvas-wrap').innerHTML =
      '<div style="width:140px;height:14px;background:#E5E7EB;border-radius:7px;overflow:hidden;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + color + ';"></div>' +
      '</div>';
    return;
  }
  var ctx = el.querySelector('canvas').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: [pct, 100 - pct], backgroundColor: [color, '#E5E7EB'], borderWidth: 0 }] },
    options: { responsive: false, circumference: 180, rotation: -90, cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
  });
}

// ── KPI (value + comparison ▲▼ deltaPercent) ──
function _renderSpecKpi(el, result, payload) {
  var format = payload.format;
  var style = payload.style;
  var color = (style && style.color) || '';
  var valueStr = _fmtSpecValue(result.value, format);
  var html = '<div class="kpi-value"' + (color ? ' style="color:' + color + ';"' : '') + '>' + (style && style.icon ? style.icon + ' ' : '') + valueStr + '</div>';
  html += '<div class="kpi-desc">' + _escapeHtml(payload.subtitle || payload.title || '') + '</div>';

  // comparison: result.comparison.deltaPercent (null 가능)
  var cmp = result.comparison;
  if (cmp && cmp.deltaPercent != null) {
    var up = cmp.deltaPercent >= 0;
    var dp = Math.abs(cmp.deltaPercent).toFixed(1);
    html += '<div class="kpi-change ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + ' ' + dp + '%</div>';
  }
  el.innerHTML = html;
}

// ── table (rows: Record<string,unknown>[]) ──
function _renderSpecTable(el, rows) {
  if (!rows || !rows.length) {
    el.innerHTML = '<div class="kpi-desc" style="padding:16px;text-align:center;">데이터 없음</div>';
    return;
  }
  // 열 = 첫 행의 키 (id/createdBy 등 잡음 제거: 최대 6열)
  var keys = Object.keys(rows[0]).filter(function (k) {
    return ['createdBy', 'updatedAt'].indexOf(k) === -1;
  }).slice(0, 6);
  var html = '<div style="overflow:auto;flex:1;"><table class="widget-table"><thead><tr>';
  keys.forEach(function (k) { html += '<th>' + _escapeHtml(k) + '</th>'; });
  html += '</tr></thead><tbody>';
  rows.forEach(function (row) {
    html += '<tr>';
    keys.forEach(function (k) {
      var v = row[k];
      if (v != null && typeof v === 'object') v = JSON.stringify(v);
      html += '<td>' + _escapeHtml(v) + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ── spec 위젯 1개 렌더 (fetch → kind 분기) ──
async function renderSpecWidget(elId, widgetId) {
  var el = document.getElementById(elId);
  if (!el) return;
  try {
    var r = await fetch('/api/dashboard/widgets/' + encodeURIComponent(widgetId) + '/data', { credentials: 'same-origin' });
    var payload = await r.json();
    if (!r.ok || !payload.ok) {
      el.innerHTML = '<div class="kpi-value">—</div><div class="kpi-desc">' + _escapeHtml((payload && payload.error) || '데이터 조회 실패') + '</div>';
      return;
    }
    renderSpecResult(el, payload);
  } catch (e) {
    el.innerHTML = '<div class="kpi-value">—</div><div class="kpi-desc">데이터 조회 오류</div>';
    // eslint-disable-next-line no-console
    console.warn('[dashboard] spec 위젯 렌더 실패', widgetId, e);
  }
}

// result(payload) → DOM. 빌더 미리보기는 이미 받은 result 를 직접 그리므로 분리.
// payload = { ok, result:{kind,value?,series?,rows?,comparison?}, kind?, title?, subtitle?, format?, style? }
function renderSpecResult(el, payload) {
  var result = payload.result || {};
  var kind = result.kind || payload.kind;
  switch (kind) {
    case 'kpi':
      _renderSpecKpi(el, result, payload);
      break;
    case 'gauge':
      _renderSpecGauge(el, result.value, payload.style, payload.format);
      break;
    case 'table':
      _renderSpecTable(el, result.rows);
      break;
    case 'bar':
    case 'hbar':
    case 'line':
    case 'pie':
    case 'donut':
      _renderSpecChart(el, kind, result.series, payload.style);
      break;
    default:
      el.innerHTML = '<div class="kpi-desc">알 수 없는 위젯 종류: ' + _escapeHtml(kind) + '</div>';
  }
}

/* ══════════════════════════════════════════
   실시간 갱신 — Tier 2 (폴링) + Tier 3 (액션 후)
   ══════════════════════════════════════════ */

// 모든 위젯 재계산/재fetch. spec 위젯은 data 재fetch, prototype 위젯은 MOCK 재계산.
function refreshAllWidgets() {
  if (typeof grid === 'undefined' || !grid) return;
  grid.getGridItems().forEach(function (el) {
    var bodyEl = el.querySelector('.widget-body');
    if (!bodyEl) return;
    if (el.dataset.widgetSpec === '1' && el.dataset.widgetId) {
      renderSpecWidget(bodyEl.id, el.dataset.widgetId);
    } else {
      // prototype 위젯: MOCK getter 가 window.* 최신값으로 재계산
      renderWidgetContent(el.dataset.widgetType, el.dataset.widgetPreset || null, bodyEl.id);
    }
  });
}

// Tier 3: 외부 액션(발주/확정 등) 후 호출 가능한 전역 함수
window.refreshDashboardWidgets = refreshAllWidgets;

// Tier 2: 60초 폴링 (페이지 visible 일 때만). visibilitychange 로 일시정지/재개.
var _pollTimer = null;
function _startWidgetPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(function () {
    if (document.visibilityState === 'visible') refreshAllWidgets();
  }, 60000);
}
function _stopWidgetPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    refreshAllWidgets();   // 복귀 즉시 1회 갱신
    _startWidgetPolling();
  } else {
    _stopWidgetPolling();  // 숨김 상태에서는 폴링 중지 (불필요한 요청 방지)
  }
});
window.addEventListener('beforeunload', _stopWidgetPolling);

// ── Add Widget to Grid ──
function addWidget(type, title, preset, w, h) {
  widgetCounter++;
  var id = 'widget-' + widgetCounter;
  var bodyId = 'wbody-' + widgetCounter;
  var typeDef = WIDGET_TYPES.find(function (t) { return t.id === type; });
  w = w || typeDef.defaultW;
  h = h || typeDef.defaultH;

  var content =
    '<div class="widget-header">' +
      '<span class="widget-title">' + (title || typeDef.name) + '</span>' +
      '<button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button>' +
    '</div>' +
    '<div class="widget-body" id="' + bodyId + '"></div>';

  grid.addWidget({
    id: id,
    w: w,
    h: h,
    content: content,
    autoPosition: true,
  });

  // Render after DOM is ready
  setTimeout(function () { renderWidgetContent(type, preset, bodyId); }, 50);

  // Store meta
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    el.dataset.widgetType = type;
    el.dataset.widgetPreset = preset || '';
    el.dataset.widgetTitle = title || typeDef.name;
  }
}

function removeWidget(id) {
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    grid.removeWidget(el);
    saveDashboard();
  }
}

// ── Default Layout ──
function loadDefaultLayout() {
  grid.removeAll();
  addWidget('kpi', '이번 달 매출', 'monthly_sales', 3, 2);
  addWidget('kpi', '오늘 발주', 'today_orders', 3, 2);
  addWidget('kpi', '총 미수금', 'total_ar', 3, 2);
  addWidget('kpi', '활성 거래처', 'active_clients', 3, 2);
  addWidget('vbar', '최근 7일 매출 추이', 'weekly_sales', 6, 4);
  addWidget('hbar', '거래처별 매출 비중', 'client_share', 6, 4);
  addWidget('table', '오늘 발주 현황', 'today_order_list', 6, 5);
  addWidget('donut', '품목별 매출 구성', 'product_mix', 3, 4);
  addWidget('gauge', '월 매출 목표 달성률', 'sales_target', 3, 3);
}

// ── Save / Load Dashboard ──
// 2026-05-27: DB API sync 추가. localStorage 는 즉시 UX 보장용 fallback.
//   - saveDashboard()  : localStorage 즉시 + DB bulk POST (3초 debounce)
//   - loadDashboard()  : async — DB GET 우선, 빈/실패 시 localStorage 폴백
//   - _applyItemsToGrid: prototype 형식 items[] 을 GridStack 에 복원 (공용)
function saveDashboard() {
  var items = grid.getGridItems().map(function (el) {
    var node = el.gridstackNode;
    var item = {
      type: el.dataset.widgetType,
      title: el.dataset.widgetTitle,
      preset: el.dataset.widgetPreset,
      dateOverride: el.dataset.widgetDateOverride || '',
      x: node.x, y: node.y, w: node.w, h: node.h
    };
    // spec 위젯: spec/widgetId 보존 (DB sync 시 config.spec 유실 방지)
    if (el.dataset.widgetSpec === '1') {
      item.isSpec = true;
      if (el.dataset.widgetId) item.widgetId = el.dataset.widgetId;
      if (window._specCache && el.dataset.widgetId && window._specCache[el.dataset.widgetId]) {
        item.spec = window._specCache[el.dataset.widgetId];
      }
    }
    return item;
  });
  // 1) localStorage 즉시 저장 (즉각적 UX, DB sync 실패에도 살아남음)
  try { localStorage.setItem('rtbio_dashboard', JSON.stringify(items)); } catch (e) {}
  // 2) DB sync — debounced 3초 (GridStack onChange 가 잦으므로)
  _scheduleDashboardSync(items);
}

var _saveTimer = null;
function _scheduleDashboardSync(items) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    _saveTimer = null;
    var payload = {
      items: items
        .filter(function (it) { return it && it.preset; }) // 빈 위젯은 DB 동기화 제외
        .map(function (it, idx) {
          var config = {
            x: Number(it.x) || 0,
            y: Number(it.y) || 0,
            title: (it.title || '').slice(0, 200),
            type: (it.type || '').slice(0, 50),
          };
          // spec 위젯: config.spec 보존 (bulk endpoint passthrough → 재로드 시 복원)
          if (it.isSpec && it.spec) config.spec = it.spec;
          return {
            preset: String(it.preset).slice(0, 100),
            position: idx,
            width: Number(it.w) || 6,
            height: Number(it.h) || 4,
            overrideDateRange: it.dateOverride ? String(it.dateOverride).slice(0, 50) : null,
            config: config,
          };
        }),
    };
    var hasSpec = payload.items.some(function (it) { return it.config && it.config.spec; });
    fetch('/api/dashboard/widgets/bulk', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function () {
      // bulk 은 deleteMany→create 라 spec 위젯의 DB id 가 바뀐다.
      // data endpoint 는 id 기반이므로, sync 후 새 id 로 dataset 을 갱신 (DOM 재생성 X).
      if (hasSpec) _resyncSpecWidgetIds();
    }).catch(function (e) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] DB sync 실패 — localStorage 만 유지', e);
    });
  }, 3000);
}

// bulk sync 후 spec 위젯의 새 DB id 를 재매핑 (stale id 방지).
// DB rows(position asc) ↔ 화면 위젯(sync 와 동일 필터/순서)을 position 으로 zip.
async function _resyncSpecWidgetIds() {
  try {
    var r = await fetch('/api/dashboard/widgets', { credentials: 'same-origin' });
    if (!r.ok) return;
    var rows = await r.json();
    if (!Array.isArray(rows)) return;
    // position → DB row
    var byPos = {};
    rows.forEach(function (w) { byPos[w.position] = w; });

    // sync 와 동일하게: preset 있는 위젯만, GridStack 기본 순서대로 position 0..n 부여
    var pos = 0;
    grid.getGridItems().forEach(function (el) {
      if (!el.dataset.widgetPreset) return; // 빈 위젯은 sync 제외 → position 미부여
      var row = byPos[pos];
      pos++;
      if (!row) return;
      if (el.dataset.widgetSpec === '1' && row.config && row.config.spec) {
        var oldId = el.dataset.widgetId;
        el.dataset.widgetId = row.id;
        window._specCache = window._specCache || {};
        window._specCache[row.id] = row.config.spec;
        if (oldId && oldId !== row.id && window._specCache[oldId]) delete window._specCache[oldId];
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[dashboard] spec id 재동기화 실패', e);
  }
}

function _applyItemsToGrid(items) {
  grid.removeAll();
  items.forEach(function (item) {
    widgetCounter++;
    var id = 'widget-' + widgetCounter;
    var bodyId = 'wbody-' + widgetCounter;
    var content =
      '<div class="widget-header">' +
        '<span class="widget-title">' + (item.title || '') + '</span>' +
        '<button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button>' +
      '</div>' +
      '<div class="widget-body" id="' + bodyId + '"></div>';
    grid.addWidget({
      id: id, x: item.x, y: item.y, w: item.w, h: item.h, content: content
    });
    var el = document.querySelector('[gs-id="' + id + '"]');
    if (el) {
      el.dataset.widgetType = item.type || '';
      el.dataset.widgetPreset = item.preset || '';
      el.dataset.widgetTitle = item.title || '';
      el.dataset.widgetDateOverride = item.dateOverride || '';
      // spec 위젯이면 DB id 보관 (data endpoint fetch 용)
      if (item.spec && item.widgetId) {
        el.dataset.widgetId = item.widgetId;
        el.dataset.widgetSpec = '1';
        // spec 원본 캐시 — DB sync 시 config.spec 유실 방지
        window._specCache = window._specCache || {};
        window._specCache[item.widgetId] = item.spec;
      }
    }
    if (item.spec && item.widgetId) {
      (function (bid, wid) {
        setTimeout(function () { renderSpecWidget(bid, wid); }, 50);
      })(bodyId, item.widgetId);
    } else {
      setTimeout(function () { renderWidgetContent(item.type, item.preset, bodyId); }, 50);
    }
  });
}

async function loadDashboard() {
  // 1) DB 시도
  try {
    var r = await fetch('/api/dashboard/widgets', { credentials: 'same-origin' });
    if (r.ok) {
      var data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        // DB 응답을 prototype 형식으로 복원
        var items = data.map(function (w) {
          var cfg = w.config || {};
          // spec 위젯: config.spec 존재 → executeWidgetSpec endpoint 로 그림
          var spec = cfg.spec || null;
          return {
            type: spec ? 'spec' : (cfg.type || 'kpi'),
            title: (spec && spec.title) || cfg.title || w.preset,
            preset: w.preset,
            spec: spec,             // spec 위젯 마커 (있으면 spec 렌더)
            widgetId: w.id,         // DB id — /widgets/{id}/data fetch 용
            dateOverride: w.overrideDateRange || '',
            x: cfg.x != null ? cfg.x : 0,
            y: cfg.y != null ? cfg.y : 0,
            w: w.width,
            h: w.height,
          };
        });
        _applyItemsToGrid(items);
        return true;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[dashboard] DB 조회 실패 — localStorage 폴백', e);
  }

  // 2) localStorage 폴백
  var saved = localStorage.getItem('rtbio_dashboard');
  if (saved) {
    try {
      var items2 = JSON.parse(saved);
      _applyItemsToGrid(items2);
      return true;
    } catch (e) { return false; }
  }
  return false;
}

// ── Export / Import ──
function exportDashboard() {
  var items = grid.getGridItems().map(function (el) {
    var node = el.gridstackNode;
    return {
      type: el.dataset.widgetType,
      title: el.dataset.widgetTitle,
      preset: el.dataset.widgetPreset,
      x: node.x, y: node.y, w: node.w, h: node.h
    };
  });
  var json = JSON.stringify({ version: '1.0', portal: 'exec', widgets: items }, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'rtbio-dashboard-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('대시보드를 내보냈습니다');
}

function importDashboard(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = JSON.parse(e.target.result);
      if (data.widgets && Array.isArray(data.widgets)) {
        grid.removeAll();
        data.widgets.forEach(function (item) { addWidget(item.type, item.title, item.preset, item.w, item.h); });
        saveDashboard();
        showToast('대시보드를 가져왔습니다 (위젯 ' + data.widgets.length + '개)');
      }
    } catch (err) {
      showToast('올바른 대시보드 JSON 파일이 아닙니다');
    }
  };
  reader.readAsText(file);
}

// ── Widget Picker ──
function openPicker() {
  document.getElementById('pickerOverlay').classList.add('open');
  if (window.onPickerOpen) window.onPickerOpen(); // 갤러리 lazy-load 훅 (widget-builder.js)
}
function closePicker() {
  document.getElementById('pickerOverlay').classList.remove('open');
}

function renderPicker() {
  // Presets — 2026-05-22: role 필터링 적용
  // 2026-06-02(Phase A): 갤러리 모달로 교체되어 #presetList/#widgetTypeGrid 가 더 이상 없다.
  //   레거시 호출부(init/setDashboardRole) 가 남아 있으므로 안전 가드로 조용히 종료. (Phase B5 에서 함수 자체 제거)
  var presetList = document.getElementById('presetList');
  if (!presetList) return;
  presetList.innerHTML = getVisiblePresets().map(function (p) {
    var typeDef = WIDGET_TYPES.find(function (t) { return t.id === p.type; });
    return '' +
      '<div class="preset-item" onclick="addPresetWidget(\'' + p.type + '\',\'' + p.name + '\',\'' + p.preset + '\',' + p.w + ',' + p.h + ')">' +
        '<div class="preset-icon">' + typeDef.icon + '</div>' +
        '<div class="preset-info">' +
          '<div class="preset-name">' + p.name + '</div>' +
          '<div class="preset-desc-text">' + p.desc + '</div>' +
        '</div>' +
        '<span class="preset-type">' + typeDef.name + '</span>' +
      '</div>';
  }).join('');

  // Widget types
  var typeGrid = document.getElementById('widgetTypeGrid');
  typeGrid.innerHTML = WIDGET_TYPES.map(function (t) {
    return '' +
      '<div class="picker-card" onclick="addEmptyWidget(\'' + t.id + '\')">' +
        '<div class="picker-card-icon">' + t.icon + '</div>' +
        '<div class="picker-card-name">' + t.name + '</div>' +
        '<div class="picker-card-desc">' + t.desc + '</div>' +
      '</div>';
  }).join('');
}

function addPresetWidget(type, title, preset, w, h) {
  addWidget(type, title, preset, w, h);
  closePicker();
  saveDashboard();
  showToast('"' + title + '" 위젯을 추가했습니다');
}

// spec 위젯 1개를 그리드에 추가 (갤러리/빌더 공용). _applyItemsToGrid 의 spec 분기를 단건 재사용.
function addSpecWidgetToGrid(spec, savedId) {
  widgetCounter++;
  var id = 'widget-' + widgetCounter, bodyId = 'wbody-' + widgetCounter;
  var w = (spec.layout && spec.layout.w) || 3, h = (spec.layout && spec.layout.h) || 2;
  var content = '<div class="widget-header"><span class="widget-title">' + _escapeHtml(spec.title) +
    '</span><button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button></div>' +
    '<div class="widget-body" id="' + bodyId + '"></div>';
  grid.addWidget({ id: id, w: w, h: h, content: content, autoPosition: true });
  var el = document.querySelector('[gs-id="' + id + '"]');
  if (el) {
    el.dataset.widgetType = 'spec'; el.dataset.widgetTitle = spec.title;
    el.dataset.widgetSpec = '1'; el.dataset.widgetId = savedId; el.dataset.widgetPreset = 'spec:custom';
    window._specCache = window._specCache || {}; window._specCache[savedId] = spec;
  }
  setTimeout(function () { renderSpecWidget(bodyId, savedId); }, 50);
  saveDashboard();
}

// ── Toast ──
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

// ── Expose functions needed by HTML onclick handlers ──
window.addWidget = addWidget;
window.removeWidget = removeWidget;
window.addPresetWidget = addPresetWidget;
window.showToast = showToast;

// ── spec 렌더러/그리드 추가/피커 토글 — 빌더(widget-builder.js) 재사용 ──
window.renderSpecResult = renderSpecResult;
window.addSpecWidgetToGrid = addSpecWidgetToGrid;
window.closePicker = closePicker;
window._WIDGET = { COLORS: COLORS }; // 빌더가 색상 토큰 참조

// 2026-05-22: 외부에서 role 지정 가능 (포털 init 시 호출)
window.setDashboardRole = function (role) {
  _currentDashboardRole = role || null;
  // 이미 picker 가 렌더링됐다면 다시 그려서 필터 적용
  if (document.getElementById('presetList')) renderPicker();
};

// ── Init ──
document.addEventListener('DOMContentLoaded', async function () {
  // 2026-05-22: body[data-dashboard-role] 또는 window._dashboardRole 로 role 주입
  var roleAttr = document.body && document.body.getAttribute('data-dashboard-role');
  if (roleAttr) _currentDashboardRole = roleAttr;
  else if (window._dashboardRole) _currentDashboardRole = window._dashboardRole;

  initGrid();
  renderPicker();

  // Load saved or default — 2026-05-27: DB 우선, 폴백 localStorage, 둘 다 없으면 default.
  var loaded = await loadDashboard();
  if (!loaded) {
    loadDefaultLayout();
  }

  // 실시간 Tier 2 — 60초 폴링 시작 (spec 위젯 data refresh + prototype 재계산)
  _startWidgetPolling();

  // ── C-1: Global Date Range Selector ──
  var globalSel = document.getElementById('globalDateRange');
  var fromInput = document.getElementById('globalDateFrom');
  var toInput = document.getElementById('globalDateTo');
  if (globalSel) {
    var g = getGlobalDateRange();
    globalSel.value = g.range;
    if (fromInput) fromInput.value = g.from;
    if (toInput) toInput.value = g.to;
    var showCustom = g.range === 'custom';
    if (fromInput) fromInput.style.display = showCustom ? '' : 'none';
    if (toInput) toInput.style.display = showCustom ? '' : 'none';

    globalSel.addEventListener('change', function () {
      var newRange = globalSel.value;
      var isCustom = newRange === 'custom';
      fromInput.style.display = isCustom ? '' : 'none';
      toInput.style.display = isCustom ? '' : 'none';

      // 위젯 override가 하나라도 있으면 확인
      var hasOverride = grid.getGridItems().some(function (el) {
        return el.dataset.widgetDateOverride;
      });
      if (hasOverride && !confirm('전역 기간을 변경하면 모든 위젯의 개별 기간 설정이 리셋됩니다. 계속할까요?')) {
        globalSel.value = getGlobalDateRange().range;
        return;
      }

      // 리셋
      grid.getGridItems().forEach(function (el) {
        el.dataset.widgetDateOverride = '';
        var titleEl = el.querySelector('.widget-title');
        if (titleEl) {
          var baseTitle = el.dataset.widgetTitle || '';
          titleEl.textContent = baseTitle;
        }
      });

      saveGlobalDateRange({
        range: newRange,
        from: fromInput.value,
        to: toInput.value
      });
      saveDashboard();
      showToast('전역 기간: ' + DATE_LABELS[newRange] + ' (위젯 override 리셋됨)');

      // 전 위젯 리렌더 (spec 위젯은 data 재fetch, prototype 은 MOCK 재계산)
      refreshAllWidgets();
    });

    [fromInput, toInput].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('change', function () {
        saveGlobalDateRange({
          range: globalSel.value,
          from: fromInput.value,
          to: toInput.value
        });
        showToast('커스텀 기간 저장됨');
      });
    });
  }

  // Event listeners
  document.getElementById('btnAddWidget').addEventListener('click', openPicker);
  document.getElementById('pickerClose').addEventListener('click', closePicker);
  document.getElementById('pickerOverlay').addEventListener('click', function (e) {
    if (e.target === document.getElementById('pickerOverlay')) closePicker();
  });

  // Kebab menu
  var kebabBtn = document.getElementById('kebabBtn');
  var kebabMenu = document.getElementById('kebabMenu');
  kebabBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    kebabMenu.classList.toggle('open');
  });
  document.addEventListener('click', function () { kebabMenu.classList.remove('open'); });
  kebabMenu.addEventListener('click', function (e) { e.stopPropagation(); });

  document.getElementById('btnExport').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    exportDashboard();
  });
  document.getElementById('btnImport').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    if (e.target.files[0]) {
      importDashboard(e.target.files[0]);
      e.target.value = '';
    }
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    kebabMenu.classList.remove('open');
    if (confirm('기본 레이아웃으로 초기화할까요? 현재 배치가 사라집니다.')) {
      // localStorage + DB 양쪽 모두 초기화
      try { localStorage.removeItem('rtbio_dashboard'); } catch (e) {}
      // DB reset 은 fire-and-forget — 실패해도 default layout 은 그려진다.
      fetch('/api/dashboard/widgets/reset', {
        method: 'POST', credentials: 'same-origin'
      }).catch(function (e) {
        // eslint-disable-next-line no-console
        console.warn('[dashboard] DB reset 실패', e);
      });
      // pending debounced sync 가 reset 직후 기본 레이아웃을 다시 DB 에 푸시한다.
      loadDefaultLayout();
      showToast('기본 레이아웃으로 초기화했습니다');
    }
  });

  // ── Right-click Context Menu ──
  var ctxMenu = document.getElementById('widgetCtx');
  var ctxTargetId = null;

  document.getElementById('gridStack').addEventListener('contextmenu', function (e) {
    var gsItem = e.target.closest('.grid-stack-item');
    if (!gsItem) return;
    e.preventDefault();
    ctxTargetId = gsItem.getAttribute('gs-id');
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    ctxMenu.classList.add('open');
  });

  document.addEventListener('click', function () { ctxMenu.classList.remove('open'); });
  document.addEventListener('contextmenu', function (e) {
    if (!e.target.closest('.grid-stack-item')) ctxMenu.classList.remove('open');
  });

  ctxMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('.widget-ctx-item');
    if (!btn || !ctxTargetId) return;
    var action = btn.dataset.action;
    var el = document.querySelector('[gs-id="' + ctxTargetId + '"]');
    ctxMenu.classList.remove('open');

    if (action === 'delete') {
      removeWidget(ctxTargetId);
      showToast('위젯을 삭제했습니다');
    } else if (action === 'edit') {
      openEditModal(ctxTargetId);
    } else if (action === 'duplicate') {
      if (el) {
        addWidget(el.dataset.widgetType, el.dataset.widgetTitle + ' (복사)', el.dataset.widgetPreset || null,
          el.gridstackNode.w, el.gridstackNode.h);
        saveDashboard();
        showToast('위젯을 복제했습니다');
      }
    } else if (action === 'refresh') {
      if (el) {
        var bodyEl = el.querySelector('.widget-body');
        if (bodyEl) {
          if (el.dataset.widgetSpec === '1' && el.dataset.widgetId) {
            renderSpecWidget(bodyEl.id, el.dataset.widgetId);
          } else {
            renderWidgetContent(el.dataset.widgetType, el.dataset.widgetPreset || null, bodyEl.id);
          }
          showToast('위젯을 새로고침했습니다');
        }
      }
    }
  });

  // ── Edit Modal ──
  var editOverlay = document.getElementById('editOverlay');
  var editTitle = document.getElementById('editTitle');
  var editType = document.getElementById('editType');
  var editPreset = document.getElementById('editPreset');
  var customSection = document.getElementById('customSection');
  var editingWidgetId = null;

  // Populate edit selects
  WIDGET_TYPES.forEach(function (t) {
    var opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.icon + ' ' + t.name;
    editType.appendChild(opt);
  });
  // 2026-05-22: edit-modal 의 데이터 소스 선택도 role 필터링
  getVisiblePresets().forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.preset;
    opt.textContent = '📌 ' + p.name;
    editPreset.appendChild(opt);
  });

  // Show/hide custom section based on preset selection
  editPreset.addEventListener('change', function () {
    if (editPreset.value === '') {
      customSection.classList.add('visible');
      renderColumnChips();
      renderPreview();
    } else {
      customSection.classList.remove('visible');
    }
  });

  // Table change → update chips & filters
  document.getElementById('customTable').addEventListener('change', function () {
    renderColumnChips();
    document.getElementById('filterRows').innerHTML = '';
    renderPreview();
  });

  // ── Column Chips ──
  function renderColumnChips() {
    var table = document.getElementById('customTable').value;
    var cols = TABLE_COLUMNS[table] || [];
    var container = document.getElementById('colChips');
    container.innerHTML = cols.map(function (c) {
      return '<span class="col-chip selected" data-col="' + c.id + '">' + c.name + '</span>';
    }).join('');
    container.querySelectorAll('.col-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chip.classList.toggle('selected');
        renderPreview();
      });
    });
  }

  // ── Filter Rows ──
  document.getElementById('addFilterBtn').addEventListener('click', addFilterRow);

  function addFilterRow() {
    var table = document.getElementById('customTable').value;
    var cols = TABLE_COLUMNS[table] || [];
    var row = document.createElement('div');
    row.className = 'custom-row';

    var fieldSelect = document.createElement('select');
    fieldSelect.className = 'col-field';
    cols.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      opt.dataset.type = c.type;
      fieldSelect.appendChild(opt);
    });

    var opSelect = document.createElement('select');
    opSelect.className = 'col-op';

    var valInput = document.createElement('input');
    valInput.className = 'col-val';
    valInput.placeholder = '값 입력';

    var delBtn = document.createElement('button');
    delBtn.className = 'col-del';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function () { row.remove(); renderPreview(); });

    function updateOps() {
      var selOpt = fieldSelect.options[fieldSelect.selectedIndex];
      var colType = selOpt ? selOpt.dataset.type : 'text';
      var ops = OPERATORS[colType] || OPERATORS.text;
      opSelect.innerHTML = ops.map(function (o) { return '<option>' + o + '</option>'; }).join('');

      // If select type, change input to select
      var col = cols.find(function (c) { return c.id === fieldSelect.value; });
      if (col && col.type === 'select' && col.options) {
        var newSelect = document.createElement('select');
        newSelect.className = 'col-val';
        col.options.forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o; opt.textContent = o;
          newSelect.appendChild(opt);
        });
        newSelect.addEventListener('change', renderPreview);
        if (row.contains(valInput)) row.replaceChild(newSelect, valInput);
      } else if (col && col.type === 'date') {
        valInput.type = 'date';
        valInput.placeholder = '';
      } else {
        valInput.type = 'text';
        valInput.placeholder = '값 입력';
      }
    }

    fieldSelect.addEventListener('change', function () { updateOps(); renderPreview(); });
    opSelect.addEventListener('change', renderPreview);
    valInput.addEventListener('input', renderPreview);

    row.append(fieldSelect, opSelect, valInput, delBtn);
    document.getElementById('filterRows').appendChild(row);
    updateOps();
  }

  // ── Preview ──
  function renderPreview() {
    var table = document.getElementById('customTable').value;
    var data = PREVIEW_DATA[table] || [];
    var cols = TABLE_COLUMNS[table] || [];

    // Get selected columns
    var selectedCols = [];
    document.querySelectorAll('#colChips .col-chip.selected').forEach(function (c) { selectedCols.push(c.dataset.col); });
    if (selectedCols.length === 0) {
      document.getElementById('previewWrap').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">표시할 컬럼을 선택하세요</div>';
      document.getElementById('previewCount').textContent = '';
      return;
    }

    // Filter data (simple mock filtering)
    var filtered = [].concat(data);
    document.querySelectorAll('#filterRows .custom-row').forEach(function (row) {
      var field = row.querySelector('.col-field') ? row.querySelector('.col-field').value : null;
      var op = row.querySelector('.col-op') ? row.querySelector('.col-op').value : null;
      var val = (row.querySelector('.col-val') ? row.querySelector('.col-val').value : '').trim();
      if (!field || !val) return;
      filtered = filtered.filter(function (item) {
        var cellVal = (item[field] || '').toString();
        switch (op) {
          case '=': return cellVal === val;
          case '≠': return cellVal !== val;
          case '포함': return cellVal.includes(val);
          case '시작': return cellVal.startsWith(val);
          case '끝': return cellVal.endsWith(val);
          default: return true;
        }
      });
    });

    // Build table
    var html = '<table><thead><tr>';
    selectedCols.forEach(function (colId) {
      var col = cols.find(function (c) { return c.id === colId; });
      html += '<th>' + (col ? col.name : colId) + '</th>';
    });
    html += '</tr></thead><tbody>';
    filtered.forEach(function (row) {
      html += '<tr>';
      selectedCols.forEach(function (colId) { html += '<td>' + (row[colId] || '-') + '</td>'; });
      html += '</tr>';
    });
    if (filtered.length === 0) {
      html += '<tr><td colspan="' + selectedCols.length + '" style="text-align:center;color:var(--text-muted);padding:16px;">조건에 맞는 데이터 없음</td></tr>';
    }
    html += '</tbody></table>';

    document.getElementById('previewWrap').innerHTML = html;
    document.getElementById('previewCount').textContent = filtered.length + '건 표시 (전체 ' + data.length + '건)';
  }

  // ── Grouping/Agg/Sort change → re-preview ──
  ['customGroup', 'customAgg', 'customSort'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', renderPreview);
  });

  function openEditModal(widgetId) {
    var el = document.querySelector('[gs-id="' + widgetId + '"]');
    if (!el) return;
    editingWidgetId = widgetId;
    editTitle.value = el.dataset.widgetTitle || '';
    editType.value = el.dataset.widgetType || 'kpi';
    editPreset.value = el.dataset.widgetPreset || '';
    var dateOvrSel = document.getElementById('editDateOverride');
    if (dateOvrSel) dateOvrSel.value = el.dataset.widgetDateOverride || '';

    // Show/hide custom section
    if (!el.dataset.widgetPreset) {
      customSection.classList.add('visible');
      renderColumnChips();
      renderPreview();
    } else {
      customSection.classList.remove('visible');
    }

    editOverlay.classList.add('open');
    editTitle.focus();
  }

  function closeEditModal() {
    editOverlay.classList.remove('open');
    editingWidgetId = null;
    customSection.classList.remove('visible');
    document.getElementById('filterRows').innerHTML = '';
  }

  document.getElementById('editClose').addEventListener('click', closeEditModal);
  document.getElementById('editCancel').addEventListener('click', closeEditModal);
  editOverlay.addEventListener('click', function (e) {
    if (e.target === editOverlay) closeEditModal();
  });

  document.getElementById('editSave').addEventListener('click', function () {
    if (!editingWidgetId) return;
    var el = document.querySelector('[gs-id="' + editingWidgetId + '"]');
    if (!el) return;

    var newTitle = editTitle.value.trim() || '위젯';
    var newType = editType.value;
    var newPreset = editPreset.value || null;
    var dateOvrSel = document.getElementById('editDateOverride');
    var newOverride = dateOvrSel ? dateOvrSel.value : '';

    el.dataset.widgetTitle = newTitle;
    el.dataset.widgetType = newType;
    el.dataset.widgetPreset = newPreset || '';
    el.dataset.widgetDateOverride = newOverride || '';

    var titleEl = el.querySelector('.widget-title');
    if (titleEl) {
      titleEl.textContent = newTitle + (newOverride ? ' 🔶' : '');
      titleEl.title = '기간: ' + getEffectiveDateLabel(el);
    }

    var bodyEl = el.querySelector('.widget-body');
    if (bodyEl) renderWidgetContent(newType, newPreset, bodyEl.id);

    saveDashboard();
    closeEditModal();
    showToast('"' + newTitle + '" 위젯을 수정했습니다');
  });

  // ESC to close picker & kebab & context & edit
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closePicker();
      kebabMenu.classList.remove('open');
      ctxMenu.classList.remove('open');
      closeEditModal();
    }
  });
});

})();
