/* ══════════════════════════════════════════
   Widget Builder — 갤러리 + (Phase B) 빌더
   ──────────────────────────────────────────
   widget-dashboard.js 의 spec 엔진/그리드 헬퍼를 재사용한다.
   - window.renderSpecResult / window.addSpecWidgetToGrid / window.closePicker / window.showToast
   ══════════════════════════════════════════ */
(function () {
'use strict';

var _catalog = null;       // data-catalog 캐시 (Phase B 에서 사용)
var _galleryCache = null;  // widget-schema.examples 캐시

/* ── 소형 헬퍼 ── */
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

var _KIND_LABELS = {
  kpi: 'KPI', bar: '세로 막대', hbar: '가로 막대', line: '선 그래프',
  pie: '파이', donut: '도넛', table: '표', gauge: '게이지'
};
function _kindLabel(kind) {
  return _KIND_LABELS[kind] || (kind || '위젯');
}

var _SOURCE_LABELS = {
  invoice: '거래명세서', payment: '수금', order: '주문', client: '거래처',
  product: '제품', inventory: '재고', ledger: '거래처원장', shipment: '출고'
};
function _sourceLabel(source) {
  return _SOURCE_LABELS[source] || (source || '');
}

/* ── 갤러리: prefab spec 카드 ── */
async function loadGallery() {
  var grid = document.getElementById('galleryGrid');
  if (!grid) return;
  try {
    var r = await fetch('/api/dashboard/widget-schema', { credentials: 'same-origin' });
    var j = await r.json();
    _galleryCache = (j && j.examples) || {};
    var keys = Object.keys(_galleryCache);
    if (!keys.length) { grid.innerHTML = '<div class="gallery-loading">갤러리가 비어 있습니다</div>'; return; }
    grid.innerHTML = keys.map(function (key) {
      var spec = _galleryCache[key];
      return '<button class="gallery-card" data-key="' + _esc(key) + '">' +
        '<span class="gallery-card-kind">' + _esc(_kindLabel(spec.kind)) + '</span>' +
        '<span class="gallery-card-title">' + _esc(spec.title) + '</span>' +
        '<span class="gallery-card-sub">' + _esc(spec.subtitle || _sourceLabel(spec.data && spec.data.source)) + '</span>' +
        '</button>';
    }).join('');
    grid.querySelectorAll('.gallery-card').forEach(function (btn) {
      btn.addEventListener('click', function () { addFromGallery(btn.dataset.key); });
    });
  } catch (e) {
    grid.innerHTML = '<div class="gallery-loading">갤러리 로드 실패</div>';
    // eslint-disable-next-line no-console
    console.warn('[widget-builder] 갤러리 로드 실패', e);
  }
}

/* ── 카드 클릭 → spec 저장 + 그리드 추가 ── */
async function addFromGallery(key) {
  var spec = _galleryCache[key];
  if (!spec) return;
  try {
    var r = await fetch('/api/dashboard/widgets/spec', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: spec }),
    });
    var j = await r.json();
    if (!r.ok || !j.ok) { window.showToast('추가 실패: ' + ((j.validationErrors && j.validationErrors[0] && j.validationErrors[0].message) || j.error || '')); return; }
    window.addSpecWidgetToGrid(j.spec, j.id);
    window.closePicker(); window.showToast('"' + spec.title + '" 위젯을 추가했습니다');
  } catch (e) { window.showToast('네트워크 오류'); }
}

/* ── 갤러리 lazy-load 훅 — openPicker 가 호출 ── */
document.addEventListener('DOMContentLoaded', function () {
  window.onPickerOpen = function () { if (!_galleryCache) loadGallery(); };
});

})();
