import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidApiToken, SERVICE_PRINCIPAL, isTokenWriteAllowed } from "./api-auth";

describe("isValidApiToken", () => {
  beforeEach(() => {
    vi.stubEnv("WIDGET_API_TOKEN", "secret-abc");
  });
  it("정확히 일치하면 true", () => expect(isValidApiToken("Bearer secret-abc")).toBe(true));
  it("불일치 false", () => expect(isValidApiToken("Bearer nope")).toBe(false));
  it("형식 불량/누락 false", () => {
    expect(isValidApiToken("secret-abc")).toBe(false);
    expect(isValidApiToken(null)).toBe(false);
    expect(isValidApiToken("")).toBe(false);
  });
  it("env 미설정이면 항상 false", () => {
    vi.stubEnv("WIDGET_API_TOKEN", "");
    expect(isValidApiToken("Bearer anything")).toBe(false);
  });
});

describe("SERVICE_PRINCIPAL", () => {
  it("고정 서비스 유저", () => {
    expect(SERVICE_PRINCIPAL.userId).toBe("svc-integration");
    expect(SERVICE_PRINCIPAL.role).toBe("ADMIN");
  });
});

describe("isTokenWriteAllowed", () => {
  it("GET 항상 허용", () => expect(isTokenWriteAllowed("GET", "/api/clients")).toBe(true));
  it("HEAD 허용", () => expect(isTokenWriteAllowed("HEAD", "/api/x")).toBe(true));
  it("위젯 spec POST 허용", () =>
    expect(isTokenWriteAllowed("POST", "/api/dashboard/widgets/spec")).toBe(true));
  it("그 외 쓰기 거부", () => {
    expect(isTokenWriteAllowed("POST", "/api/orders")).toBe(false);
    expect(isTokenWriteAllowed("DELETE", "/api/clients/1")).toBe(false);
  });
});
