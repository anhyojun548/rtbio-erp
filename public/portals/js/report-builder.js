/**
 * ReportBuilder — 알티바이오 품질양식 작성기
 *
 * 흐름:
 *   1. 양식 선택 → renderForm(formId) 가 우측 미리보기 영역에 입력 폼 그림
 *   2. 사용자가 직접 입력 OR AI 채팅으로 자동 채움
 *   3. AI 호출 시 callExternalAi() — 외부 API contract 따름
 *   4. 응답 JSON 의 fields 를 폼에 적용 (사용자가 채운 값은 보존)
 *   5. 사용자 검토 + 수정 → "PDF 출력"또는 "인쇄"
 *
 * 외부 AI 엔드포인트:
 *   설정에서 AI_FILL_ENDPOINT 변수로 정의. 비어있으면 mock 응답 사용.
 */

// ────────────────────────────────────────────────
// 외부 AI 엔드포인트 (사용자가 외부에서 만든 어시스턴트와 연결)
// ────────────────────────────────────────────────
const AI_FILL_ENDPOINT = '';  // 예: 'https://your-ai.example.com/api/fill'
const AI_FILL_TIMEOUT = 30000;

// ────────────────────────────────────────────────
// 상태
// ────────────────────────────────────────────────
const _rbState = {
  currentFormId: null,
  formData: {},          // { fieldId: value } — 단건형
  rowData: [],           // [{...}] — 대장형
  conversation: [],      // [{ role, content, fields? }]
  reports: [],           // 저장된 보고서 목록 (mock)
  team: 'admin',         // 현재 포털 ('admin','sales','qc','ceo')
  user: { name: '사용자', role: '담당자'},
};

// ────────────────────────────────────────────────
// 초기화 (각 포털에서 호출)
// ────────────────────────────────────────────────
function initReportBuilder({ team, userName, userRole }) {
  _rbState.team = team || 'admin';
  _rbState.user = { name: userName || '담당자', role: userRole || team };

  // 양식 select 채우기
  const sel = document.getElementById('rb-form-select');
  if (!sel) return;
  const forms = (typeof listFormsForTeam === 'function') ? listFormsForTeam(_rbState.team) : [];
  sel.innerHTML = '<option value="">— 양식을 선택하세요 —</option>'+
    forms.map(f => `<option value="${f.id}">[${f.code}] ${f.title}</option>`).join('');
  sel.addEventListener('change', () => onSelectForm(sel.value));

  // 첫 번째 양식 자동 선택
  if (forms.length > 0) {
    sel.value = forms[0].id;
    onSelectForm(forms[0].id);
  }

  // AI 입력 핸들러
  const input = document.getElementById('rb-ai-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'&& !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
      }
    });
  }
}

// ────────────────────────────────────────────────
// 양식 선택 → 본문 렌더
// ────────────────────────────────────────────────
function onSelectForm(formId) {
  if (!formId) {
    document.getElementById('rb-form-body').innerHTML = '<div style="text-align:center;padding:60px;color:#999;">양식을 선택하면 미리보기가 나타납니다.</div>';
    return;
  }
  _rbState.currentFormId = formId;
  _rbState.formData = {};
  _rbState.rowData = [{}];  // 대장형은 1행으로 시작
  _rbState.conversation = [];
  renderForm();
  resetAiPanel();
}

function renderForm() {
  const tpl = getFormTemplate(_rbState.currentFormId);
  if (!tpl) return;
  const html = renderFormHTML(tpl);
  document.getElementById('rb-form-body').innerHTML = html;
  attachInputListeners();
  updateStatus();
}

