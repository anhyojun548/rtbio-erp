/**
 * RTBIO Prototype — 거래처 관리 (Client Management)
 * 3개 포털 공통 (경영지원 / 영업 / 품질관리)
 *
 * - 의존성: data.js (CLIENTS, PRODUCTS, ORDERS, RECEIVABLES, MASTER_PRICES, SALES_REPS, CLIENT_REP_MAP, customClientTypes)
 * - 의존성: shared.js (showModal, showToast, formatCurrency, getClient, getProductName, calcOrderTotal)
 *
 * 사용:
 *   1. HTML 에 페이지 컨테이너 추가: <div id="page-clients"></div> (또는 buildClientMgmtPageHTML() 사용)
 *   2. <script src="js/client-mgmt.js"></script> 로드
 *   3. 페이지 진입 시 renderClients('') 호출
 */

// ── 페이지 HTML 빌더 (3개 포털이 동일하게 사용) ────────────────────
function buildClientMgmtPageHTML() {
  return `
    <div class="page-inner">
      <div class="main-header">
        <div>
          <div class="main-title">거래처관리</div>
          <div class="main-subtitle">거래처 정보 조회 및 관리</div>
        </div>
      </div>
      <div class="search-bar" style="flex-wrap:wrap;gap:8px;">
        <input type="text" class="form-input" id="client-search"
          placeholder="거래처명 검색..." oninput="filterClients(this.value)">
        <select class="form-select" id="client-type-filter" onchange="filterClients(document.getElementById('client-search').value)" style="max-width:140px;">
          <option value="all">전체 유형</option>
          <option value="대리점">대리점</option>
          <option value="병원">병원</option>
          <option value="기타">기타</option>
        </select>
        <!-- 거래처 유형은 enum(HOSPITAL/AGENCY/OTHER) 고정 — 자유 추가 비활성 (2026-05) -->
        <!-- <button class="btn btn-outline btn-sm" onclick="showAddClientTypeForm()">+ 유형 추가</button> -->
        <button class="btn btn-primary" onclick="showNewClientForm()">+ 신규 거래처 등록</button>
      </div>
      <div class="text-sm text-muted mb-16" id="clients-summary"></div>
      <div class="client-cards-grid" id="clients-grid"></div>
    </div>
  `;
}

