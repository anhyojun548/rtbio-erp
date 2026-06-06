/**
 * RTBIO Prototype — 공지사항 공통 모듈 (notice.js)
 *
 * 4개 포털(경영지원/영업/품질/임원진)에서 공통 사용.
 * 작성자(authorTeam)는 init() 옵션으로 주입.
 * 데이터 저장소: window.NOTICES (data.js에서 초기화).
 *
 * 공개 API:
 *   NoticeModule.init({ authorTeam, hostId? })
 *   NoticeModule.render()
 *   NoticeModule.compose()
 *   NoticeModule.preview(noticeId)
 *   NoticeModule.edit(noticeId)
 *   NoticeModule.toggleSpecific()
 *   NoticeModule.pageTemplate()     ← 페이지 컨테이너에 innerHTML로 삽입 가능
 *   NoticeModule.AUTHOR_META         ← 4팀 색상/아이콘
 *
 * 하위 호환 (admin-portal 기존 함수명):
 *   window.renderNoticesPage, window.showNoticeComposeModal,
 *   window.showNoticePreviewPopup, window.editNotice,
 *   window.toggleNoticeSpecific, window.getNoticeTargetCount
 */
(function (global) {
  'use strict';

  // ── 발송자(팀)별 색상/아이콘 메타데이터 ───────────────────────────
  const AUTHOR_META = {
    '경영지원팀': { color: '#1B3A5C', bg: '#E3F2FD', icon: '🔵' },
    '영업팀':     { color: '#B45309', bg: '#FFF3E0', icon: '🟡' },
    '품질팀':     { color: '#166534', bg: '#E8F5E9', icon: '🟢' },
    '품질관리팀': { color: '#166534', bg: '#E8F5E9', icon: '🟢' }, // alias (시드 호환)
    '임원진':     { color: '#7C3AED', bg: '#F3E8FD', icon: '🔴' },
  };

  const TARGET_LABELS = {
    ALL:      '전체 거래처',
    DEALER:   '대리점',
    HOSPITAL: '병원',
    SPECIFIC: '특정 업체',
  };
  const TARGET_COLORS = {
    ALL:      '#1B3A5C',
    DEALER:   '#7C3AED',
    HOSPITAL: '#00838F',
    SPECIFIC: '#F57C00',
  };

  // ── 모듈 상태 (init 시 설정) ────────────────────────────────────────
  let _authorTeam = '경영지원팀';
  let _hostId = 'notices-grid';

  // ── 초기화 ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    if (opts.authorTeam) _authorTeam = opts.authorTeam;
    if (opts.hostId)     _hostId = opts.hostId;
  }

  // ── 유틸리티 ──────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function targetLabel(n) {
    if (n.target === 'SPECIFIC') return `특정 (${(n.targetIds || []).length}개)`;
    return TARGET_LABELS[n.target] || n.target;
  }
  function targetColor(t) { return TARGET_COLORS[t] || '#666'; }
  function getAuthorMeta(team) {
    return AUTHOR_META[team] || { color: '#666', bg: '#F5F5F5', icon: '⚪' };
  }
  function getNoticeTargetCount(n) {
    const clients = global.CLIENTS || [];
    if (n.target === 'ALL')      return clients.length;
    if (n.target === 'DEALER')   return clients.filter(c => c.type === '대리점').length;
    if (n.target === 'HOSPITAL') return clients.filter(c => c.type === '병원').length;
    return (n.targetIds || []).length;
  }

  // ── 페이지 HTML 템플릿 ────────────────────────────────────────────
  // 4개 포털에 동일하게 삽입 가능. <div id="page-notices"> 의 내용으로.
  function pageTemplate() {
    return `
      <div class="page-inner">
        <div class="main-header">
          <div>
            <div class="main-title">공지사항</div>
            <div class="main-subtitle">거래처·내부 공문 발송 + 발송 이력 관리</div>
          </div>
          <div>
            <button class="btn btn-primary" onclick="NoticeModule.compose()">＋ 공지 작성</button>
          </div>
        </div>
        <div class="filter-row mb-16" style="background:var(--surface);padding:12px 16px;border-radius:var(--radius);border:1px solid var(--border);display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin-bottom:0;min-width:240px;flex:1;">
            <label style="font-size:12px;color:var(--text-secondary);">검색</label>
            <input type="text" class="form-input" id="notice-search" placeholder="제목/본문 검색..." oninput="NoticeModule.render()">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:12px;color:var(--text-secondary);">대상</label>
            <select class="form-select" id="notice-target-filter" onchange="NoticeModule.render()">
              <option value="">전체</option>
              <option value="ALL">전체 거래처</option>
              <option value="DEALER">대리점만</option>
              <option value="HOSPITAL">병원만</option>
              <option value="SPECIFIC">특정 업체</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:12px;color:var(--text-secondary);">긴급도</label>
            <select class="form-select" id="notice-priority-filter" onchange="NoticeModule.render()">
              <option value="">전체</option>
              <option value="HIGH">긴급</option>
              <option value="NORMAL">일반</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:12px;color:var(--text-secondary);">작성자</label>
            <select class="form-select" id="notice-author-filter" onchange="NoticeModule.render()">
              <option value="">전체</option>
              <option value="경영지원팀">🔵 경영지원팀</option>
              <option value="영업팀">🟡 영업팀</option>
              <option value="품질관리팀">🟢 품질관리팀</option>
              <option value="임원진">🔴 임원진</option>
            </select>
          </div>
        </div>
        <div id="notices-grid"></div>
      </div>
    `;
  }

  // ── 목록 렌더링 ───────────────────────────────────────────────────
  function render() {
    const host = document.getElementById(_hostId);
    if (!host) return;
    const search   = (document.getElementById('notice-search')?.value || '').toLowerCase();
    const target   = document.getElementById('notice-target-filter')?.value || '';
    const priority = document.getElementById('notice-priority-filter')?.value || '';
    const author   = document.getElementById('notice-author-filter')?.value || '';

    const notices = (global.NOTICES || []).filter(n => {
      if (search && !(n.title.toLowerCase().includes(search) || n.body.toLowerCase().includes(search))) return false;
      if (target && n.target !== target) return false;
      if (priority && n.priority !== priority) return false;
      if (author && n.createdBy !== author) return false;
      return true;
    });

    if (notices.length === 0) {
      host.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted);">조건에 맞는 공지가 없습니다.</div>';
      return;
    }

    host.innerHTML = notices.map(n => {
      const am = getAuthorMeta(n.createdBy);
      return `
        <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:10px;${n.pinned ? 'border-left:3px solid #D32F2F;' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${n.pinned ? '<span style="color:#D32F2F;font-size:12px;">📌</span>' : ''}
              <strong style="font-size:14px;">${escapeHtml(n.title)}</strong>
              ${n.priority === 'HIGH' ? '<span class="badge" style="background:#ffebee;color:#C62828;">긴급</span>' : ''}
              <span class="badge" style="background:${targetColor(n.target)}20;color:${targetColor(n.target)};">${targetLabel(n)}</span>
              <span class="badge" style="background:${am.bg};color:${am.color};font-weight:600;">${am.icon} ${escapeHtml(n.createdBy)}</span>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-outline btn-sm" onclick="NoticeModule.preview('${n.id}')">미리보기</button>
              <button class="btn btn-outline btn-sm" onclick="NoticeModule.edit('${n.id}')">편집</button>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">${escapeHtml(n.body)}</div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);">
            <span>${n.createdAt}${n.expiresAt ? ' · 만료: ' + n.expiresAt : ''}</span>
            <span>읽음 ${(n.readBy || []).length}건 / 대상 ${getNoticeTargetCount(n)}건</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── 작성 모달 ─────────────────────────────────────────────────────
  function compose() {
    if (typeof showModal !== 'function') {
      console.warn('NoticeModule.compose: showModal()이 정의되지 않음');
      return;
    }
    const clientOptions = (global.CLIENTS || [])
      .map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`).join('');
    const am = getAuthorMeta(_authorTeam);

    showModal(`공지사항 작성 — ${am.icon} ${_authorTeam}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>제목 *</label>
          <input type="text" class="form-input" id="notice-new-title" placeholder="공지 제목">
        </div>
        <div class="form-group">
          <label>긴급도</label>
          <select class="form-select" id="notice-new-priority">
            <option value="NORMAL">일반</option>
            <option value="HIGH">긴급</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>본문 *</label>
        <textarea class="form-input" id="notice-new-body" rows="5" placeholder="공지 내용..."></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label>발송 대상</label>
          <select class="form-select" id="notice-new-target" onchange="NoticeModule.toggleSpecific()">
            <option value="ALL">전체 거래처</option>
            <option value="DEALER">대리점만</option>
            <option value="HOSPITAL">병원만</option>
            <option value="SPECIFIC">특정 업체</option>
          </select>
        </div>
        <div class="form-group">
          <label>만료일 (선택)</label>
          <input type="date" class="form-input" id="notice-new-expires">
        </div>
      </div>
      <div class="form-group" id="notice-specific-wrap" style="display:none;">
        <label>대상 업체 선택 (다중)</label>
        <select multiple class="form-select" id="notice-new-targetIds" size="6" style="height:auto;">
          ${clientOptions}
        </select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="notice-new-pinned"> 상단 고정 (📌 표시)</label>
      </div>
      <div class="form-group" style="background:${am.bg};padding:10px 12px;border-radius:6px;font-size:12px;color:${am.color};display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">${am.icon}</span>
        <span>작성자: <strong>${_authorTeam}</strong> (자동 설정)</span>
      </div>
    `, () => {
      const title = document.getElementById('notice-new-title').value.trim();
      const body  = document.getElementById('notice-new-body').value.trim();
      if (!title || !body) {
        if (typeof showToast === 'function') showToast('제목과 본문은 필수입니다', 'error');
        return;
      }
      // 2026-06 fix: 백엔드 필드명에 정확히 맞춤
      //   - createdBy:_authorTeam → authorTeam (POST route 가 최상위에서 추출)
      //   - targetIds → targetClientIds (createNoticeSchema)
      //   이전엔 둘 다 불일치 → 모든 발송이 'authorTeam 필수' 400 에러로 실패하고
      //   거래처 포털엔 아무 공지도 전달되지 않았음.
      const noticePayload = {
        title, body,
        target: document.getElementById('notice-new-target').value,
        targetClientIds: Array.from(document.getElementById('notice-new-targetIds')?.selectedOptions || []).map(function(o) { return o.value; }),
        priority: document.getElementById('notice-new-priority').value,
        authorTeam: _authorTeam,
        expiresAt: document.getElementById('notice-new-expires').value || null,
        pinned: document.getElementById('notice-new-pinned').checked,
      };

      // 2026-06 fix: 낙관적 인메모리 행은 "표시 계약"(createdBy=팀명, targetIds=배열, KST 날짜)
      //   으로 직접 구성. POST 응답은 { id } 만 주므로 saved 를 그대로 쓰면 title/body/
      //   createdBy/createdAt 가 전부 undefined → 목록에 "undefined ⚪ undefined" 로 표시됐음.
      //   noticePayload 는 API 필드명(authorTeam/targetClientIds)이라 그대로 spread 하면 안 됨.
      function _kstNowStr() {
        var d = new Date();
        var date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
        var time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 5);
        return date + ' ' + time;
      }
      function _buildDisplayNotice(savedId) {
        return {
          id: savedId || ('N' + String(Date.now()).slice(-6)),
          title: title,
          body: body,
          target: noticePayload.target,
          targetIds: noticePayload.targetClientIds || [],   // 표시 계약 (targetLabel/count 가 참조)
          priority: noticePayload.priority,
          createdBy: _authorTeam,                            // 표시 계약 (팀명 → 색상/아이콘 매칭)
          createdAt: _kstNowStr(),
          expiresAt: noticePayload.expiresAt || null,        // date input → 이미 'YYYY-MM-DD'
          pinned: noticePayload.pinned,
          readBy: [],
        };
      }

      // ── API 호출 (서버 저장) → 성공 시 인메모리 반영 ──────────
      var _doSave = function() {
        if (global.apiClient && typeof global.apiClient.post === 'function') {
          return global.apiClient.post('/api/notices', noticePayload)
            .then(function(saved) {
              var newNotice = _buildDisplayNotice(saved && saved.id);
              (global.NOTICES = global.NOTICES || []).unshift(newNotice);
              render();
              if (typeof pushNotification === 'function') {
                pushNotification({ type: 'NOTICE', title: '새 공지사항', message: title, targetTeam: 'ALL', relatedId: newNotice.id });
              }
              if (typeof showToast === 'function') showToast('공지사항이 발송되었습니다', 'success');
            })
            .catch(function(err) {
              if (typeof showToast === 'function') showToast(err.message || '발송 실패', 'error');
            });
        } else {
          // apiClient 미로딩 시 mock fallback
          var newNotice = _buildDisplayNotice(null);
          (global.NOTICES = global.NOTICES || []).unshift(newNotice);
          render();
          if (typeof showToast === 'function') showToast('공지사항이 발송되었습니다', 'success');
        }
      };
      _doSave();
    });
  }

  function toggleSpecific() {
    const v   = document.getElementById('notice-new-target').value;
    const el  = document.getElementById('notice-specific-wrap');
    if (el) el.style.display = v === 'SPECIFIC' ? 'block' : 'none';
  }

  // ── 미리보기 ──────────────────────────────────────────────────────
  function preview(noticeId) {
    const n = (global.NOTICES || []).find(x => x.id === noticeId);
    if (!n) return;
    const am = getAuthorMeta(n.createdBy);
    const headerBg = n.priority === 'HIGH'
      ? 'linear-gradient(135deg,#D32F2F,#B71C1C)'
      : `linear-gradient(135deg,${am.color},${am.color}AA)`;
    const html = `
      <div style="padding:0;">
        <div style="background:${headerBg};color:#fff;padding:20px 24px;margin:-16px -16px 16px -16px;border-radius:0;">
          <div style="font-size:18px;font-weight:700;margin-bottom:4px;">
            ${n.pinned ? '📌 ' : ''}${escapeHtml(n.title)}
          </div>
          <div style="font-size:12px;opacity:0.9;">${am.icon} ${escapeHtml(n.createdBy)} · ${n.createdAt}</div>
        </div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;padding:0 8px;">${escapeHtml(n.body)}</div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);">
          대상: ${targetLabel(n)} · ${n.expiresAt ? '만료: ' + n.expiresAt : '만료 없음'}
        </div>
      </div>
    `;
    if (typeof showFloatingPopup === 'function') {
      showFloatingPopup('공지 미리보기', html, { width: 520, height: 420 });
    } else if (typeof showModal === 'function') {
      showModal('공지 미리보기', html);
    } else {
      alert(n.title + '\n\n' + n.body);
    }
  }

  // ── 편집 / 삭제 ──────────────────────────────────────────────────
  function edit(noticeId) {
    var n = (global.NOTICES || []).find(function(x) { return x.id === noticeId; });
    if (!n) return;
    if (typeof showModal !== 'function') {
      if (typeof showToast === 'function') showToast('공지 편집은 모달 기능이 필요합니다', 'info');
      return;
    }
    showModal('공지 관리 — ' + escapeHtml(n.title), `
      <div style="font-size:14px; line-height:1.6; margin-bottom:16px;">
        <strong>${escapeHtml(n.title)}</strong><br>
        <span style="color:var(--text-secondary); font-size:12px;">${n.createdBy} · ${n.createdAt}</span>
      </div>
      <div style="background:var(--bg-soft); border-radius:6px; padding:12px; font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
        ${escapeHtml(n.body)}
      </div>
      <div style="color:var(--danger); font-size:13px;">
        이 공지를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
      </div>
    `, function() {
      _deleteNotice(noticeId);
    }, { confirmLabel: '삭제', confirmClass: 'btn-danger' });
  }

  /**
   * 공지 삭제 — DELETE /api/notices/:id + window.NOTICES 에서 제거.
   */
  function _deleteNotice(noticeId) {
    var _doDelete = function() {
      if (global.apiClient && typeof global.apiClient.delete === 'function') {
        return global.apiClient.delete('/api/notices/' + noticeId)
          .then(function() {
            global.NOTICES = (global.NOTICES || []).filter(function(x) { return x.id !== noticeId; });
            render();
            if (typeof showToast === 'function') showToast('공지사항이 삭제되었습니다', 'success');
          })
          .catch(function(err) {
            if (typeof showToast === 'function') showToast(err.message || '삭제 실패', 'error');
          });
      } else {
        // apiClient 미로딩 시 mock fallback
        global.NOTICES = (global.NOTICES || []).filter(function(x) { return x.id !== noticeId; });
        render();
        if (typeof showToast === 'function') showToast('공지사항이 삭제되었습니다', 'success');
      }
    };
    _doDelete();
  }

  // ── 공개 API ──────────────────────────────────────────────────────
  global.NoticeModule = {
    init,
    render,
    compose,
    preview,
    edit,
    deleteNotice: _deleteNotice,
    toggleSpecific,
    pageTemplate,
    AUTHOR_META,
    getAuthorMeta,
    getNoticeTargetCount,
  };

  // 하위 호환 (admin-portal 기존 함수명 그대로 유지)
  global.renderNoticesPage      = render;
  global.showNoticeComposeModal = compose;
  global.showNoticePreviewPopup = preview;
  global.editNotice             = edit;
  global.toggleNoticeSpecific   = toggleSpecific;
  global.getNoticeTargetCount   = getNoticeTargetCount;

})(window);
