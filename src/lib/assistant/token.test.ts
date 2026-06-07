import { describe, it, expect } from "vitest";
import {
  signAssistantToken,
  verifyAssistantToken,
  ASSISTANT_TOKEN_TTL_SECONDS,
} from "./token";

const base = {
  userId: "user_123",
  role: "CLIENT",
  clientId: "client_abc",
  tenantCode: "altibio",
};

describe("assistant scoped token", () => {
  const t0 = new Date(2026, 5, 6, 10, 0, 0);

  it("sign → verify 왕복: payload 보존", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    expect(issued).not.toBeNull();
    const p = verifyAssistantToken("Bearer " + issued!.token, t0);
    expect(p).not.toBeNull();
    expect(p!.sub).toBe("user_123");
    expect(p!.role).toBe("CLIENT");
    expect(p!.clientId).toBe("client_abc");
    expect(p!.scope).toBe("assistant-read");
    expect(issued!.expiresIn).toBe(ASSISTANT_TOKEN_TTL_SECONDS);
  });

  it("TTL 내(5분 후)에는 유효", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    const t5 = new Date(t0.getTime() + 5 * 60 * 1000);
    expect(verifyAssistantToken("Bearer " + issued!.token, t5)).not.toBeNull();
  });

  it("만료(11분 후)는 거부", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    const t11 = new Date(t0.getTime() + 11 * 60 * 1000);
    expect(verifyAssistantToken("Bearer " + issued!.token, t11)).toBeNull();
  });

  it("서명 위변조 거부", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    const tampered = issued!.token.slice(0, -2) + "xy";
    expect(verifyAssistantToken("Bearer " + tampered, t0)).toBeNull();
  });

  it("payload 위변조(서명 불일치) 거부 — clientId 바꿔치기 시도", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    const parts = issued!.token.split(".");
    const body = parts[0]!;
    const sig = parts[1]!;
    const decoded = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    decoded.clientId = "client_OTHER"; // 다른 거래처로 escalation 시도
    const forgedBody = Buffer.from(JSON.stringify(decoded), "utf8").toString(
      "base64url",
    );
    // 기존 서명을 그대로 붙여도(키 모름) 서명 검증 실패해야 함
    expect(
      verifyAssistantToken("Bearer " + forgedBody + "." + sig, t0),
    ).toBeNull();
  });

  it("Bearer 누락/형식오류 거부", () => {
    const issued = signAssistantToken({ ...base, now: t0 });
    expect(verifyAssistantToken(null, t0)).toBeNull();
    expect(verifyAssistantToken(issued!.token, t0)).toBeNull(); // Bearer 접두사 없음
    expect(verifyAssistantToken("Bearer notatoken", t0)).toBeNull();
    expect(verifyAssistantToken("Bearer .", t0)).toBeNull();
  });
});