// ── 거래처 리스트 렌더 ──────────────────────────────────────────────
function renderClients(searchTerm) {
  const _CLIENTS = window.CLIENTS || [];
  const _customClientTypes = window.customClientTypes || [];
  const typeFilter = document.getElementById('client-type-filter')?.value || 'all';
  let filtered = _CLIENTS;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = _CLIENTS.filter(c => c.name.toLowerCase().includes(term));
  }
  if (typeFilter !== 'all') {
    filtered = filtered.filter(c => c.type === typeFilter);
  }

  const typeCounts = {};
  filtered.forEach(c => { typeCounts[c.type] = (typeCounts[c.type] || 0) + 1; });
  const summaryParts = [`총 거래처 <strong>${filtered.length}개</strong>`];
  for (const t of _customClientTypes) {
    if (typeCounts[t]) summaryParts.push(`${t} <strong>${typeCounts[t]}개</strong>`);
  }
  const sumEl = document.getElementById('clients-summary');
  if (sumEl) sumEl.innerHTML = summaryParts.join(' | ');

  const grid = document.getElementById('clients-grid');
  if (!grid) return;
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-state-icon"></div>
      <div class="empty-state-text">검색 결과가 없습니다.</div>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => {
    const typeBadge = c.type === '대리점'
      ? '<span class="badge badge-type-dealer">대리점</span>'
      : c.type === '병원'
      ? '<span class="badge badge-type-hospital">병원</span>'
      : `<span class="badge" style="background:var(--purple-light);color:var(--purple);">${c.type}</span>`;
    const repName = (window.SALES_REPS || []).find(r => r.id === (window.CLIENT_REP_MAP || {})[c.id])?.name || '-';
    const fixedPriceHTML = Object.keys(c.fixedPrices).length > 0
      ? Object.entries(c.fixedPrices).map(([pid, price]) =>
        `${getProductName(pid)}: ${formatCurrency(price)}`
      ).join(', ')
      : '없음';
    return `
      <div class="client-card">
        <div class="client-card-header">
          <span class="name">${c.name}</span>
          ${typeBadge}
        </div>
        <div class="client-card-row"><span class="label">담당자</span><span>${c.manager}</span></div>
        <div class="client-card-row"><span class="label">영업담당</span><span>${repName}</span></div>
        <div class="client-card-row"><span class="label">연락처</span><span>${c.phone}</span></div>
        <div class="client-card-row"><span class="label">이메일</span><span>${c.email}</span></div>
        <div class="client-card-row"><span class="label">주소</span><span>${c.address}</span></div>
        <div class="client-card-row"><span class="label">결제방식</span><span>${c.paymentType}</span></div>
        <div class="client-card-row"><span class="label">마감기간</span><span>${c.closingPeriod}</span></div>
        <div class="client-card-row"><span class="label">명세서</span><span>${c.invoiceType}</span></div>
        <div class="discount-tags">
          <span class="discount-tag">무릎 ${c.discounts.knee}%</span>
          <span class="discount-tag">상지 ${c.discounts.upper}%</span>
          <span class="discount-tag">하지 ${c.discounts.lower}%</span>
          <span class="discount-tag">스프린트 ${c.discounts.sprint}%</span>
        </div>
        ${c.discountMatrix ? `
        <div class="discount-tags" style="margin-top:6px;">
          <span class="discount-tag" style="background:var(--accent-light);color:var(--accent);">리코탭 ${Math.round(c.discountMatrix.ricotap*100)}%</span>
          <span class="discount-tag" style="background:var(--accent-light);color:var(--accent);">스프린트 ${Math.round(c.discountMatrix.sprint*100)}%</span>
          <span class="discount-tag" style="background:var(--accent-light);color:var(--accent);">실린더 ${Math.round((c.discountMatrix.sprintCyl||0)*100)}%</span>
          <span class="discount-tag" style="background:var(--accent-light);color:var(--accent);">바로웰핏 ${Math.round(c.discountMatrix.baroweltfit*100)}%</span>
          <span class="discount-tag" style="background:var(--accent-light);color:var(--accent);">알티네오 ${Math.round(c.discountMatrix.neo*100)}%</span>
        </div>` : ''}
        <div class="client-card-row mt-8"><span class="label">고정단가</span><span>${fixedPriceHTML}</span></div>
        <div class="client-card-footer">
          <button class="btn btn-outline btn-sm" onclick="showEditClientForm('${c.id}')">수정</button>
          <button class="btn btn-outline btn-sm" onclick="showDiscountMatrix('${c.id}')">할인 매트릭스</button>
          <button class="btn btn-outline btn-sm" onclick="showClientDiscountDetail('${c.id}')">품목별 할인</button>
          <button class="btn btn-outline btn-sm" onclick="showClientDetail('${c.id}')">상세보기</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterClients(term) {
  renderClients(term);
}

function showAddClientTypeForm() {
  const _cct = window.customClientTypes || [];
  showModal('거래처 유형 추가', `
    <div class="form-group">
      <label>새 유형명</label>
      <input type="text" class="form-input" id="new-client-type" placeholder="예: 약국, 재활센터...">
    </div>
    <div class="text-sm text-muted">현재 유형: ${_cct.join(', ')}</div>
  `, function() {
    const newType = document.getElementById('new-client-type')?.value?.trim();
    const types = window.customClientTypes || [];
    if (newType && !types.includes(newType)) {
      types.push(newType);
      window.customClientTypes = types;
      const sel = document.getElementById('client-type-filter');
      if (sel) {
        const opt = document.createElement('option');
        opt.value = newType;
        opt.textContent = newType;
        sel.appendChild(opt);
      }
      showToast('"' + newType + '" 유형이 추가되었습니다', 'success');
    }
  });
}

function showClientDiscountDetail(clientId) {
  const c = getClient(clientId);
  if (!c) return;
  const catNames = { knee: '무릎', upper: '상지', lower: '하지', sprint: '스프린트' };
  let productsHTML = '';
  for (const [catId, catName] of Object.entries(catNames)) {
    const catProducts = (window.PRODUCTS || []).filter(p => p.cat === catId);
    productsHTML += `<div style="font-size:13px;font-weight:700;margin:12px 0 6px;color:var(--primary);">${catName} (기본 ${c.discounts[catId]}%)</div>`;
    productsHTML += '<div class="product-discount-grid">';
    catProducts.forEach(p => {
      const customDisc = c.fixedPrices[p.id] ? Math.round((1 - c.fixedPrices[p.id] / p.basePrice) * 100) : '';
      productsHTML += `
        <div class="pd-label">${p.name}</div>
        <div><input type="number" min="0" max="50" value="${customDisc}" placeholder="${c.discounts[catId]}"> %</div>
      `;
    });
    productsHTML += '</div>';
  }
  showModal('품목별 할인율 설정 - ' + c.name, `
    <div style="max-height:400px;overflow-y:auto;">
      <div class="text-sm text-muted mb-8">개별 할인율을 비워두면 카테고리 기본 할인율이 적용됩니다.</div>
      ${productsHTML}
    </div>
  `, function() {
    showToast(c.name + ' 할인율이 저장되었습니다', 'success');
  });
}

// ── 할인율 매트릭스 모달 ───────────────────────────────────────────
function showDiscountMatrix(clientId) {
  const c = getClient(clientId);
  if (!c) return;
  if (!c.discountMatrix) {
    c.discountMatrix = {
      ricotap: 0.55, sprint: 0.65, sprintCyl: 0.60,
      baroweltfit: 0.45, neo: 0.55,
    };
  }
  const MP = window.MASTER_PRICES || {};
  const modelToMatrixKey = {
    ricotap: 'ricotap', sprint: 'sprint',
    baroweltfit: 'baroweltfit', neo: 'neo',
  };
  const rowsHTML = [];
  Object.entries(MP).forEach(([modelKey, model]) => {
    const matrixKey = modelToMatrixKey[modelKey];
    const rate = c.discountMatrix[matrixKey] != null ? c.discountMatrix[matrixKey] : 1.0;
    const partKeys = Object.keys(model.parts);
    const isSprintCyl = (modelKey === 'sprint');
    partKeys.forEach((pk, idx) => {
      const p = model.parts[pk];
      const useRate = (isSprintCyl && pk === 'cylinder')
        ? (c.discountMatrix.sprintCyl != null ? c.discountMatrix.sprintCyl : 1.0)
        : rate;
      const supply = Math.round(p.msrp * useRate);
      const isCyl = (isSprintCyl && pk === 'cylinder');
      rowsHTML.push(`
        <tr>
          ${idx === 0 ? `<td rowspan="${partKeys.length}" style="font-weight:700;color:var(--primary);vertical-align:middle;text-align:center;background:var(--bg-soft);">${model.label}</td>` : ''}
          <td>${p.label}</td>
          <td style="text-align:right;color:var(--text-secondary);">${p.msrp.toLocaleString()}</td>
          <td style="text-align:center;">
            ${isCyl
              ? `<input type="number" min="0" max="100" step="1" class="dm-rate" data-key="sprintCyl"
                   value="${Math.round(useRate*100)}" style="width:64px;padding:4px;text-align:right;">`
              : (idx === 0
                ? `<input type="number" min="0" max="100" step="1" class="dm-rate" data-key="${matrixKey}"
                     value="${Math.round(rate*100)}" style="width:64px;padding:4px;text-align:right;">`
                : `<span style="color:var(--text-muted);">↑ 동일</span>`)}
            <span style="color:var(--text-muted);font-size:11px;">%</span>
          </td>
          <td style="text-align:right;font-weight:600;color:var(--success);" class="dm-supply" data-model="${matrixKey}" data-part="${pk}">
            ${supply.toLocaleString()}
          </td>
        </tr>
      `);
    });
  });
  const body = `
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
      <b>${c.name}</b> 거래처에 적용되는 모델별 할인율을 설정합니다.
      <br>할인율(%) = MSRP 대비 거래처 지불 비율 (예: 55% = MSRP × 0.55 가격으로 공급).
    </div>
    <div style="overflow-x:auto;">
    <style>.discount-matrix-table td{padding:6px 8px;border:1px solid var(--border);}</style>
    <table class="discount-matrix-table" style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg-soft);">
          <th style="padding:8px;border:1px solid var(--border);text-align:center;width:110px;">모델</th>
          <th style="padding:8px;border:1px solid var(--border);text-align:center;width:120px;">파트</th>
          <th style="padding:8px;border:1px solid var(--border);text-align:right;width:100px;">정가(MSRP)</th>
          <th style="padding:8px;border:1px solid var(--border);text-align:center;width:110px;">할인율</th>
          <th style="padding:8px;border:1px solid var(--border);text-align:right;width:110px;">공급가</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML.join('')}
      </tbody>
    </table>
    </div>
    <div style="margin-top:12px;padding:10px;background:var(--accent-light);border-radius:6px;font-size:12px;color:var(--text-secondary);">
      <b>참고</b> · 병원 거래처는 100% (MSRP 그대로), 대리점은 보통 45~65% 범위. xlsx 거래처별 할인율 단가 자료 기준.
    </div>
  `;
  showModal('할인율 매트릭스 - ' + c.name, body, async () => {
    // 1) 폼 값 수집 → matrix 갱신 (인메모리)
    const nextMatrix = { ...c.discountMatrix };
    document.querySelectorAll('.dm-rate').forEach(el => {
      const key = el.dataset.key;
      const v = Math.max(0, Math.min(100, parseInt(el.value, 10) || 0)) / 100;
      nextMatrix[key] = v;
    });

    // 2) 서버 upsert (ClientDiscount, category=matrixKey, discountRate=1-rate).
    //    매트릭스의 "rate" 는 MSRP 대비 공급 비율(예: 0.55 = 55% 지불)이므로
    //    실제 할인율 = 1 - rate (예: 0.45 = 45% 할인).
    //    rate >= 1.0 (할인 없음) 행은 스킵, rate <= 0 (100% 할인) 은 서버가 거부.
    const failures = [];
    const keys = Object.keys(nextMatrix);
    for (const key of keys) {
      const rate = nextMatrix[key];
      if (rate >= 1 || rate <= 0) continue; // 0%/100% 할인은 row 무의미 또는 금지
      const discountRate = (1 - rate).toFixed(4);
      try {
        const r = await fetch('/api/clients/' + c.id + '/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ category: key, discountRate }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          failures.push(key + ': ' + (e.error || r.status));
        }
      } catch (err) {
        failures.push(key + ': ' + (err.message || 'network error'));
      }
    }

    if (failures.length > 0) {
      showToast('일부 행 저장 실패: ' + failures.join(', '), 'error');
      return false;
    }

    // 3) 성공 — 인메모리 반영 + 재렌더
    c.discountMatrix = nextMatrix;
    if (typeof renderClients === 'function') {
      renderClients(document.getElementById('client-search')?.value || '');
    }
    showToast(c.name + ' 할인 매트릭스가 저장되었습니다', 'success');
    if (typeof recordAudit === 'function') {
      recordAudit({
        action: 'DISCOUNT_MATRIX_UPDATE',
        resource: 'Client:' + c.id,
        metadata: { ...c.discountMatrix },
      });
    }
  });
  setTimeout(() => {
    document.querySelectorAll('.dm-rate').forEach(input => {
      input.addEventListener('input', () => {
        const matrixKey = input.dataset.key;
        const ratePct = Math.max(0, Math.min(100, parseInt(input.value, 10) || 0));
        const rate = ratePct / 100;
        document.querySelectorAll(`.dm-supply[data-model="${matrixKey}"]`).forEach(cell => {
          if (matrixKey === 'sprintCyl' && cell.dataset.part !== 'cylinder') return;
          if (matrixKey === 'sprint' && cell.dataset.part === 'cylinder') return;
          const modelDef = MP[matrixKey === 'sprintCyl' ? 'sprint' : matrixKey];
          if (!modelDef) return;
          const part = modelDef.parts[cell.dataset.part];
          if (!part) return;
          cell.textContent = Math.round(part.msrp * rate).toLocaleString();
        });
      });
    });
  }, 50);
}

// ── 카테고리별 할인율 팝업 ──────────────────────────────────────────
function openDiscountPopup() {
  const cur = {
    knee: parseFloat(document.getElementById('cf-disc-knee').value) || 0,
    upper: parseFloat(document.getElementById('cf-disc-upper').value) || 0,
    lower: parseFloat(document.getElementById('cf-disc-lower').value) || 0,
    sprint: parseFloat(document.getElementById('cf-disc-sprint').value) || 0,
  };
  const outerModal = document.querySelector('.modal-overlay');
  if (outerModal) outerModal.style.zIndex = '900';
  const body = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
      카테고리별 기본 할인율입니다. 0 ~ 50% 범위에서 설정하세요.
    </div>
    <div style="display:grid;grid-template-columns:110px 1fr 60px;gap:10px;align-items:center;margin-bottom:8px;">
      <label style="font-weight:600;"> 무릎</label>
      <input type="range" id="pop-knee" min="0" max="50" value="${cur.knee}" oninput="document.getElementById('pop-knee-v').textContent=this.value+'%'">
      <span id="pop-knee-v" style="font-weight:700;color:var(--primary);">${cur.knee}%</span>
    </div>
    <div style="display:grid;grid-template-columns:110px 1fr 60px;gap:10px;align-items:center;margin-bottom:8px;">
      <label style="font-weight:600;"> 상지</label>
      <input type="range" id="pop-upper" min="0" max="50" value="${cur.upper}" oninput="document.getElementById('pop-upper-v').textContent=this.value+'%'">
      <span id="pop-upper-v" style="font-weight:700;color:var(--primary);">${cur.upper}%</span>
    </div>
    <div style="display:grid;grid-template-columns:110px 1fr 60px;gap:10px;align-items:center;margin-bottom:8px;">
      <label style="font-weight:600;"> 하지</label>
      <input type="range" id="pop-lower" min="0" max="50" value="${cur.lower}" oninput="document.getElementById('pop-lower-v').textContent=this.value+'%'">
      <span id="pop-lower-v" style="font-weight:700;color:var(--primary);">${cur.lower}%</span>
    </div>
    <div style="display:grid;grid-template-columns:110px 1fr 60px;gap:10px;align-items:center;margin-bottom:8px;">
      <label style="font-weight:600;"> 스프린트</label>
      <input type="range" id="pop-sprint" min="0" max="50" value="${cur.sprint}" oninput="document.getElementById('pop-sprint-v').textContent=this.value+'%'">
      <span id="pop-sprint-v" style="font-weight:700;color:var(--primary);">${cur.sprint}%</span>
    </div>
  `;
  showModal(' 카테고리별 할인율 설정', body, () => {
    const k = document.getElementById('pop-knee').value;
    const u = document.getElementById('pop-upper').value;
    const l = document.getElementById('pop-lower').value;
    const s = document.getElementById('pop-sprint').value;
    document.getElementById('cf-disc-knee').value = k;
    document.getElementById('cf-disc-upper').value = u;
    document.getElementById('cf-disc-lower').value = l;
    document.getElementById('cf-disc-sprint').value = s;
    const sum = document.getElementById('cf-disc-summary');
    if (sum) sum.innerHTML = `무릎 <b>${k}%</b> · 상지 <b>${u}%</b> · 하지 <b>${l}%</b> · 스프린트 <b>${s}%</b>`;
    if (outerModal) outerModal.style.zIndex = '';
    showToast('할인율이 적용되었습니다');
  });
  setTimeout(() => {
    const all = document.querySelectorAll('.modal-overlay');
    const top = all[all.length - 1];
    if (top) top.style.zIndex = '1100';
    const closeBtns = top ? top.querySelectorAll('.modal-close, .modal-cancel') : [];
    closeBtns.forEach(b => b.addEventListener('click', () => {
      if (outerModal) outerModal.style.zIndex = '';
    }));
  }, 10);
}

