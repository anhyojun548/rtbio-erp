import { describe, expect, it } from "vitest";
import { canAccessPath } from "./rbac";

describe("canAccessPath — /portals/*.html", () => {
  it("TENANT_OWNER 는 모든 포털 HTML 접근", () => {
    for (const p of ["admin", "qc", "exec", "ceo", "client"]) {
      expect(canAccessPath("TENANT_OWNER", `/portals/${p}-portal.html`)).toBe(true);
    }
  });
  it("SUPER_ADMIN 도 모든 포털 HTML 접근", () => {
    for (const p of ["admin", "qc", "exec", "ceo", "client"]) {
      expect(canAccessPath("SUPER_ADMIN", `/portals/${p}-portal.html`)).toBe(true);
    }
  });
  it("ADMIN → admin-portal 만, qc/exec/ceo/client 차단", () => {
    expect(canAccessPath("ADMIN", "/portals/admin-portal.html")).toBe(true);
    expect(canAccessPath("ADMIN", "/portals/qc-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/exec-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/ceo-portal.html")).toBe(false);
    expect(canAccessPath("ADMIN", "/portals/client-portal.html")).toBe(false);
  });
  it("QC → qc-portal 만", () => {
    expect(canAccessPath("QC", "/portals/qc-portal.html")).toBe(true);
    expect(canAccessPath("QC", "/portals/admin-portal.html")).toBe(false);
    expect(canAccessPath("QC", "/portals/ceo-portal.html")).toBe(false);
  });
  it("EXEC → exec-portal 만", () => {
    expect(canAccessPath("EXEC", "/portals/exec-portal.html")).toBe(true);
    expect(canAccessPath("EXEC", "/portals/admin-portal.html")).toBe(false);
  });
  it("CLIENT → client-portal 만", () => {
    expect(canAccessPath("CLIENT", "/portals/client-portal.html")).toBe(true);
    expect(canAccessPath("CLIENT", "/portals/admin-portal.html")).toBe(false);
  });
  it("정적 자원(css/js) 과 index/widget-dashboard 는 인증된 모든 역할 허용", () => {
    for (const role of ["TENANT_OWNER", "ADMIN", "QC", "EXEC", "CLIENT", "SUPER_ADMIN"] as const) {
      expect(canAccessPath(role, "/portals/css/shared.css")).toBe(true);
      expect(canAccessPath(role, "/portals/js/data.js")).toBe(true);
      expect(canAccessPath(role, "/portals/index.html")).toBe(true);
      expect(canAccessPath(role, "/portals/widget-dashboard.html")).toBe(true);
    }
  });
});
