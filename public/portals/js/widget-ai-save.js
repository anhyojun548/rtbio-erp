/**
 * 위젯 AI 저장 (B2) — windyflo 가 만든 WidgetSpec 을 "포털(로그인 세션)" 이 본인 대시보드에 저장.
 *
 * windyflo 의 변수 치환 한계(overrideConfig.vars 미해소) 우회:
 *  - windyflo 에이전트는 spec 을 만들고 dry-run 미리보기만 한다 (저장 X).
 *  - 에이전트가 최종 WidgetSpec 을 ```json 블록으로 출력하면,
 *    이 모듈이 챗 메시지에서 그 spec 을 추출해 "✅ 이 위젯 저장" 버튼을 활성화.
 *  - 클릭 시 사용자 쿠키 세션으로 POST /api/dashboard/widgets/spec → 서버가 본인 대시보드에 저장.
 *  → forUser·토큰·변수치환 전부 불필요.
 *
 * flowise-embed observersConfig.observeMessages 로 메시지를 받는다 (shadow DOM 안 건드림).
 */
(function () {
  "use strict";

  var currentSpec = null;

  function isWidgetSpec(o) {
    return (
      o &&
      typeof o === "object" &&
      typeof o.title === "string" &&
      typeof o.kind === "string" &&
      o.data &&
      typeof o.data === "object" &&
      typeof o.data.source === "string"
    );
  }

  /** 봇 메시지들에서 마지막 유효 WidgetSpec(```json 블록) 추출. {spec:{...}} / {...} 둘 다 허용. */
  function extractSpec(messages) {
    if (!Array.isArray(messages)) return null;
    var found = null;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!m) continue;
      if (m.type && m.type !== "apiMessage") continue; // 봇 메시지만
      var text = typeof m.message === "string" ? m.message : typeof m === "string" ? m : "";
      if (!text) continue;
      var re = /```json\s*([\s\S]*?)```/g;
      var mm;
      while ((mm = re.exec(text)) !== null) {
        try {
          var obj = JSON.parse(mm[1]);
          var cand =
            obj && obj.spec && isWidgetSpec(obj.spec)
              ? obj.spec
              : isWidgetSpec(obj)
                ? obj
                : null;
          if (cand) found = cand; // 항상 최신 것으로 갱신
        } catch (e) {
          /* 부분/비-spec json 무시 */
        }
      }
    }
    return found;
  }

  function setStatus(text, color) {
    var s = document.getElementById("windyfloSaveStatus");
    if (s) {
      s.textContent = text;
      s.style.color = color || "#6b7280";
    }
  }

  function setBtnEnabled(en) {
    var btn = document.getElementById("windyfloSaveBtn");
    if (!btn) return;
    btn.disabled = !en;
    btn.style.opacity = en ? "1" : "0.5";
    btn.style.cursor = en ? "pointer" : "not-allowed";
  }

  /** observeMessages 콜백 — spec 발견 시 버튼 활성. */
  function onMessages(messages) {
    var spec = extractSpec(messages);
    if (spec) {
      currentSpec = spec;
      setBtnEnabled(true);
      setStatus('"' + spec.title + '" 저장 준비됨 — 버튼을 누르세요.', "#1B7F4B");
    }
  }

  function save() {
    if (!currentSpec) return;
    setBtnEnabled(false);
    setStatus("저장 중…", "#6b7280");
    fetch("/api/dashboard/widgets/spec", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: currentSpec }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          setStatus("✅ 저장 완료! 대시보드를 새로고침합니다…", "#1B7F4B");
          setTimeout(function () {
            location.reload();
          }, 1100);
        } else {
          var msg =
            (res.j && (res.j.error || res.j.message)) ||
            "저장 실패 (HTTP " + res.status + ")";
          setStatus("❌ " + msg, "#B42318");
          setBtnEnabled(true);
        }
      })
      .catch(function (e) {
        setStatus("❌ 저장 요청 실패: " + (e && e.message ? e.message : e), "#B42318");
        setBtnEnabled(true);
      });
  }

  /** 피커(.picker-ai)에 저장 버튼 바 주입 (idempotent). */
  function injectUI() {
    var host = document.querySelector(".picker-ai");
    if (!host || document.getElementById("windyfloSaveBar")) return;
    var bar = document.createElement("div");
    bar.className = "picker-ai-save";
    bar.id = "windyfloSaveBar";
    bar.style.cssText = "display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;";
    var btn = document.createElement("button");
    btn.id = "windyfloSaveBtn";
    btn.type = "button";
    btn.textContent = "✅ 이 위젯 저장";
    btn.style.cssText =
      "padding:8px 16px;border:0;border-radius:6px;background:#1B3A5C;color:#fff;font-weight:600;opacity:0.5;cursor:not-allowed;";
    btn.disabled = true;
    btn.addEventListener("click", save);
    var status = document.createElement("span");
    status.id = "windyfloSaveStatus";
    status.style.cssText = "font-size:13px;color:#6b7280;";
    status.textContent = "AI가 위젯을 만들면 저장 버튼이 활성화됩니다.";
    bar.appendChild(btn);
    bar.appendChild(status);
    host.appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectUI);
  } else {
    injectUI();
  }

  window.WidgetAiSave = { onMessages: onMessages, save: save, _extract: extractSpec };
})();
