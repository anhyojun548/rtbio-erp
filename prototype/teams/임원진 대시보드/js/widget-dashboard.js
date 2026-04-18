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
const PRESETS = [
  { name: '이번 달 매출', type: 'kpi', preset: 'monthly_sales', desc: '당월 누적 매출액', w: 3, h: 2 },
  { name: '오늘 발주', type: 'kpi', preset: 'today_orders', desc: '금일 접수된 발주 건수', w: 3, h: 2 },
  { name: '총 미수금', type: 'kpi', preset: 'total_ar', desc: '미수금 합계 + 연체 건수', w: 3, h: 2 },
  { name: '활성 거래처', type: 'kpi', preset: 'active_clients', desc: '현재 거래 중인 거래처 수', w: 3, h: 2 },
  { name: '최근 7일 매출 추이', type: 'vbar', preset: 'weekly_sales', desc: '일별 매출 막대 그래프', w: 6, h: 4 },
  { name: '거래처별 매출 비중', type: 'hbar', preset: 'client_share', desc: '거래처별 매출 비율', w: 6, h: 4 },
  { name: '오늘 발주 현황', type: 'table', preset: 'today_order_list', desc: '금일 발주 목록 (상태 포함)', w: 6, h: 5 },
  { name: '품목별 매출 구성', type: 'donut', preset: 'product_mix', desc: '제품 카테고리별 매출 비율', w: 4, h: 4 },
  { name: '월별 매출 추이', type: 'line', preset: 'monthly_trend', desc: '최근 6개월 매출 트렌드', w: 6, h: 4 },
  { name: '월 매출 목표 달성률', type: 'gauge', preset: 'sales_target', desc: '목표 대비 현재 달성 퍼센트', w: 3, h: 3 },
  { name: '재고 부족 품목', type: 'table', preset: 'low_stock', desc: '안전재고 미달 품목 목록', w: 6, h: 4 },
  { name: '미수금 거래처', type: 'table', preset: 'ar_clients', desc: '미수금 보유 거래처 + 연체일', w: 6, h: 4 },
  { name: '거래처별 담당자 목록', type: 'table', preset: 'client_reps', desc: '거래처 / 담당자 / 연락처 / 최근거래일', w: 6, h: 5 },
];

