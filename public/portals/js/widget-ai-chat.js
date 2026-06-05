/**
 * 커스텀 위젯-AI 챗 (RTBIO 네이티브) — windyflo flowise-embed 대체.
 *
 * - windyflo prediction API 를 포털에서 직접 호출(CORS 허용 확인됨). 멀티턴은 chatId 유지.
 * - AI 가 ```json WidgetSpec 을 출력하면 미리보기 카드 + "저장" 버튼으로 변환.
 * - 저장은 로그인 세션으로 POST /api/dashboard/widgets/spec (B2 플로우 유지).
 *
 * 마운트: .picker-ai 안의 #wac (없으면 .picker-ai 직접). 1회 빌드 + "새 대화" 리셋.
 */
(function () {
  "use strict";

  var CHATFLOW_ID = "e06fd2ea-da9f-4140-8502-5a171a664db8";
  var PREDICTION_URL = "https://www.windyflo.com/api/v1/prediction/" + CHATFLOW_ID;
  var SAVE_URL = "/api/dashboard/widgets/spec";

  var CHIPS = [
    "이번 달 거래처별 매출 막대그래프",
    "재고 부족 Top 10 표",
    "최근 6개월 매출 추이 라인차트",
  ];

  var state = { chatId: null, busy: false, mounted: false };

  // ── 유틸 ────────────────────────────────────────────────
  function newChatId() {
    return "wac-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtNum(n) {
    var v = Number(n);
    if (!isFinite(v)) return String(n);
    return v.toLocaleString("ko-KR");
  }

  // ```json/``` 코드펜스 제거 → 남은 prose
  function stripCodeFences(text) {
    return String(text || "").replace(/```[\s\S]*?```/g, "").trim();
  }

  // 경량 마크다운 → HTML (escape 먼저)
  function renderLite(text) {
    var t = esc(stripCodeFences(text));
    t = t.replace(/^[ \t]*#{1,6}[ \t]*(.+)$/gm, '<span class="wac-h">$1</span>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/^[ \t]*[-•][ \t]+(.+)$/gm, "<span class=\"wac-li\">$1</span>");
    t = t.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
    return t;
  }

  function isWidgetSpec(o) {
    return (
      o && typeof o === "object" &&
      typeof o.title === "string" && typeof o.kind === "string" &&
      o.data && typeof o.data === "object" && typeof o.data.source === "string"
    );
  }
  // 텍스트의 ```json 블록들에서 마지막 유효 WidgetSpec 추출
  function extractSpec(text) {
    var re = /```json\s*([\s\S]*?)```/g, mm, found = null;
    while ((mm = re.exec(String(text || ""))) !== null) {
      try {
        var obj = JSON.parse(mm[1]);
        var cand = obj && obj.spec && isWidgetSpec(obj.spec) ? obj.spec : isWidgetSpec(obj) ? obj : null;
        if (cand) found = cand;
      } catch (e) { /* 부분 json 무시 */ }
    }
    return found;
  }

  // ── DOM refs ────────────────────────────────────────────
  var root, msgsEl, inputEl, sendBtn;

  function scrollDown() {
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addUser(text) {
    var row = el("div", "wac-row user");
    row.appendChild(el("div", "wac-msg user", esc(text)));
    msgsEl.appendChild(row);
    scrollDown();
  }

  function addAi(html) {
    var row = el("div", "wac-row ai");
    var av = el("div", "wac-av", "◆");
    var msg = el("div", "wac-msg ai", html);
    row.appendChild(av);
    row.appendChild(msg);
    msgsEl.appendChild(row);
    scrollDown();
    return msg;
  }

  function addTyping() {
    var row = el("div", "wac-row ai", '');
    row.id = "wac-typing";
    row.appendChild(el("div", "wac-av", "◆"));
    row.appendChild(el("div", "wac-msg ai wac-typing", '<span></span><span></span><span></span>'));
    msgsEl.appendChild(row);
    scrollDown();
  }
  function removeTyping() {
    var t = document.getElementById("wac-typing");
    if (t) t.remove();
  }

  // 위젯 미리보기 카드 (spec → 카드 + dry-run 미리보기 + 저장 버튼)
  var KIND_LABEL = {
    kpi: "KPI", bar: "막대그래프", hbar: "가로막대", line: "라인차트",
    pie: "파이차트", donut: "도넛차트", table: "표", gauge: "게이지",
  };
  function renderSpecCard(spec) {
    var card = el("div", "wac-card");
    var head = el("div", "wac-card-head");
    head.appendChild(el("div", "wac-card-title", esc(spec.title || "위젯")));
    head.appendChild(el("span", "wac-badge", esc(KIND_LABEL[spec.kind] || spec.kind)));
    card.appendChild(head);
    card.appendChild(el("div", "wac-card-meta", "데이터 소스 · " + esc(spec.data && spec.data.source)));
    var prev = el("div", "wac-card-preview", '<span class="wac-dim">미리보기 불러오는 중…</span>');
    card.appendChild(prev);
    var actions = el("div", "wac-card-actions");
    var btn = el("button", "wac-save", "✅ 대시보드에 저장");
    btn.type = "button";
    var status = el("span", "wac-save-status", "");
    btn.addEventListener("click", function () { save(spec, btn, status); });
    actions.appendChild(btn);
    actions.appendChild(status);
    card.appendChild(actions);
    msgsEl.appendChild(el("div", "wac-row ai card-row")).appendChild(card);
    scrollDown();
    dryRun(spec, prev);
  }

  function dryRun(spec, prevEl) {
    fetch(SAVE_URL, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: spec, dryRunOnly: true }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) {
          prevEl.innerHTML = '<span class="wac-dim">미리보기를 가져오지 못했습니다.</span>';
          return;
        }
        var p = j.preview || {};
        if (Array.isArray(p.series) && p.series.length) {
          var top = p.series.slice(0, 3).map(function (s, i) {
            return '<div class="wac-prev-row"><span class="wac-prev-rank">' + (i + 1) + '</span>' +
              '<span class="wac-prev-label">' + esc(s.label) + '</span>' +
              '<span class="wac-prev-val">' + fmtNum(s.value) + '</span></div>';
          }).join("");
          prevEl.innerHTML = top + (p.series.length > 3 ? '<div class="wac-dim">외 ' + (p.series.length - 3) + '건</div>' : '');
        } else if (typeof p.value === "number") {
          prevEl.innerHTML = '<div class="wac-prev-kpi">' + fmtNum(p.value) + '</div>';
        } else {
          prevEl.innerHTML = '<span class="wac-dim">표시할 데이터가 없습니다 (조건/기간 확인).</span>';
        }
      })
      .catch(function () {
        prevEl.innerHTML = '<span class="wac-dim">미리보기 요청 실패.</span>';
      });
  }

  function save(spec, btn, status) {
    btn.disabled = true;
    status.textContent = "저장 중…";
    status.style.color = "#6b7280";
    fetch(SAVE_URL, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: spec }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          status.textContent = "✅ 저장 완료! 새로고침…";
          status.style.color = "#1B7F4B";
          setTimeout(function () { location.reload(); }, 1000);
        } else {
          var msg = (res.j && (res.j.error || res.j.message)) || ("저장 실패 (HTTP " + res.status + ")");
          status.textContent = "❌ " + msg;
          status.style.color = "#B42318";
          btn.disabled = false;
        }
      })
      .catch(function (e) {
        status.textContent = "❌ 저장 실패: " + (e && e.message ? e.message : e);
        status.style.color = "#B42318";
        btn.disabled = false;
      });
  }

  // ── 전송 ────────────────────────────────────────────────
  function setBusy(b) {
    state.busy = b;
    if (sendBtn) sendBtn.disabled = b;
    if (inputEl) inputEl.disabled = b;
  }

  function send(text) {
    text = (text || "").trim();
    if (!text || state.busy) return;
    inputEl.value = "";
    autoGrow();
    addUser(text);
    setBusy(true);
    addTyping();
    fetch(PREDICTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, chatId: state.chatId, streaming: false }),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (j) {
        removeTyping();
        setBusy(false);
        var reply = j && (j.text || j.message || (typeof j === "string" ? j : ""));
        if (!reply) { addAi('<span class="wac-dim">응답을 받지 못했습니다. 다시 시도해 주세요.</span>'); return; }
        var prose = stripCodeFences(reply);
        if (prose) addAi(renderLite(reply));
        var spec = extractSpec(reply);
        if (spec) renderSpecCard(spec);
        inputEl.focus();
      })
      .catch(function (e) {
        removeTyping();
        setBusy(false);
        addAi('<span class="wac-dim">오류: ' + esc(e && e.message ? e.message : String(e)) + '</span>');
      });
  }

  function welcome() {
    addAi(
      "안녕하세요! 만들고 싶은 위젯을 자연어로 말씀해 주세요.<br>" +
      '예: <code>"이번 달 거래처별 매출 막대그래프"</code>'
    );
    var chips = el("div", "wac-chips");
    CHIPS.forEach(function (c) {
      var b = el("button", "wac-chip", esc(c));
      b.type = "button";
      b.addEventListener("click", function () { inputEl.value = c; autoGrow(); inputEl.focus(); });
      chips.appendChild(b);
    });
    msgsEl.appendChild(el("div", "wac-row ai card-row")).appendChild(chips);
    scrollDown();
  }

  function reset() {
    state.chatId = newChatId();
    msgsEl.innerHTML = "";
    setBusy(false);
    welcome();
  }

  function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
  }

  // ── CSS ─────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById("wac-styles")) return;
    // 갤러리(.picker-section)와 동일한 24px 인셋 + RTBIO 디자인 토큰(teal 액센트)로 톤 통일.
    var css =
      ".ai-toggle,.ai-panel{display:none!important}" +
      ".picker-ai{padding:14px 24px 4px!important}" +
      ".picker-ai-head{display:none!important}" +
      "#wac,.wac{display:flex;flex-direction:column;height:420px;background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:var(--radius,12px);overflow:hidden;font-family:inherit}" +
      ".wac-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--border,#e5e7eb);background:var(--surface,#fff)}" +
      ".wac-head .wac-title{font-weight:700;font-size:13px;color:var(--text,#1A1A2E);display:flex;align-items:center;gap:7px}" +
      ".wac-head .wac-dot{width:7px;height:7px;border-radius:50%;background:var(--accent,#00A8B5);box-shadow:0 0 0 3px rgba(0,168,181,.18)}" +
      ".wac-reset{background:transparent;border:1px solid var(--border,#e5e7eb);color:var(--text-secondary,#6B7280);font-size:12px;padding:5px 11px;border-radius:7px;cursor:pointer;transition:all .12s}" +
      ".wac-reset:hover{border-color:var(--accent,#00A8B5);color:var(--accent-dark,#00838F);background:var(--accent-light,#E0F7FA)}" +
      ".wac-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:11px;background:var(--bg,#F8F9FB)}" +
      ".wac-row{display:flex;gap:8px;max-width:100%}" +
      ".wac-row.user{justify-content:flex-end}" +
      ".wac-row.ai{justify-content:flex-start}" +
      ".wac-av{flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:var(--accent,#00A8B5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;margin-top:2px}" +
      ".wac-msg{max-width:80%;padding:9px 13px;border-radius:13px;font-size:13px;line-height:1.6;word-break:break-word;white-space:normal}" +
      ".wac-msg.user{background:var(--accent,#00A8B5);color:#fff;border-bottom-right-radius:4px}" +
      ".wac-msg.ai{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);color:var(--text,#1A1A2E);border-bottom-left-radius:4px}" +
      ".wac-msg .wac-h{display:block;font-weight:700;color:var(--accent-dark,#00838F);margin:4px 0 2px}" +
      ".wac-msg .wac-li{display:block;padding-left:14px;position:relative}" +
      ".wac-msg .wac-li:before{content:'•';position:absolute;left:2px;color:var(--accent,#00A8B5)}" +
      ".wac-msg code{background:var(--accent-light,#E0F7FA);color:var(--accent-dark,#00838F);padding:1px 5px;border-radius:4px;font-size:12px}" +
      ".wac-typing{display:flex;gap:4px;align-items:center;padding:12px}" +
      ".wac-typing span{width:6px;height:6px;border-radius:50%;background:var(--text-muted,#9CA3AF);animation:wacb 1s infinite}" +
      ".wac-typing span:nth-child(2){animation-delay:.15s}.wac-typing span:nth-child(3){animation-delay:.3s}" +
      "@keyframes wacb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}" +
      ".wac-chips{display:flex;flex-wrap:wrap;gap:6px}" +
      ".wac-chip{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);color:var(--text-secondary,#6B7280);font-size:12px;padding:6px 11px;border-radius:16px;cursor:pointer;transition:all .12s}" +
      ".wac-chip:hover{background:var(--accent-light,#E0F7FA);border-color:var(--accent,#00A8B5);color:var(--accent-dark,#00838F)}" +
      ".wac-card{background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-sm,8px);padding:13px 14px;max-width:90%;box-shadow:0 1px 2px rgba(16,24,40,.05)}" +
      ".wac-card-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}" +
      ".wac-card-title{font-weight:700;color:var(--text,#1A1A2E);font-size:13px}" +
      ".wac-badge{background:var(--accent-light,#E0F7FA);color:var(--accent-dark,#00838F);font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}" +
      ".wac-card-meta{font-size:11.5px;color:var(--text-muted,#9CA3AF);margin-bottom:9px}" +
      ".wac-card-preview{background:var(--bg,#F8F9FB);border-radius:7px;padding:8px 10px;margin-bottom:11px;font-size:12.5px}" +
      ".wac-prev-row{display:flex;align-items:center;gap:8px;padding:2px 0}" +
      ".wac-prev-rank{flex:0 0 18px;width:18px;height:18px;border-radius:50%;background:var(--accent,#00A8B5);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center}" +
      ".wac-prev-label{flex:1;color:var(--text,#1A1A2E);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".wac-prev-val{font-weight:700;color:var(--accent-dark,#00838F);font-variant-numeric:tabular-nums}" +
      ".wac-prev-kpi{font-weight:800;font-size:20px;color:var(--accent-dark,#00838F);font-variant-numeric:tabular-nums}" +
      ".wac-dim{color:var(--text-muted,#9CA3AF)}" +
      ".wac-card-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
      ".wac-save{background:var(--accent,#00A8B5);border:0;color:#fff;font-weight:600;font-size:13px;padding:9px 16px;border-radius:8px;cursor:pointer;transition:background .12s}" +
      ".wac-save:hover{background:var(--accent-dark,#00838F)}.wac-save:disabled{opacity:.55;cursor:not-allowed}" +
      ".wac-save-status{font-size:12px}" +
      ".wac-input{display:flex;gap:8px;align-items:flex-end;padding:10px 12px;border-top:1px solid var(--border,#e5e7eb);background:var(--surface,#fff)}" +
      ".wac-input textarea{flex:1;resize:none;border:1px solid var(--border,#e5e7eb);border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;line-height:1.4;max-height:100px;outline:none;color:var(--text,#1A1A2E)}" +
      ".wac-input textarea:focus{border-color:var(--accent,#00A8B5);box-shadow:0 0 0 3px rgba(0,168,181,.14)}" +
      ".wac-send{flex:0 0 auto;background:var(--accent,#00A8B5);border:0;color:#fff;font-weight:600;font-size:13px;padding:10px 16px;border-radius:9px;cursor:pointer;transition:background .12s}" +
      ".wac-send:hover{background:var(--accent-dark,#00838F)}.wac-send:disabled{opacity:.5;cursor:not-allowed}";
    var st = el("style");
    st.id = "wac-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── 마운트 ──────────────────────────────────────────────
  function mount() {
    if (state.mounted) return;
    var host = document.getElementById("wac") || document.querySelector(".picker-ai");
    if (!host) return;
    injectCss();

    root = el("div", "wac");
    var head = el("div", "wac-head");
    head.innerHTML =
      '<div class="wac-title"><span class="wac-dot"></span>AI 위젯 빌더</div>' +
      '<button type="button" class="wac-reset">↺ 새 대화</button>';
    root.appendChild(head);

    msgsEl = el("div", "wac-msgs");
    root.appendChild(msgsEl);

    var inp = el("div", "wac-input");
    inputEl = el("textarea");
    inputEl.rows = 1;
    inputEl.placeholder = "만들고 싶은 위젯을 입력하세요…";
    sendBtn = el("button", "wac-send", "전송");
    sendBtn.type = "button";
    inp.appendChild(inputEl);
    inp.appendChild(sendBtn);
    root.appendChild(inp);

    host.innerHTML = "";
    host.appendChild(root);

    sendBtn.addEventListener("click", function () { send(inputEl.value); });
    inputEl.addEventListener("input", autoGrow);
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inputEl.value); }
    });
    head.querySelector(".wac-reset").addEventListener("click", reset);

    state.mounted = true;
    reset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.WidgetAiChat = { mount: mount, reset: reset, _send: send, _extract: extractSpec };
})();