// ── 거래처 상세 모달 ───────────────────────────────────────────────
function showClientDetail(clientId) {
  const c = getClient(clientId);
  if (!c) return;
  const typeBadge = c.type === '대리점'
    ? '<span class="badge badge-type-dealer">대리점</span>'
    : '<span class="badge badge-type-hospital">병원</span>';
  const fixedPriceHTML = Object.keys(c.fixedPrices).length > 0
    ? '<ul style="margin:4px 0 0 16px;font-size:13px;">' +
      Object.entries(c.fixedPrices).map(([pid, price]) =>
        `<li>${getProductName(pid)}: ${formatCurrency(price)}</li>`
      ).join('') + '</ul>'
    : '없음';
  const clientOrders = (window.ORDERS || []).filter(o => o.clientId === clientId);
  const clientRevenue = clientOrders.reduce((s, o) => s + calcOrderTotal(o), 0);
  const rec = (window.RECEIVABLES || []).find(r => r.clientId === clientId);
  const bodyHTML = `
    <div style="margin-bottom:16px;">
      <div class="flex items-center gap-8 mb-8">
        <strong style="font-size:18px;">${c.name}</strong> ${typeBadge}
      </div>
    </div>
    <table style="width:100%; font-size:13px; line-height:2;">
      <tr><td style="font-weight:600; width:90px; color:var(--text-secondary);">담당자</td><td>${c.manager}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">연락처</td><td>${c.phone}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">이메일</td><td>${c.email}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">기본 주소</td><td>${c.address}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">결제방식</td><td>${c.paymentType}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">마감기간</td><td>${c.closingPeriod}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">명세서</td><td>${c.invoiceType}</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">할인율</td><td>무릎 ${c.discounts.knee}% / 상지 ${c.discounts.upper}% / 하지 ${c.discounts.lower}% / 스프린트 ${c.discounts.sprint}%</td></tr>
      <tr><td style="font-weight:600; color:var(--text-secondary);">고정단가</td><td>${fixedPriceHTML}</td></tr>
      ${c.salesRep ? `<tr><td style="font-weight:600; color:var(--text-secondary);">영업담당자</td><td><b>${c.salesRep}</b></td></tr>` : ''}
      ${c.specialty ? `<tr><td style="font-weight:600; color:var(--text-secondary);">진료과</td><td>${c.specialty} ${c.doctorCount ? `(의사 ${c.doctorCount}명)` : ''}</td></tr>` : ''}
    </table>
    ${c.discountMatrix ? `
    <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:14px;">할인율 매트릭스 <span style="color:var(--text-secondary); font-weight:400; font-size:12px;">(모델별 공급가)</span></strong>
        <button class="btn btn-outline btn-sm" onclick="showDiscountMatrix('${c.id}')">편집</button>
      </div>
      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead><tr style="background:var(--bg-soft);">
          <th style="padding:6px;border:1px solid var(--border);text-align:left;">모델</th>
          <th style="padding:6px;border:1px solid var(--border);text-align:left;">파트</th>
          <th style="padding:6px;border:1px solid var(--border);text-align:right;">MSRP</th>
          <th style="padding:6px;border:1px solid var(--border);text-align:center;">할인율</th>
          <th style="padding:6px;border:1px solid var(--border);text-align:right;">공급가</th>
        </tr></thead>
        <tbody>
          ${(() => {
            const MP = window.MASTER_PRICES || {};
            const rows = [];
            Object.entries(MP).forEach(([mk, model]) => {
              const partKeys = Object.keys(model.parts);
              partKeys.forEach((pk, idx) => {
                const p = model.parts[pk];
                const rate = (mk === 'sprint' && pk === 'cylinder')
                  ? (c.discountMatrix.sprintCyl || 1.0)
                  : (c.discountMatrix[mk] || 1.0);
                const supply = Math.round(p.msrp * rate);
                rows.push(`<tr>
                  ${idx === 0 ? `<td rowspan="${partKeys.length}" style="padding:6px;border:1px solid var(--border);font-weight:700;color:var(--primary);background:var(--bg-soft);vertical-align:middle;text-align:center;">${model.label}</td>` : ''}
                  <td style="padding:6px;border:1px solid var(--border);">${p.label}</td>
                  <td style="padding:6px;border:1px solid var(--border);text-align:right;color:var(--text-secondary);">${p.msrp.toLocaleString()}</td>
                  <td style="padding:6px;border:1px solid var(--border);text-align:center;font-weight:600;">${Math.round(rate*100)}%</td>
                  <td style="padding:6px;border:1px solid var(--border);text-align:right;font-weight:600;color:var(--success);">${supply.toLocaleString()}</td>
                </tr>`);
              });
            });
            return rows.join('');
          })()}
        </tbody>
      </table>
    </div>` : ''}
    <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="font-size:14px;"> 배송지 관리 <span style="color:var(--text-secondary); font-weight:400; font-size:12px;">(${(c.addresses||[]).length}개)</span></strong>
        <button class="btn btn-outline btn-sm" onclick="openClientAddressForm('${c.id}', null)">+ 배송지 추가</button>
      </div>
      <div id="client-addr-list-${c.id}">
        ${renderClientAddressRows(c)}
      </div>
    </div>
    <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border); font-size:13px;">
      <strong>거래 현황:</strong> 발주 ${clientOrders.length}건 | 매출 ${formatCurrency(clientRevenue)}
      ${rec ? ' | 미수금 ' + formatCurrency(rec.amount) : ''}
    </div>
  `;
  showModal('거래처 상세 — ' + c.name, bodyHTML);
}