// ── Mock Data for Presets ──
const MOCK = {
  monthly_sales: { value: '₩47,850,000', desc: '목표 대비 95.7%', change: '+12.3%', changeDir: 'up' },
  today_orders: { value: '8건', desc: '금일 접수된 발주', change: '+3건', changeDir: 'up' },
  total_ar: { value: '₩12,770,000', desc: '연체 3건', change: '+5.2%', changeDir: 'down' },
  active_clients: { value: '5개', desc: '대리점 3 / 병원 2', change: '', changeDir: '' },
  weekly_sales: {
    labels: ['04-05','04-06','04-07','04-08','04-09','04-10','04-11'],
    data: [4200000,0,5100000,6300000,4800000,5500000,3700000]
  },
  client_share: {
    labels: ['메디팜 의료기','한빛정형외과','대한메디칼','세종재활의학과','미래의료기'],
    data: [1491650,1397700,868200,682000,421950]
  },
  today_order_list: {
    headers: ['발주번호','거래처','금액','상태','시간'],
    rows: [
      ['ORD-0411-001','메디팜 의료기','₩570,000','접수','09:32'],
      ['ORD-0411-002','한빛정형외과','₩647,700','접수','10:15'],
      ['ORD-0411-003','미래의료기','₩291,000','접수','11:45'],
      ['ORD-0411-004','대한메디칼','₩308,200','확정','08:10'],
      ['ORD-0411-005','세종재활의학과','₩572,000','확정','08:45'],
      ['ORD-0411-006','메디팜 의료기','₩414,150','확정','09:00'],
      ['ORD-0411-007','한빛정형외과','₩338,400','출고중','07:50'],
      ['ORD-0411-008','대한메디칼','₩560,000','출고중','07:30'],
    ]
  },
  product_mix: {
    labels: ['수술용품','진단기기','소모품','보호구','기타'],
    data: [35,25,20,12,8]
  },
  monthly_trend: {
    labels: ['11월','12월','1월','2월','3월','4월'],
    data: [38200000,42100000,39800000,44500000,46200000,47850000]
  },
  sales_target: { value: 95.7, label: '95.7%', target: '₩50,000,000' },
  low_stock: {
    headers: ['품목코드','품목명','현재고','안전재고','부족분'],
    rows: [
      ['MED-0042','수술용 장갑 (M)','120','200','80'],
      ['MED-0078','일회용 마스크 (50매)','80','300','220'],
      ['MED-0123','소독용 알코올 500ml','45','100','55'],
    ]
  },
  ar_clients: {
    headers: ['거래처','미수금','연체일','상태'],
    rows: [
      ['한국의료기','₩8,500,000','15일','주의'],
      ['대한메디칼','₩3,200,000','7일','주의'],
      ['글로벌헬스','₩12,100,000','32일','위험'],
    ]
  },
  // C-4: 거래처+담당자 프리셋
  client_reps: {
    headers: ['거래처','유형','담당 영업사원','연락처','최근 거래일'],
    rows: [
      ['메디팜 의료기','대리점','박영업','010-1111-2222','2026-04-11'],
      ['한빛정형외과','병원','신영업','010-3333-4444','2026-04-11'],
      ['대한메디칼','대리점','이영업','010-5555-6666','2026-04-10'],
      ['세종재활의학과','병원','박영업','010-7777-8888','2026-04-09'],
      ['미래의료기','대리점','신영업','010-9999-0000','2026-04-11'],
    ]
  }
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
function saveDashboard() {
  var items = grid.getGridItems().map(function (el) {
    var node = el.gridstackNode;
    return {
      type: el.dataset.widgetType,
      title: el.dataset.widgetTitle,
      preset: el.dataset.widgetPreset,
      dateOverride: el.dataset.widgetDateOverride || '',
      x: node.x, y: node.y, w: node.w, h: node.h
    };
  });
  localStorage.setItem('rtbio_dashboard', JSON.stringify(items));
}

function loadDashboard() {
  var saved = localStorage.getItem('rtbio_dashboard');
  if (saved) {
    try {
      var items = JSON.parse(saved);
      grid.removeAll();
      items.forEach(function (item) {
        widgetCounter++;
        var id = 'widget-' + widgetCounter;
        var bodyId = 'wbody-' + widgetCounter;
        var content =
          '<div class="widget-header">' +
            '<span class="widget-title">' + item.title + '</span>' +
            '<button class="widget-menu-btn" onclick="removeWidget(\'' + id + '\')" title="위젯 삭제">✕</button>' +
          '</div>' +
          '<div class="widget-body" id="' + bodyId + '"></div>';
        grid.addWidget({
          id: id, x: item.x, y: item.y, w: item.w, h: item.h, content: content
        });
        var el = document.querySelector('[gs-id="' + id + '"]');
        if (el) {
          el.dataset.widgetType = item.type;
          el.dataset.widgetPreset = item.preset || '';
          el.dataset.widgetTitle = item.title;
          el.dataset.widgetDateOverride = item.dateOverride || '';
        }
        setTimeout(function () { renderWidgetContent(item.type, item.preset, bodyId); }, 50);
      });
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
}
function closePicker() {
  document.getElementById('pickerOverlay').classList.remove('open');
}

function renderPicker() {
  // Presets
  var presetList = document.getElementById('presetList');
  presetList.innerHTML = PRESETS.map(function (p) {
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

function addEmptyWidget(type) {
  var typeDef = WIDGET_TYPES.find(function (t) { return t.id === type; });
  addWidget(type, typeDef.name + ' (새 위젯)', null, typeDef.defaultW, typeDef.defaultH);
  closePicker();
  saveDashboard();
  showToast('빈 ' + typeDef.name + ' 위젯을 추가했습니다');
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
window.addEmptyWidget = addEmptyWidget;
window.showToast = showToast;

// ── Init ──
document.addEventListener('DOMContentLoaded', function () {
  initGrid();
  renderPicker();

  // Load saved or default
  if (!loadDashboard()) {
    loadDefaultLayout();
  }

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

      // 전 위젯 리렌더
      grid.getGridItems().forEach(function (el) {
        var bodyEl = el.querySelector('.widget-body');
        if (bodyEl) renderWidgetContent(el.dataset.widgetType, el.dataset.widgetPreset || null, bodyEl.id);
      });
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
      localStorage.removeItem('rtbio_dashboard');
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
          renderWidgetContent(el.dataset.widgetType, el.dataset.widgetPreset || null, bodyEl.id);
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
  PRESETS.forEach(function (p) {
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