function renderFormHTML(tpl) {
  let html = `<div class="rb-doc rb-print-target"id="rb-doc">`;
  html += `<div class="rb-doc-code">${tpl.code} (Rev.0)  ·  주식회사 알티바이오</div>`;
  html += `<div class="rb-doc-title">${tpl.title}</div>`;

  // 헤더 필드 (key-value 표 형태)
  if (tpl.headerFields && tpl.headerFields.length > 0) {
    html += `<table class="rb-doc-table">`;
    for (let i = 0; i < tpl.headerFields.length; i += 2) {
      html += `<tr>`;
      html += renderHeaderCell(tpl.headerFields[i]);
      if (tpl.headerFields[i + 1]) html += renderHeaderCell(tpl.headerFields[i + 1]);
      else html += `<th></th><td></td>`;
      html += `</tr>`;
    }
    html += `</table>`;
  }

  // 단건 본문 필드
  if (tpl.bodyFields) {
    html += `<div class="rb-section-title">${tpl.type === 'single'? '본문': '상세'}</div>`;
    html += `<table class="rb-doc-table">`;
    tpl.bodyFields.forEach(f => {
      html += `<tr>${renderHeaderCell(f, true)}</tr>`;
    });
    html += `</table>`;
  }

  // 섹션 (F807-1 의료기기이상사례)
  if (tpl.sections) {
    tpl.sections.forEach(sec => {
      html += `<div class="rb-section-title">${sec.name}</div>`;
      html += `<table class="rb-doc-table">`;
      for (let i = 0; i < sec.fields.length; i += 2) {
        html += `<tr>`;
        html += renderHeaderCell(sec.fields[i]);
        if (sec.fields[i + 1]) html += renderHeaderCell(sec.fields[i + 1]);
        else html += `<th></th><td colspan="3"></td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    });
  }

  // 카테고리 체크리스트 (F703-2)
  if (tpl.categories) {
    html += `<table class="rb-doc-grid-table">`;
    html += `<thead><tr><th style="width:50%;">평가 항목</th><th style="width:120px;">평가 (A/B/C/D)</th></tr></thead><tbody>`;
    tpl.categories.forEach(cat => {
      html += `<tr><td colspan="2"style="background:#e0e7ff;font-weight:700;padding:6px;">${cat.name}</td></tr>`;
      cat.items.forEach(item => {
        const v = _rbState.formData[item.id] || '';
        const filled = v ? 'rb-cell-filled': '';
        html += `<tr>
          <td>${item.label}</td>
          <td>
            <select class="rb-cell-input ${filled}"data-field="${item.id}">
              <option value="">—</option>
              <option value="A"${v==='A'?'selected':''}>A 매우 우수</option>
              <option value="B"${v==='B'?'selected':''}>B 우수</option>
              <option value="C"${v==='C'?'selected':''}>C 보통</option>
              <option value="D"${v==='D'?'selected':''}>D 미흡</option>
            </select>
          </td>
        </tr>`;
      });
    });
    html += `</tbody></table>`;
  }

  // 행 필드 (대장형 또는 단건+행 혼합)
  if (tpl.rowFields) {
    const isRegister = tpl.type === 'register'|| tpl.type === 'single-with-rows'|| tpl.type === 'single';
    html += `<div class="rb-section-title">${tpl.type === 'register'? '대장 항목': '품목/항목 리스트'}</div>`;
    html += `<table class="rb-doc-grid-table"><thead><tr>`;
    tpl.rowFields.forEach(f => html += `<th>${f.label}${f.required ? '*': ''}</th>`);
    html += `<th style="width:32px;"></th></tr></thead><tbody id="rb-rows-tbody">`;
    _rbState.rowData.forEach((row, idx) => {
      html += renderRowHTML(tpl.rowFields, row, idx);
    });
    html += `</tbody></table>`;
    html += `<button class="add-row-btn"onclick="addReportRow()">+ 행 추가</button>`;
  }

  // 푸터 필드
  if (tpl.footerFields) {
    html += `<div class="rb-section-title">합계 / 종합</div>`;
    html += `<table class="rb-doc-table">`;
    tpl.footerFields.forEach(f => html += `<tr>${renderHeaderCell(f)}</tr>`);
    html += `</table>`;
  }

  html += `<div class="rb-doc-footer">${tpl.code}  ·  주식회사 알티바이오  ·  ${new Date().toLocaleDateString('ko-KR')}</div>`;
  html += `</div>`;
  return html;
}

function renderHeaderCell(f, fullRow = false) {
  const v = _rbState.formData[f.id] || '';
  const filledClass = v ? 'rb-cell-filled': '';
  const requiredClass = (f.required && !v) ? 'rb-cell-required-empty': '';
  const cls = `rb-cell-input ${filledClass} ${requiredClass}`;
  let cell = '';
  if (f.type === 'textarea') {
    cell = `<textarea class="${cls}"data-field="${f.id}">${escapeHtml(v)}</textarea>`;
  } else if (f.type === 'select') {
    cell = `<select class="${cls}"data-field="${f.id}">
      <option value="">선택</option>
      ${(f.options || []).map(o => `<option value="${o}"${o===v?'selected':''}>${o}</option>`).join('')}
    </select>`;
  } else if (f.type === 'multiselect') {
    const vArr = Array.isArray(v) ? v : (v ? [v] : []);
    cell = (f.options || []).map(o =>
      `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;font-size:11px;">
        <input type="checkbox"data-field="${f.id}"data-multi="1"value="${o}"${vArr.includes(o)?'checked':''}> ${o}
      </label>`).join('');
  } else if (f.type === 'checkbox') {
    cell = `<input type="checkbox"data-field="${f.id}"${v?'checked':''}>`;
  } else {
    cell = `<input type="${f.type === 'number'? 'number': f.type === 'date'? 'date': f.type === 'tel'? 'tel': f.type === 'email'? 'email': 'text'}"class="${cls}"data-field="${f.id}"value="${escapeHtml(v)}">`;
  }
  if (fullRow) return `<th>${f.label}${f.required ? '*': ''}</th><td colspan="3">${cell}</td>`;
  return `<th>${f.label}${f.required ? '*': ''}</th><td>${cell}</td>`;
}

function renderRowHTML(rowFields, row, idx) {
  let html = `<tr data-row-idx="${idx}">`;
  rowFields.forEach(f => {
    const v = (row && row[f.id]) || '';
    const filled = v ? 'rb-cell-filled': '';
    if (f.type === 'select') {
      html += `<td><select class="${filled}"data-row-field="${f.id}"data-row-idx="${idx}">
        <option value="">—</option>
        ${(f.options || []).map(o => `<option value="${o}"${o===v?'selected':''}>${o}</option>`).join('')}
      </select></td>`;
    } else if (f.type === 'multiselect') {
      const vArr = Array.isArray(v) ? v : (v ? [v] : []);
      html += `<td>${(f.options || []).map(o => `
        <label style="display:inline-flex;align-items:center;gap:2px;margin-right:4px;font-size:10px;">
          <input type="checkbox"data-row-field="${f.id}"data-row-idx="${idx}"data-multi="1"value="${o}"${vArr.includes(o)?'checked':''}> ${o}
        </label>`).join('')}</td>`;
    } else if (f.type === 'textarea') {
      html += `<td><textarea class="${filled}"data-row-field="${f.id}"data-row-idx="${idx}"rows="2">${escapeHtml(v)}</textarea></td>`;
    } else {
      const it = f.type === 'number'? 'number': f.type === 'date'? 'date': 'text';
      html += `<td><input type="${it}"class="${filled}"data-row-field="${f.id}"data-row-idx="${idx}"value="${escapeHtml(v)}"></td>`;
    }
  });
  html += `<td><button onclick="removeReportRow(${idx})"style="border:0;background:transparent;color:var(--danger);cursor:pointer;font-size:14px;"title="행 삭제">✕</button></td>`;
  html += `</tr>`;
  return html;
}

function addReportRow() {
  _rbState.rowData.push({});
  renderForm();
}

function removeReportRow(idx) {
  if (_rbState.rowData.length <= 1) {
    _rbState.rowData = [{}];
  } else {
    _rbState.rowData.splice(idx, 1);
  }
  renderForm();
}

function attachInputListeners() {
  document.querySelectorAll('#rb-doc input, #rb-doc select, #rb-doc textarea').forEach(el => {
    el.addEventListener('input', onFieldChange);
    el.addEventListener('change', onFieldChange);
  });
}

function onFieldChange(e) {
  const el = e.target;
  const rowIdx = el.dataset.rowIdx !== undefined ? parseInt(el.dataset.rowIdx, 10) : null;
  const field = el.dataset.rowField || el.dataset.field;
  if (!field) return;
  let value;
  if (el.type === 'checkbox') {
    if (el.dataset.multi) {
      // multiselect: 같은 field 의 모든 체크박스 모음
      const target = rowIdx !== null
        ? document.querySelectorAll(`[data-row-field="${field}"][data-row-idx="${rowIdx}"][data-multi="1"]`)
        : document.querySelectorAll(`[data-field="${field}"][data-multi="1"]`);
      value = Array.from(target).filter(c => c.checked).map(c => c.value);
    } else {
      value = el.checked;
    }
  } else {
    value = el.value;
  }
  if (rowIdx !== null) {
    if (!_rbState.rowData[rowIdx]) _rbState.rowData[rowIdx] = {};
    _rbState.rowData[rowIdx][field] = value;
  } else {
    _rbState.formData[field] = value;
  }
  // 시각적 hint 갱신
  if (value && el.classList) el.classList.add('rb-cell-filled');
  else if (el.classList) el.classList.remove('rb-cell-filled');
  updateStatus();
}

function updateStatus() {
  const tpl = getFormTemplate(_rbState.currentFormId);
  if (!tpl) return;
  const fields = flattenFormFields(tpl);
  const required = fields.filter(f => f.required);
  // 단건 + 첫 행 기준
  const firstRow = _rbState.rowData[0] || {};
  const filled = required.filter(f => {
    const v = f.isRow ? firstRow[f.id] : _rbState.formData[f.id];
    return v !== undefined && v !== ''&& v !== null;
  }).length;
  const total = required.length;
  const statusEl = document.getElementById('rb-status');
  if (statusEl) {
    statusEl.innerHTML = total > 0
      ? `<span style="color:${filled===total?'var(--success)':'var(--warning)'};font-weight:600;">●</span> 필수 ${filled}/${total}`
      : '';
  }
}

// ────────────────────────────────────────────────
// AI 패널
// ────────────────────────────────────────────────
function resetAiPanel() {
  _rbState.conversation = [];
  const messagesEl = document.getElementById('rb-ai-messages');
  const tpl = getFormTemplate(_rbState.currentFormId);
  if (!messagesEl || !tpl) return;
  messagesEl.innerHTML = `
    <div class="rb-msg rb-msg-system">
       ${tpl.title} 작성을 시작합니다.
    </div>
    <div class="rb-msg rb-msg-ai">
      안녕하세요. ${tpl.title} 양식 작성 도와드릴게요.
      예: "${getExamplePrompt(tpl.id)}"처럼 자연어로 말씀해주세요.
    </div>
  `;
  // 추천 프롬프트
  const sugEl = document.getElementById('rb-ai-suggestions');
  if (sugEl) sugEl.innerHTML = (getSuggestions(tpl.id) || [])
    .map(s => `<button class="rb-ai-suggestion"onclick="quickPrompt('${escapeJs(s)}')">${s}</button>`).join('');
}

function getExamplePrompt(formId) {
  return ({
    'F701-1': '메디팜 의료기에서 리코탭플러스 무릎 숏 50개 주문',
    'F703-4': '한빛정형외과로 발주서 작성',
    'F703-2': '메디텍코리아 평가표 작성',
    'F801-1': '대한메디칼 포장 불량 클레임',
    'F803-2': '리코탭플러스 무릎 숏 M 50개 출고 검사 합격',
    'F804-1': '리코탭플러스 손목 L 입고 검사 시 5개 불량',
    'F807-1': '리코탭플러스 무릎 보조기 사용 중 환자 피부 발진',
    'F501-1': '4월 경영검토 회의록 작성',
  })[formId] || '필요한 내용을 자유롭게 입력하세요';
}

function getSuggestions(formId) {
  return ({
    'F701-1': ['메디팜 5건 주문 일괄 입력', '오늘 접수된 신규 주문 3건', '한빛정형외과 반복 주문'],
    'F703-4': ['주재료 발주서 작성', '한빛 발주 + 납기 4/15', '긴급 발주 - 무릎 보조기'],
    'F801-1': ['포장 불량 건', '제품 손상 클레임', '배송 지연 항의'],
    'F803-2': ['오늘 검사 합격 일괄', '불량 발견 - 재검사 필요'],
    'F804-1': ['입고 시 불량 5개', '공정 중 부적합 - 폐기', '고객 반품 부적합'],
    'F807-1': ['피부 발진 환자 사례', '제품 파손 - 부상 없음', '식약처 최초 보고'],
    'F501-1': ['이번 달 경영검토', '분기 회의 결정사항'],
  })[formId] || [];
}

function quickPrompt(s) {
  document.getElementById('rb-ai-input').value = s;
  sendAiMessage();
}

async function sendAiMessage() {
  const input = document.getElementById('rb-ai-input');
  const msg = (input?.value || '').trim();
  if (!msg) return;
  input.value = '';
  _rbState.conversation.push({ role: 'user', content: msg });
  appendMessage('user', msg);

  // thinking indicator
  const thinkingEl = appendMessage('ai', '', true);

  try {
    const response = await callExternalAi(msg);
    thinkingEl?.remove();

    // 필드 적용 (사용자가 채운 값 보존)
    const filledCount = applyAiFields(response.fields || {});
    const filledRowCount = applyAiRows(response.rows || []);

    // AI 메시지 표시
    let bodyHtml = escapeHtml(response.assistantMessage || '');
    if (filledCount > 0 || filledRowCount > 0) {
      bodyHtml += `<div class="rb-msg-fields">✅ <b>${filledCount + filledRowCount}개</b> 필드 자동 채움</div>`;
    }
    if (response.needsMoreInput && response.nextHint) {
      bodyHtml += `<div class="rb-msg-fields"> 추가 입력 필요: ${escapeHtml(response.nextHint)}</div>`;
    }
    appendMessage('ai', bodyHtml, false, true);

    _rbState.conversation.push({ role: 'assistant', content: response.assistantMessage || ''});
    renderForm();  // 채워진 값으로 다시 렌더
  } catch (err) {
    thinkingEl?.remove();
    appendMessage('ai', `❌ AI 호출 실패: ${escapeHtml(err.message || String(err))}`, false, true);
  }
}

function appendMessage(role, content, thinking = false, isHtml = false) {
  const messagesEl = document.getElementById('rb-ai-messages');
  if (!messagesEl) return null;
  const div = document.createElement('div');
  div.className = `rb-msg rb-msg-${role}${thinking ? 'rb-msg-thinking': ''}`;
  if (isHtml) div.innerHTML = content;
  else div.textContent = thinking ? '생각 중': content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function applyAiFields(fields) {
  let count = 0;
  Object.entries(fields).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    // 사용자가 이미 채운 필드는 덮어쓰지 않음
    const existing = _rbState.formData[key];
    if (existing !== undefined && existing !== ''&& existing !== null) return;
    _rbState.formData[key] = value;
    count++;
  });
  return count;
}

function applyAiRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let count = 0;
  rows.forEach((aiRow, idx) => {
    if (!_rbState.rowData[idx]) _rbState.rowData[idx] = {};
    Object.entries(aiRow).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      const existing = _rbState.rowData[idx][key];
      if (existing !== undefined && existing !== ''&& existing !== null) return;
      _rbState.rowData[idx][key] = value;
      count++;
    });
  });
  return count;
}

// ────────────────────────────────────────────────
// 외부 AI 호출 (실 API + mock fallback)
// ────────────────────────────────────────────────
async function callExternalAi(userMessage) {
  const tpl = getFormTemplate(_rbState.currentFormId);
  const payload = {
    formId: tpl.id,
    formCode: tpl.code,
    formTitle: tpl.title,
    formSchema: {
      title: tpl.title,
      type: tpl.type,
      fields: flattenFormFields(tpl),
    },
    conversation: _rbState.conversation,
    context: {
      userName: _rbState.user.name,
      userRole: _rbState.user.role,
      tenantId: 'altibio',
      now: new Date().toISOString(),
      currentFormData: _rbState.formData,
      currentRowData: _rbState.rowData,
    },
  };

  if (AI_FILL_ENDPOINT) {
    // 실 API 호출
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_FILL_TIMEOUT);
    try {
      const res = await fetch(AI_FILL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // Mock 응답 (프로토타입 시연용)
  await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
  return mockAiResponse(payload, userMessage);
}

function mockAiResponse(payload, userMessage) {
  const formId = payload.formId;
  const today = new Date().toISOString().slice(0, 10);
  const msg = userMessage.toLowerCase();

  // 거래처 매칭
  let matchedClient = null;
  if (typeof CLIENTS !== 'undefined') {
    matchedClient = CLIENTS.find(c =>
      msg.includes(c.name.toLowerCase()) ||
      (c.id && msg.includes(c.id.toLowerCase()))
    );
  }
  // 제품 매칭
  let matchedProduct = null;
  if (typeof PRODUCTS !== 'undefined') {
    matchedProduct = PRODUCTS.find(p => msg.includes(p.name.toLowerCase()));
  }
  // 수량 추출 (예: "50개")
  const qtyMatch = userMessage.match(/(\d+)\s*개/);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  // 사이즈 추출
  const sizeMatch = userMessage.match(/\b(S|M|L|XL|FREE)\b/i);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : null;

  if (formId === 'F701-1') {
    return {
      ok: true,
      fields: {},
      rows: [{
        receiptDate: today,
        category: '신규',
        customerName: matchedClient?.name || '메디팜 의료기',
        phone: matchedClient?.phone || '010-1234-5678',
        productName: matchedProduct?.name || '리코탭플러스 무릎 숏',
        spec: size || 'M',
        qty: qty || 10,
        deliveryDate: '',
        receiptType: ['유무선'],
        requirementType: ['일반 주문접수'],
        receiver: payload.context.userName,
        reviewer: '',
        shippedDate: '',
        note: userMessage,
      }],
      assistantMessage: `${matchedClient?.name || '거래처'}의 ${matchedProduct?.name || '제품'} ${qty || 10}개 주문을 1행 추가했습니다. 검토자와 납품일자는 결정 후 입력해주세요.`,
      needsMoreInput: true,
      nextHint: '검토자, 납품일자',
    };
  }

  if (formId === 'F801-1') {
    return {
      ok: true,
      fields: {},
      rows: [{
        receiptNo: `${today.slice(2,7).replace('-','')}-${String(Math.floor(Math.random()*900)+100)}`,
        receiptDate: today,
        customerName: matchedClient?.name || '대한메디칼',
        phone: matchedClient?.phone || '',
        complaint: userMessage,
        receiver: payload.context.userName,
        processDate: '',
        processContent: '',
      }],
      assistantMessage: `${matchedClient?.name || '거래처'}의 클레임 1건 접수했습니다. 처리 결과가 결정되면 처리일·처리내용을 추가로 입력해주세요.`,
      needsMoreInput: true,
      nextHint: '처리일, 처리내용',
    };
  }

  if (formId === 'F803-2') {
    return {
      ok: true,
      fields: {
        productName: matchedProduct?.name || '리코탭플러스 무릎 숏',
        inspector: payload.context.userName,
        approver: '',
        qty: qty || 10,
        inspectDate: today,
        lotNumber: `LOT-${today.replace(/-/g,'')}-001`,
        testMethod: '전수검사',
        finalJudgment: msg.includes('합격') ? '합격': (msg.includes('불합격') ? '불합격': ''),
        specialNote: '',
      },
      rows: [
        { no: 1, testItem: '외관검사', testStandard: '균열·이물질 없음', testResult: '이상 없음', judgment: '합격'},
        { no: 2, testItem: '치수검사', testStandard: '도면 ±0.5mm', testResult: '범위 내',   judgment: '합격'},
        { no: 3, testItem: '강도시험', testStandard: 'KS 규격',       testResult: '통과',     judgment: '합격'},
      ],
      assistantMessage: `최종검사 양식을 ${matchedProduct?.name || '제품'} ${qty || 10}개 기준으로 채웠습니다. 외관/치수/강도 3개 시험 항목 자동 입력 — 실제 결과로 수정 필요한 항목 있으면 알려주세요.`,
      needsMoreInput: false,
    };
  }

  if (formId === 'F804-1') {
    return {
      ok: true,
      fields: {
        reportNo: `NCR-${today.replace(/-/g,'')}-001`,
        occurDate: today,
        productName: matchedProduct?.name || '리코탭플러스 무릎 숏',
        department: '품질관리팀',
        qty: qty || 5,
        discoverer: payload.context.userName,
        occurType: msg.includes('입고') ? '인수': msg.includes('고객') ? '고객': msg.includes('공정') ? '공정/중간': '최종/제품',
        creator: payload.context.userName,
        description: userMessage,
        cause: '',
        treatmentPlan: msg.includes('폐기') ? '폐기(REPEAL)': msg.includes('수리') ? '수리(REPAIR)': '특채(CONCESSION)',
        treatmentDetail: '',
        attachment: '무',
        resultCheck: '',
        correctiveAction: '예',
      },
      assistantMessage: `부적합품 보고서를 작성했습니다. 원인분석과 처리 결과 확인은 추가로 입력해주세요.`,
      needsMoreInput: true,
      nextHint: '원인, 처리결과 확인',
    };
  }

  if (formId === 'F807-1') {
    return {
      ok: true,
      fields: {
        reportType: '최초보고',
        reportDate: today,
        reporterType: '의료기기제조업자',
        organization: '주식회사 알티바이오',
        reporterName: payload.context.userName,
        phone: '02-1234-5678',
        email: 'qc@rtbio.com',
        duplicate: '무',
        productName: matchedProduct?.name || '리코탭플러스 무릎 보조기',
        itemName: '의료용 보조기',
        modelName: matchedProduct?.sku || 'RTP-KN-S01',
        classCode: 'A12345',
        grade: '2',
        licenseNo: '제xxx호',
        lotNumber: `LOT-${today.replace(/-/g,'')}-001`,
        manufacturer: '주식회사 알티바이오',
        awareDate: today,
        occurDate: today,
        severity: msg.includes('심각') ? '심각(Severe)': msg.includes('경미') ? '경미(Mild)': '중증(Moderate)',
        detail: userMessage,
      },
      assistantMessage: `의료기기 이상사례 보고서 초안을 작성했습니다. 식약처 신고 전 환자 정보(성명·생년월일)와 제품 허가번호 확인이 필요합니다.`,
      needsMoreInput: true,
      nextHint: '환자 성명, 생년월일, 정확한 허가번호',
    };
  }

  if (formId === 'F703-4') {
    return {
      ok: true,
      fields: {
        companyName: matchedClient?.name || '메디텍코리아',
        address: matchedClient?.address || '서울시 강남구 테헤란로 ...',
        phone: matchedClient?.phone || '02-1234-5678',
        orderDate: today,
        deliveryDate: '',
        supplyAmount: qty ? qty * 20000 : 200000,
        vat: qty ? qty * 2000 : 20000,
        totalAmount: qty ? qty * 22000 : 220000,
      },
      rows: [{
        no: 1,
        modelName: matchedProduct?.sku || 'RTP-KN-S01',
        productName: matchedProduct?.name || '리코탭플러스 무릎 숏',
        spec: size || 'M',
        qty: qty || 10,
        deliveryDate: '',
        specialReq: '',
        lotNumber: '',
        mfgDate: '',
      }],
      assistantMessage: `발주서를 작성했습니다. 납기일자와 제조번호는 공급사 확인 후 입력해주세요.`,
      needsMoreInput: true,
      nextHint: '납기일자, 제조번호, 제조일자',
    };
  }

  if (formId === 'F703-2') {
    // 평가 항목 자동 채움 (모두 B 우수로 시작 — 사용자가 수정)
    const tpl = getFormTemplate('F703-2');
    const evals = {};
    tpl.categories.forEach(cat => {
      cat.items.forEach(item => { evals[item.id] = 'B'; });
    });
    return {
      ok: true,
      fields: {
        companyName: matchedClient?.name || '메디텍코리아',
        evalDate: today,
        evaluator: payload.context.userName,
        approver: '',
        ...evals,
        totalScore: 76,
        finalGrade: 'B',
        opinion: '전반적으로 우수. 자재 품질 안정적, 납기 준수.',
      },
      assistantMessage: `평가표 19개 항목을 모두 'B 우수'로 초기 입력했습니다. 실제 평가 결과로 각 항목 수정해주세요. 평가의견도 검토 부탁드립니다.`,
      needsMoreInput: true,
      nextHint: '실제 평가 결과로 항목 수정',
    };
  }

  if (formId === 'F501-1') {
    return {
      ok: true,
      fields: {
        meetingDate: today,
        location: '본사 회의실',
        attendees: '대표이사, 경영지원팀장, 영업팀장, 품질관리팀장',
        chairperson: '대표이사',
        agenda: '1. QMS 운영 현황\n2. 고객 만족도 분석\n3. 시정조치 진행 상황\n4. 자원 필요사항',
        qmsReview: '내부감사 결과 부적합 0건. 시정조치 진행 중.',
        customerSatisfaction: '평균 만족도 92점 (전월 대비 +3점)',
        auditResult: '내부 품질감사 통과',
        capa: '진행 중 1건 (부적합품 처리 절차 개선)',
        resourceNeeds: '품질관리팀 인력 1명 충원 검토',
        decisions: '1. 부적합품 처리 절차 개정 승인\n2. 차기 내부감사 일정 6월 둘째주 확정',
      },
      assistantMessage: `경영검토 회의록 초안을 작성했습니다. 안건/결정사항을 실제 회의 내용으로 수정해주세요.`,
      needsMoreInput: false,
    };
  }

  return {
    ok: true,
    fields: {},
    rows: [],
    assistantMessage: '죄송합니다. 양식에 맞는 응답을 생성하지 못했습니다. 더 구체적으로 말씀해주세요.',
    needsMoreInput: true,
  };
}

// ────────────────────────────────────────────────
// 액션: 임시저장 / PDF / 인쇄
// ────────────────────────────────────────────────
function rbSaveDraft() {
  if (!_rbState.currentFormId) return;
  _rbState.reports.push({
    id: 'R-'+ Date.now(),
    formId: _rbState.currentFormId,
    formData: { ..._rbState.formData },
    rowData: JSON.parse(JSON.stringify(_rbState.rowData)),
    savedAt: new Date().toISOString(),
    user: _rbState.user.name,
  });
  if (typeof showToast === 'function') showToast('보고서가 임시저장되었습니다', 'success');
}

function rbPrint() {
  // 인쇄용 CSS 가 .rb-print-target 만 보이게 처리
  window.print();
}

function rbExportPdf() {
  // 프로토타입에서는 window.print() 로 대체. 실제는 @react-pdf 또는 jsPDF.
  rbPrint();
  if (typeof showToast === 'function') showToast('인쇄 대화상자에서 "PDF 로 저장"을 선택하세요', 'info');
}

// ────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}
function escapeJs(s) { return String(s).replace(/'/g, "\\'"); }