// ── 배송지 관리 ────────────────────────────────────────────────────
function renderClientAddressRows(c) {
  const list = c.addresses || [];
  if (list.length === 0) {
    return `<div class="text-sm text-muted" style="padding:10px; background:var(--bg); border-radius:var(--radius-xs);">등록된 배송지가 없습니다.</div>`;
  }
  const sorted = [...list].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return sorted.map(a => `
    <div style="padding:10px 12px; background:var(--bg); border-radius:var(--radius-xs); margin-bottom:6px; display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
          ${a.label}
          ${a.isDefault ? '<span class="badge" style="background:var(--primary-lighter); color:var(--primary); font-size:11px;">기본</span>' : ''}
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${a.address}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
          ${a.recipient || c.manager} · ${a.phone || c.phone || '-'}
          ${a.memo ? ` · ${a.memo}` : ''}
        </div>
      </div>
      <div style="display:flex; gap:4px; flex-shrink:0;">
        ${!a.isDefault ? `<button class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 8px;" onclick="setDefaultClientAddress('${c.id}','${a.id}')">기본으로</button>` : ''}
        <button class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 8px;" onclick="openClientAddressForm('${c.id}','${a.id}')">수정</button>
        <button class="btn btn-outline btn-sm" style="font-size:11px; padding:4px 8px; color:var(--danger);" onclick="deleteClientAddress('${c.id}','${a.id}')">삭제</button>
      </div>
    </div>
  `).join('');
}

/**
 * 배송지 객체 — 백엔드(recipientName) ↔ prototype(recipient) 필드 어댑터.
 * renderClientAddressRows() 는 prototype-shape(a.recipient) 를 읽으므로
 * 백엔드 응답을 받자마자 변환해서 c.addresses 에 넣어야 한다.
 */
function _addrFromApi(row) {
  return {
    id: row.id,
    label: row.label,
    recipient: row.recipientName || '',
    phone: row.phone || '',
    address: row.address || '',
    addressDetail: row.addressDetail || '',
    postalCode: row.postalCode || '',
    memo: row.memo || '',
    isDefault: !!row.isDefault,
  };
}

function openClientAddressForm(clientId, addressId) {
  const c = getClient(clientId);
  if (!c) return;
  c.addresses = c.addresses || [];
  const a = addressId ? c.addresses.find(x => x.id === addressId) : null;
  const isEdit = !!a;
  showModal(
    (isEdit ? '배송지 수정' : '배송지 추가') + ' — ' + c.name,
    `<div style="display:grid; gap:10px;">
      <div class="form-group" style="margin:0;">
        <label class="form-label">배송지 별칭 *</label>
        <input type="text" class="form-input" id="ca-label" value="${a ? a.label : ''}" placeholder="예: 강남 지점, 수원 창고">
      </div>
      <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">수령인</label>
          <input type="text" class="form-input" id="ca-recipient" value="${a ? (a.recipient || '') : ''}" placeholder="미입력시 담당자명">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">연락처</label>
          <input type="text" class="form-input" id="ca-phone" value="${a ? (a.phone || '') : ''}" placeholder="010-0000-0000">
        </div>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">배송 주소 *</label>
        <input type="text" class="form-input" id="ca-address" value="${a ? a.address : ''}" placeholder="도로명 주소 + 상세주소">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">배송 메모</label>
        <input type="text" class="form-input" id="ca-memo" value="${a ? (a.memo || '') : ''}" placeholder="예: 토요일 수령 불가">
      </div>
      <label class="radio-item" style="margin-top:4px;">
        <input type="checkbox" id="ca-default" ${a && a.isDefault ? 'checked' : ''}>
        <span>기본 배송지로 설정</span>
      </label>
    </div>`,
    async function() {
      const label = document.getElementById('ca-label').value.trim();
      const address = document.getElementById('ca-address').value.trim();
      if (!label || !address) { showToast('별칭과 주소를 입력해주세요.', 'error'); return false; }

      // 백엔드 스키마: { label, recipientName, phone, address, addressDetail?, postalCode?, memo, isDefault }
      const apiPayload = {
        label,
        recipientName: document.getElementById('ca-recipient').value.trim(),
        phone: document.getElementById('ca-phone').value.trim(),
        address,
        memo: document.getElementById('ca-memo').value.trim(),
        isDefault: document.getElementById('ca-default').checked,
      };

      try {
        let row;
        if (isEdit) {
          const r = await fetch('/api/clients/' + clientId + '/addresses/' + a.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(apiPayload),
          });
          if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            showToast(e.error || '배송지 수정 실패', 'error');
            return false;
          }
          // 서버 응답엔 id 만 있을 수 있어 인메모리는 form 값으로 갱신
          row = { id: a.id, ...apiPayload };
          const idx = c.addresses.findIndex(x => x.id === a.id);
          if (idx !== -1) c.addresses[idx] = { ...c.addresses[idx], ..._addrFromApi(row) };
        } else {
          const r = await fetch('/api/clients/' + clientId + '/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(apiPayload),
          });
          if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            showToast(e.error || '배송지 추가 실패', 'error');
            return false;
          }
          const created = await r.json();
          row = { ...apiPayload, id: created.id };
          // 첫 배송지면 서버가 자동으로 isDefault=true 강제
          if (c.addresses.length === 0) row.isDefault = true;
          c.addresses.push(_addrFromApi(row));
        }

        // isDefault 토글 시 다른 행 동기화 (서버 트랜잭션과 일치)
        if (apiPayload.isDefault) {
          c.addresses.forEach(x => { if (x.id !== (row && row.id)) x.isDefault = false; });
        }

        showClientDetail(clientId);
        showToast((isEdit ? '수정' : '추가') + ' 완료: ' + label, 'success');
      } catch (err) {
        showToast(err.message || '배송지 저장 실패', 'error');
        return false;
      }
    }
  );
}

async function setDefaultClientAddress(clientId, addressId) {
  const c = getClient(clientId);
  if (!c || !c.addresses) return;
  try {
    const r = await fetch('/api/clients/' + clientId + '/addresses/' + addressId + '/default', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      showToast(e.error || '기본 배송지 변경 실패', 'error');
      return;
    }
    c.addresses.forEach(a => { a.isDefault = (a.id === addressId); });
    showClientDetail(clientId);
    showToast('기본 배송지 변경', 'success');
  } catch (err) {
    showToast(err.message || '기본 배송지 변경 실패', 'error');
  }
}

async function deleteClientAddress(clientId, addressId) {
  const c = getClient(clientId);
  if (!c || !c.addresses) return;
  const a = c.addresses.find(x => x.id === addressId);
  if (!a) return;
  if (!confirm(`배송지 "${a.label}" 을(를) 삭제하시겠습니까?\n(이 배송지로 진행된 과거 주문은 유지됩니다)`)) return;
  try {
    const r = await fetch('/api/clients/' + clientId + '/addresses/' + addressId, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      showToast(e.error || '배송지 삭제 실패', 'error');
      return;
    }
    const wasDefault = a.isDefault;
    c.addresses = c.addresses.filter(x => x.id !== addressId);
    // 서버는 가장 오래된 활성 배송지를 자동 승격 — 인메모리도 동일 규칙 (createdAt 정보가 없으면 첫 행)
    if (wasDefault && c.addresses.length > 0) c.addresses[0].isDefault = true;
    showClientDetail(clientId);
    showToast('배송지 삭제됨: ' + a.label, 'success');
  } catch (err) {
    showToast(err.message || '배송지 삭제 실패', 'error');
  }
}

// ── 거래처 등록/수정 폼 ────────────────────────────────────────────
function buildClientFormHTML(client) {
  const isEdit = !!client;
  const c = client || { name:'', type:'대리점', manager:'', phone:'', email:'', address:'',
    paymentType:'당월말카드', closingPeriod:'1일~25일', invoiceType:'RTBIO',
    discounts:{ knee:0, upper:0, lower:0, sprint:0 }, loginId:'', pw:'' };
  const _customClientTypes = window.customClientTypes || [];
  return `
    <div class="modal-form">
      <div class="form-row">
        <div class="form-group">
          <label>업체명</label>
          <input type="text" id="cf-name" value="${c.name}">
        </div>
        <div class="form-group">
          <label>유형</label>
          <select id="cf-type">
            ${_customClientTypes.map(t => '<option value="' + t + '"' + (c.type === t ? ' selected' : '') + '>' + t + '</option>').join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>담당자명</label>
          <input type="text" id="cf-manager" value="${c.manager}">
        </div>
        <div class="form-group">
          <label>연락처</label>
          <input type="text" id="cf-phone" value="${c.phone}" placeholder="010-0000-0000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>담당 영업사원</label>
          <select id="cf-sales-rep">
            <option value="">선택안함</option>
            ${(window.SALES_REPS || []).map(r => '<option value="' + r.id + '"' + ((window.CLIENT_REP_MAP || {})[isEdit ? client.id : ''] === r.id ? ' selected' : '') + '>' + r.name + '</option>').join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이메일</label>
          <input type="text" id="cf-email" value="${c.email}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>주소</label>
          <input type="text" id="cf-address" value="${c.address}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>결제방식</label>
          <select id="cf-payment">
            <option value="당월말카드" ${c.paymentType === '당월말카드' ? 'selected' : ''}>당월말카드</option>
            <option value="사용량카드" ${c.paymentType === '사용량카드' ? 'selected' : ''}>사용량카드</option>
            <option value="계좌이체" ${c.paymentType === '계좌이체' ? 'selected' : ''}>계좌이체</option>
            <option value="3개월후결제" ${c.paymentType === '3개월후결제' ? 'selected' : ''}>3개월후결제</option>
          </select>
        </div>
        <div class="form-group">
          <label>마감기간</label>
          <select id="cf-closing">
            <option value="1일~25일" ${c.closingPeriod === '1일~25일' ? 'selected' : ''}>1일~25일</option>
            <option value="1일~말일" ${c.closingPeriod === '1일~말일' ? 'selected' : ''}>1일~말일</option>
            <option value="전달26일~당월25일" ${c.closingPeriod === '전달26일~당월25일' ? 'selected' : ''}>전달26일~당월25일</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>명세서 양식</label>
          <select id="cf-invoice-type">
            <option value="RTBIO" ${c.invoiceType === 'RTBIO' ? 'selected' : ''}>RTBIO</option>
            <option value="거래처" ${c.invoiceType === '거래처' ? 'selected' : ''}>거래처</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>할인율 설정</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openDiscountPopup()"> 할인율 설정 (팝업)</button>
            <span id="cf-disc-summary" style="font-size:12px;color:var(--text-secondary);">
              무릎 <b>${c.discounts.knee}%</b> · 상지 <b>${c.discounts.upper}%</b> · 하지 <b>${c.discounts.lower}%</b> · 스프린트 <b>${c.discounts.sprint}%</b>
            </span>
            <input type="hidden" id="cf-disc-knee" value="${c.discounts.knee}">
            <input type="hidden" id="cf-disc-upper" value="${c.discounts.upper}">
            <input type="hidden" id="cf-disc-lower" value="${c.discounts.lower}">
            <input type="hidden" id="cf-disc-sprint" value="${c.discounts.sprint}">
          </div>
          <span class="form-note">카테고리별 기본 할인율. 품목별 개별 할인율은 등록 후 거래처 목록에서 별도 설정합니다.</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Login ID</label>
          <input type="text" id="cf-login-id" value="${isEdit ? c.loginId : ''}" readonly style="background:var(--bg);">
          <span class="form-note">자동 생성됩니다</span>
        </div>
        <div class="form-group">
          <label>Login PW</label>
          <input type="text" id="cf-login-pw" value="${isEdit ? c.pw : ''}" readonly style="background:var(--bg);">
          <span class="form-note">관리번호가 자동 부여됩니다</span>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">취소</button>
        <button class="btn btn-primary" id="cf-submit-btn" onclick="${isEdit
          ? "_submitClientForm('" + (client ? client.id : '') + "', true)"
          : "_submitClientForm(null, false)"
        }">${isEdit ? '저장' : '등록'}</button>
      </div>
    </div>
  `;
}

function showNewClientForm() {
  const bodyHTML = buildClientFormHTML(null);
  showModal('신규 거래처 등록', bodyHTML);
  const overlay = document.querySelector('.modal-overlay');
  const footer = overlay?.querySelector('.modal-footer');
  if (footer) footer.style.display = 'none';
}

function showEditClientForm(clientId) {
  const c = getClient(clientId);
  if (!c) return;
  const bodyHTML = buildClientFormHTML(c);
  showModal('거래처 수정 — ' + c.name, bodyHTML);
  const overlay = document.querySelector('.modal-overlay');
  const footer = overlay?.querySelector('.modal-footer');
  if (footer) footer.style.display = 'none';
}

// ── 거래처 저장/삭제 API 연동 ──────────────────────────────────────
/**
 * 신규 등록(isEdit=false) 또는 수정(isEdit=true) 을 서버에 반영.
 * buildClientFormHTML() 내 저장 버튼에서 직접 호출.
 */
async function _submitClientForm(clientId, isEdit) {
  const btn = document.getElementById('cf-submit-btn');

  // 폼 값 수집
  const payload = {
    name:          document.getElementById('cf-name')?.value.trim(),
    type:          document.getElementById('cf-type')?.value,
    manager:       document.getElementById('cf-manager')?.value.trim(),
    phone:         document.getElementById('cf-phone')?.value.trim(),
    email:         document.getElementById('cf-email')?.value.trim(),
    address:       document.getElementById('cf-address')?.value.trim(),
    paymentType:   document.getElementById('cf-payment')?.value,
    closingPeriod: document.getElementById('cf-closing')?.value,
    invoiceType:   document.getElementById('cf-invoice-type')?.value,
    discounts: {
      knee:   parseFloat(document.getElementById('cf-disc-knee')?.value)   || 0,
      upper:  parseFloat(document.getElementById('cf-disc-upper')?.value)  || 0,
      lower:  parseFloat(document.getElementById('cf-disc-lower')?.value)  || 0,
      sprint: parseFloat(document.getElementById('cf-disc-sprint')?.value) || 0,
    },
    salesRepId: document.getElementById('cf-sales-rep')?.value || null,
  };

  if (!payload.name) {
    if (typeof showToast === 'function') showToast('업체명은 필수입니다', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }

  try {
    let savedId = clientId;
    if (isEdit && clientId) {
      // PATCH /api/clients/:id
      const updated = await window.apiClient.patch('/api/clients/' + clientId, payload);
      // window.CLIENTS 인메모리 반영
      const idx = (window.CLIENTS || []).findIndex(function(c) { return c.id === clientId; });
      if (idx !== -1) Object.assign(window.CLIENTS[idx], updated || payload);
    } else {
      // POST /api/clients
      const created = await window.apiClient.post('/api/clients', payload);
      (window.CLIENTS = window.CLIENTS || []).push(created || payload);
      savedId = (created && created.id) || null;
    }

    // 카테고리별 할인율 (openDiscountPopup 결과) 별도 upsert.
    // discountRate 0~1 미만, 0% 는 row 무의미하므로 스킵.
    if (savedId) {
      const catDiscounts = {
        knee:   payload.discounts.knee,
        upper:  payload.discounts.upper,
        lower:  payload.discounts.lower,
        sprint: payload.discounts.sprint,
      };
      for (const [cat, pct] of Object.entries(catDiscounts)) {
        const rate = (pct || 0) / 100;
        if (rate <= 0 || rate >= 1) continue;
        try {
          const r = await fetch('/api/clients/' + savedId + '/discounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ category: cat, discountRate: rate.toFixed(4) }),
          });
          if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            if (typeof showToast === 'function') showToast('할인율(' + cat + ') 저장 실패: ' + (e.error || r.status), 'error');
          }
        } catch (_) { /* 단일 카테고리 실패는 전체 저장 흐름 막지 않음 */ }
      }
    }

    document.querySelector('.modal-overlay')?.remove();
    if (typeof renderClients === 'function') {
      renderClients(document.getElementById('client-search')?.value || '');
    }
    if (typeof showToast === 'function') {
      showToast(isEdit ? '거래처 정보가 수정되었습니다' : '거래처가 등록되었습니다', 'success');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || '저장 실패', 'error');
    if (btn) { btn.disabled = false; btn.textContent = isEdit ? '저장' : '등록'; }
  }
}

/**
 * 거래처 삭제 — DELETE /api/clients/:id + window.CLIENTS 에서 제거.
 * @param {string} clientId
 */
async function deleteClient(clientId) {
  const c = getClient(clientId);
  if (!c) return;
  if (!confirm(c.name + ' 거래처를 삭제하시겠습니까?\n(관련 주문/명세서 이력도 영향을 받을 수 있습니다)')) return;

  try {
    await window.apiClient.delete('/api/clients/' + clientId);
    window.CLIENTS = (window.CLIENTS || []).filter(function(x) { return x.id !== clientId; });
    document.querySelector('.modal-overlay')?.remove();
    if (typeof renderClients === 'function') {
      renderClients(document.getElementById('client-search')?.value || '');
    }
    if (typeof showToast === 'function') showToast(c.name + ' 거래처가 삭제되었습니다', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || '삭제 실패', 'error');
  }
}

// ── window 노출 ────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.buildClientMgmtPageHTML = buildClientMgmtPageHTML;
  window.renderClients = renderClients;
  window.filterClients = filterClients;
  window.showAddClientTypeForm = showAddClientTypeForm;
  window.showClientDiscountDetail = showClientDiscountDetail;
  window.showDiscountMatrix = showDiscountMatrix;
  window.openDiscountPopup = openDiscountPopup;
  window.showClientDetail = showClientDetail;
  window.renderClientAddressRows = renderClientAddressRows;
  window.openClientAddressForm = openClientAddressForm;
  window.setDefaultClientAddress = setDefaultClientAddress;
  window.deleteClientAddress = deleteClientAddress;
  window.buildClientFormHTML = buildClientFormHTML;
  window.showNewClientForm = showNewClientForm;
  window.showEditClientForm = showEditClientForm;
  window._submitClientForm = _submitClientForm;
  window.deleteClient = deleteClient;
}
