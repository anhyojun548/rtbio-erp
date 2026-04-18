/* ═══════════════════════════════════════
   AI Assistant Chat — Interactive Logic
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  // ── Portal-specific quick actions & responses ──
  const PORTAL_CONFIG = {
    exec: {
      label: '영업 어시스턴트',
      quickActions: [
        '이번 달 매출 현황',
        '미수금 거래처 목록',
        '재고 부족 품목',
        '주문서 작성',
        '거래처별 매출 비교',
      ],
      greeting: '안녕하세요! 영업 관련 데이터 조회, 주문 처리, 거래처 관리 등을 도와드릴게요.'
    },
    admin: {
      label: '경영지원 어시스턴트',
      quickActions: [
        '이번 달 매출/비용 요약',
        '미수금 현황',
        '사용자 권한 관리',
        '월간 보고서 생성',
        '거래처 현황'
      ],
      greeting: '안녕하세요! 매출/비용 분석, 사용자 관리, 보고서 생성 등을 도와드릴게요.'
    },
    qc: {
      label: '품질관리 어시스턴트',
      quickActions: [
        '입고 대기 목록',
        '검수 불합격 이력',
        '로트별 추적 조회',
        'COA 등록 현황',
        '반품 처리 현황'
      ],
      greeting: '안녕하세요! 입고 검수, 로트 추적, COA 관리, 반품 처리 등을 도와드릴게요.'
    },
    client: {
      label: '거래처 어시스턴트',
      quickActions: [
        '내 주문 현황',
        '거래명세서 조회',
        '미결제 내역',
        '제품 카탈로그',
        '재주문 요청'
      ],
      greeting: '안녕하세요! 주문 조회, 거래명세서 확인, 재주문 등을 도와드릴게요.'
    }
  };

  // ── Mock responses (demo) ──
  const MOCK_RESPONSES = {
    '이번 달 매출 현황': {
      text: '이번 달 매출 현황을 조회했습니다.',
      table: {
        headers: ['거래처', '주문 건', '매출액', '상태'],
        rows: [
          ['바이오메디', '12건', '45,200,000원', '<span class="data-tag tag-success">정상</span>'],
          ['메디프라임', '8건', '32,100,000원', '<span class="data-tag tag-success">정상</span>'],
          ['한국의료기', '5건', '18,500,000원', '<span class="data-tag tag-warning">미수금</span>'],
          ['서울바이오', '3건', '12,800,000원', '<span class="data-tag tag-success">정상</span>'],
        ]
      },
      summary: '총 매출: <strong>108,600,000원</strong> (전월 대비 +12.3%)',
      actions: ['엑셀 다운로드', '상세 보기']
    },
    '미수금 거래처 목록': {
      text: '미수금이 있는 거래처 목록입니다.',
      table: {
        headers: ['거래처', '미수금', '연체일', '상태'],
        rows: [
          ['한국의료기', '8,500,000원', '15일', '<span class="data-tag tag-warning">주의</span>'],
          ['대한메디컬', '3,200,000원', '7일', '<span class="data-tag tag-warning">주의</span>'],
          ['글로벌헬스', '12,100,000원', '32일', '<span class="data-tag tag-danger">위험</span>'],
        ]
      },
      summary: '총 미수금: <strong>23,800,000원</strong> (3개 거래처)',
      actions: ['입금 요청 메일 발송', '상세 보기']
    },
    '재고 부족 품목': {
      text: '안전재고 미만인 품목을 조회했습니다.',
      table: {
        headers: ['품목코드', '품목명', '현재고', '안전재고'],
        rows: [
          ['MED-0042', '수술용 장갑 (M)', '120', '200'],
          ['MED-0078', '일회용 마스크 (50매)', '80', '300'],
          ['MED-0123', '소독용 알코올 500ml', '45', '100'],
        ]
      },
      summary: '부족 품목 <strong>3건</strong> — 긴급 발주를 권장합니다.',
      actions: ['발주서 작성', '공급처 연락처']
    },
    '주문서 작성': {
      text: '주문서를 작성하겠습니다. 어떤 거래처에 대한 주문인가요?',
      actions: null
    },
    '이번 달 매출/비용 요약': {
      text: '이번 달 경영 요약입니다.',
      table: {
        headers: ['항목', '금액', '전월 대비'],
        rows: [
          ['총 매출', '108,600,000원', '<span class="data-tag tag-success">+12.3%</span>'],
          ['매출원가', '67,400,000원', '<span class="data-tag tag-warning">+8.1%</span>'],
          ['영업이익', '41,200,000원', '<span class="data-tag tag-success">+19.7%</span>'],
          ['미수금', '23,800,000원', '<span class="data-tag tag-danger">+15.2%</span>'],
        ]
      },
      summary: '영업이익률: <strong>37.9%</strong> (전월 35.1%에서 개선)',
      actions: ['월간 보고서 PDF', '상세 분석']
    },
    '내 주문 현황': {
      text: '최근 주문 현황입니다.',
      table: {
        headers: ['주문번호', '주문일', '금액', '상태'],
        rows: [
          ['ORD-2026-0412', '2026-04-12', '5,200,000원', '<span class="data-tag tag-success">배송완료</span>'],
          ['ORD-2026-0408', '2026-04-08', '3,800,000원', '<span class="data-tag tag-warning">배송중</span>'],
          ['ORD-2026-0401', '2026-04-01', '7,100,000원', '<span class="data-tag tag-success">배송완료</span>'],
        ]
      },
      summary: '이번 달 총 주문: <strong>3건 / 16,100,000원</strong>',
      actions: ['거래명세서 출력', '재주문']
    },
    '입고 대기 목록': {
      text: '현재 입고 대기 중인 항목입니다.',
      table: {
        headers: ['PO번호', '공급처', '품목 수', '예정일'],
        rows: [
          ['PO-0089', '베트남 공장', '12품목', '2026-04-18'],
          ['PO-0091', '중국 협력사', '5품목', '2026-04-20'],
          ['PO-0093', '국내 OEM', '3품목', '2026-04-17'],
        ]
      },
      summary: '입고 대기 <strong>3건 / 20품목</strong> — PO-0093이 가장 빠릅니다.',
      actions: ['검수 시작', '입고 일정 변경']
    }
  };

  // ── Default fallback response ──
  const DEFAULT_RESPONSES = [
    '네, 확인하겠습니다. 잠시만요...',
    '해당 내용을 조회하고 있습니다.',
    '죄송합니다, 좀 더 구체적으로 말씀해 주시겠어요? 예: "이번 달 매출 현황" 또는 "미수금 거래처 목록"',
  ];

  // ── WindyFlo branding ──
  // 아이콘 파일: prototype/assets/windyflo-icon.png 에 배치
  const WINDYFLO_ICON = 'assets/windyflo-icon.png';
  const WINDYFLO_FALLBACK = '🌬️';
  const ASSISTANT_NAME = 'WindyFlo Assistant';

  // 이미지 로드 실패 시 이모지 폴백
  function imgOrFallback(size, radius) {
    return `<img src="${WINDYFLO_ICON}" alt="W" style="width:${size};height:${size};border-radius:${radius};" onerror="this.outerHTML='${WINDYFLO_FALLBACK}'">`;
  }

  // ── Detect portal type from URL/body ──
  function detectPortal() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('client')) return 'client'; // client portal: no assistant
    if (path.includes('exec')) return 'exec';
    if (path.includes('admin') || path.includes('ceo')) return 'admin';
    if (path.includes('qc')) return 'qc';
    // fallback: check title
    const title = document.title.toLowerCase();
    if (title.includes('거래처') || title.includes('발주')) return 'client';
    if (title.includes('영업')) return 'exec';
    if (title.includes('경영') || title.includes('ceo') || title.includes('대표')) return 'admin';
    if (title.includes('품질')) return 'qc';
    return 'exec';
  }

  // ── Render HTML ──
  function createAssistantHTML(portal) {
    const config = PORTAL_CONFIG[portal];

    const quickBtns = config.quickActions
      .map(q => `<button class="ai-quick-btn" data-query="${q}">${q}</button>`)
      .join('');

    return `
      <div class="ai-backdrop" id="aiBackdrop"></div>
      <button class="ai-toggle" id="aiToggle" title="${ASSISTANT_NAME}">
        ${imgOrFallback('36px', '50%')}
      </button>
      <div class="ai-panel" id="aiPanel">
        <div class="ai-header">
          <div class="ai-header-icon">
            ${imgOrFallback('24px', '4px')}
          </div>
          <div class="ai-header-text">
            <h3>${ASSISTANT_NAME}</h3>
            <span>RTBIO ERP · ${config.label}</span>
          </div>
          <button class="ai-header-close" id="aiClose">✕</button>
        </div>
        <div class="ai-quick-actions" id="aiQuickActions">${quickBtns}</div>
        <div class="ai-messages" id="aiMessages">
          <div class="ai-msg assistant">
            <div class="ai-msg-avatar">${imgOrFallback('100%', '6px')}</div>
            <div class="ai-msg-body">
              <div class="ai-msg-name">${ASSISTANT_NAME}</div>
              <div class="ai-msg-bubble">${config.greeting}</div>
            </div>
          </div>
        </div>
        <div class="ai-input-area">
          <div class="ai-input-wrapper">
            <textarea class="ai-input" id="aiInput" placeholder="무엇을 도와드릴까요?" rows="1"></textarea>
            <button class="ai-send-btn" id="aiSend">➤</button>
          </div>
          <div class="ai-input-hint">Enter로 전송 · Shift+Enter로 줄바꿈</div>
        </div>
      </div>
    `;
  }

  // ── Build response HTML ──
  function buildResponseHTML(data) {
    let html = `<p>${data.text}</p>`;

    if (data.table) {
      html += '<table>';
      html += '<tr>' + data.table.headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
      data.table.rows.forEach(row => {
        html += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
      });
      html += '</table>';
    }

    if (data.summary) {
      html += `<p style="margin-top:8px; font-size:12px; color:var(--text-secondary);">${data.summary}</p>`;
    }

    if (data.actions) {
      html += '<div class="ai-msg-actions">';
      data.actions.forEach((a, i) => {
        const cls = i === 0 ? 'ai-action-btn primary' : 'ai-action-btn';
        html += `<button class="${cls}">${a}</button>`;
      });
      html += '</div>';
    }

    return html;
  }

  // ── Add message to chat ──
  function addMessage(container, role, content) {
    const avatarHTML = role === 'user'
      ? '👤'
      : imgOrFallback('100%', '6px');
    const name = role === 'user' ? '나' : ASSISTANT_NAME;

    const msg = document.createElement('div');
    msg.className = `ai-msg ${role}`;
    msg.innerHTML = `
      <div class="ai-msg-avatar">${avatarHTML}</div>
      <div class="ai-msg-body">
        <div class="ai-msg-name">${name}</div>
        <div class="ai-msg-bubble">${content}</div>
      </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  // ── Show typing indicator ──
  function showTyping(container) {
    const msg = document.createElement('div');
    msg.className = 'ai-msg assistant';
    msg.id = 'aiTyping';
    msg.innerHTML = `
      <div class="ai-msg-avatar">${imgOrFallback('100%', '6px')}</div>
      <div class="ai-msg-body">
        <div class="ai-msg-name">${ASSISTANT_NAME}</div>
        <div class="ai-msg-bubble">
          <div class="ai-typing">
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('aiTyping');
    if (el) el.remove();
  }

  // ── Process user input ──
  function processInput(query, messagesEl) {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Add user message
    addMessage(messagesEl, 'user', trimmed);

    // Show typing
    showTyping(messagesEl);

    // Simulate response delay
    const delay = 600 + Math.random() * 800;
    setTimeout(() => {
      hideTyping();

      // Find matching response
      const matchKey = Object.keys(MOCK_RESPONSES).find(k =>
        trimmed.includes(k) || k.includes(trimmed)
      );

      if (matchKey) {
        const data = MOCK_RESPONSES[matchKey];
        addMessage(messagesEl, 'assistant', buildResponseHTML(data));
      } else {
        // Default
        const fallback = DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
        addMessage(messagesEl, 'assistant', fallback);
      }
    }, delay);
  }

  // ── Auto-resize textarea ──
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // ── Initialize ──
  function init() {
    const portal = detectPortal();

    // 거래처 발주 포털에서는 어시스턴트 비활성화
    if (portal === 'client') return;

    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.id = 'aiAssistantRoot';
    wrapper.innerHTML = createAssistantHTML(portal);
    document.body.appendChild(wrapper);

    // Elements
    const toggle = document.getElementById('aiToggle');
    const panel = document.getElementById('aiPanel');
    const closeBtn = document.getElementById('aiClose');
    const backdrop = document.getElementById('aiBackdrop');
    const messages = document.getElementById('aiMessages');
    const input = document.getElementById('aiInput');
    const sendBtn = document.getElementById('aiSend');
    const quickActions = document.getElementById('aiQuickActions');
    const mainContent = document.querySelector('.main-content');

    let isOpen = false;

    function openPanel() {
      isOpen = true;
      panel.classList.add('open');
      toggle.classList.add('active');
      toggle.classList.add('active');
      if (window.innerWidth <= 1200) {
        backdrop.classList.add('visible');
      }
      if (mainContent && window.innerWidth > 1200) {
        mainContent.classList.add('ai-shifted');
      }
      setTimeout(() => input.focus(), 350);
    }

    function closePanel() {
      isOpen = false;
      panel.classList.remove('open');
      toggle.classList.remove('active');
      backdrop.classList.remove('visible');
      if (mainContent) {
        mainContent.classList.remove('ai-shifted');
      }
    }

    // Toggle
    toggle.addEventListener('click', () => isOpen ? closePanel() : openPanel());
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);

    // Send message
    function send() {
      const query = input.value.trim();
      if (!query) return;
      processInput(query, messages);
      input.value = '';
      input.style.height = 'auto';
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    input.addEventListener('input', () => autoResize(input));

    // Quick actions
    quickActions.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-quick-btn');
      if (!btn) return;
      const query = btn.dataset.query;
      input.value = query;
      send();
    });

    // Action buttons inside chat
    messages.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-action-btn');
      if (!btn) {
        return;
      }
      const action = btn.textContent;
      addMessage(messages, 'user', action);
      showTyping(messages);
      setTimeout(() => {
        hideTyping();
        addMessage(messages, 'assistant',
          `<p>"${action}" 기능을 실행합니다. 잠시 후 결과가 나타납니다.</p>
           <p style="margin-top:6px;font-size:12px;color:var(--text-muted);">(프로토타입 — 실제 구현 시 해당 기능 연동)</p>`
        );
      }, 800);
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
