/*
 * RTBIO 문서 사이트 — 다이어그램 확대/축소 모달
 * 각 .diagram 컨테이너에 클릭 핸들러를 부착 → 모달에서 SVG 확대/축소/이동
 */
(function () {
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 8;

  function waitAndEnhance(tries) {
    const diagrams = document.querySelectorAll('.diagram');
    if (!diagrams.length) return;
    // 모든 다이어그램에 SVG 가 렌더링되었는지 확인 (Mermaid 비동기)
    const ready = Array.from(diagrams).every(d => d.querySelector('svg'));
    if (!ready && tries < 40) {
      setTimeout(() => waitAndEnhance(tries + 1), 150);
      return;
    }
    enhance();
  }

  function enhance() {
    document.querySelectorAll('.diagram').forEach(d => {
      if (d.dataset.zoomInit === '1') return;
      d.dataset.zoomInit = '1';
      d.style.cursor = 'zoom-in';

      const hint = document.createElement('button');
      hint.className = 'diagram-zoom-hint';
      hint.type = 'button';
      hint.innerHTML = '🔍 확대';
      hint.addEventListener('click', e => {
        e.stopPropagation();
        openModal(d);
      });
      d.appendChild(hint);

      d.addEventListener('click', e => {
        // 링크/버튼 클릭이 아닐 때만
        if (e.target.closest('a, button') && !e.target.classList.contains('diagram-zoom-hint')) return;
        openModal(d);
      });
    });
  }

  function openModal(diagramEl) {
    const svg = diagramEl.querySelector('svg');
    if (!svg) return;

    const modal = document.createElement('div');
    modal.className = 'diagram-modal';
    modal.innerHTML = `
      <div class="diagram-modal-toolbar">
        <button type="button" data-action="zoom-out" title="축소 ( - )">−</button>
        <span class="diagram-modal-zoom">100%</span>
        <button type="button" data-action="zoom-in" title="확대 ( + )">+</button>
        <div class="diagram-modal-sep"></div>
        <button type="button" data-action="fit" title="화면 맞춤 ( 0 )">⤢</button>
        <button type="button" data-action="reset" title="원본 크기 ( 1 )">1:1</button>
        <div class="diagram-modal-sep"></div>
        <button type="button" data-action="close" class="close" title="닫기 (ESC)">✕</button>
      </div>
      <div class="diagram-modal-stage">
        <div class="diagram-modal-canvas"></div>
      </div>
      <div class="diagram-modal-hint">
        <kbd>휠</kbd> 확대/축소 · <kbd>드래그</kbd> 이동 · <kbd>+ / −</kbd> 버튼 · <kbd>0</kbd> 맞춤 · <kbd>ESC</kbd> 닫기
      </div>
    `;
    const canvas = modal.querySelector('.diagram-modal-canvas');
    const stage = modal.querySelector('.diagram-modal-stage');
    const zoomLabel = modal.querySelector('.diagram-modal-zoom');

    // SVG 복제 (원본은 페이지에 유지)
    const cloned = svg.cloneNode(true);
    // Mermaid 가 설정한 max-width 제거 → 스케일 자유
    cloned.style.maxWidth = 'none';
    cloned.style.maxHeight = 'none';
    cloned.style.width = svg.getBoundingClientRect().width + 'px';
    cloned.style.height = svg.getBoundingClientRect().height + 'px';
    canvas.appendChild(cloned);

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    let scale = 1, tx = 0, ty = 0;
    function apply() {
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }
    function fit() {
      const sw = cloned.getBoundingClientRect().width / (scale || 1);
      const sh = cloned.getBoundingClientRect().height / (scale || 1);
      const ow = stage.clientWidth - 48;
      const oh = stage.clientHeight - 48;
      scale = Math.min(ow / sw, oh / sh, 4);
      tx = 0; ty = 0;
      apply();
    }
    function zoomBy(factor, cx, cy) {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
      if (typeof cx === 'number' && typeof cy === 'number') {
        const rect = stage.getBoundingClientRect();
        const px = cx - rect.left - rect.width / 2;
        const py = cy - rect.top - rect.height / 2;
        tx = (tx - px) * (next / scale) + px;
        ty = (ty - py) * (next / scale) + py;
      }
      scale = next;
      apply();
    }

    // 초기에 화면 맞춤
    requestAnimationFrame(() => requestAnimationFrame(fit));

    // 툴바
    modal.querySelector('[data-action="zoom-in"]').addEventListener('click', () => zoomBy(1.25));
    modal.querySelector('[data-action="zoom-out"]').addEventListener('click', () => zoomBy(1 / 1.25));
    modal.querySelector('[data-action="fit"]').addEventListener('click', fit);
    modal.querySelector('[data-action="reset"]').addEventListener('click', () => { scale = 1; tx = 0; ty = 0; apply(); });
    modal.querySelector('[data-action="close"]').addEventListener('click', close);

    // 휠 줌
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomBy(factor, e.clientX, e.clientY);
    }, { passive: false });

    // 드래그 이동
    let dragging = false, sx = 0, sy = 0;
    stage.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX - tx;
      sy = e.clientY - ty;
      stage.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    function onMove(e) {
      if (!dragging) return;
      tx = e.clientX - sx;
      ty = e.clientY - sy;
      apply();
    }
    function onUp() {
      dragging = false;
      stage.style.cursor = 'grab';
    }

    // 터치 (핀치 줌 + 팬)
    let lastTouchDist = 0, lastTouchX = 0, lastTouchY = 0;
    stage.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastTouchDist = touchDist(e.touches);
      } else if (e.touches.length === 1) {
        dragging = true;
        sx = e.touches[0].clientX - tx;
        sy = e.touches[0].clientY - ty;
      }
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = touchDist(e.touches);
        if (lastTouchDist) {
          const mid = touchMid(e.touches);
          zoomBy(d / lastTouchDist, mid.x, mid.y);
        }
        lastTouchDist = d;
      } else if (e.touches.length === 1 && dragging) {
        tx = e.touches[0].clientX - sx;
        ty = e.touches[0].clientY - sy;
        apply();
      }
    }, { passive: false });
    stage.addEventListener('touchend', () => {
      dragging = false;
      lastTouchDist = 0;
    });
    function touchDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    function touchMid(t) { return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 }; }

    // 배경 클릭 → 닫기
    stage.addEventListener('click', e => {
      if (e.target === stage) close();
    });

    // 키보드
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === '+' || e.key === '=') zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.25);
      else if (e.key === '0') fit();
      else if (e.key === '1') { scale = 1; tx = 0; ty = 0; apply(); }
    }
    document.addEventListener('keydown', onKey);

    function close() {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      modal.remove();
      document.body.style.overflow = '';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => waitAndEnhance(0), 250));
  } else {
    setTimeout(() => waitAndEnhance(0), 250);
  }
})();
