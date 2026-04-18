/**
 * RBAC 매트릭스 단위 테스트.
 * 미들웨어 없이 순수 함수 `canAccessPath()` 만 검증.
 */
import { describe, it, expect } from "vitest";
import { canAccessPath } from "./rbac";

describe("canAccessPath — RBAC matrix", () => {
  describe("/admin", () => {
    it("TENANT_OWNER, ADMIN 허용", () => {
      expect(canAccessPath("TENANT_OWNER", "/admin")).toBe(true);
      expect(canAccessPath("ADMIN", "/admin")).toBe(true);
      expect(canAccessPath("ADMIN", "/admin/clients")).toBe(true);
    });
    it("QC, EXEC, CLIENT 차단", () => {
      expect(canAccessPath("QC", "/admin")).toBe(false);
      expect(canAccessPath("EXEC", "/admin")).toBe(false);
      expect(canAccessPath("CLIENT", "/admin")).toBe(false);
    });
  });

  describe("/qc", () => {
    it("TENANT_OWNER, QC 허용", () => {
      expect(canAccessPath("TENANT_OWNER", "/qc")).toBe(true);
      expect(canAccessPath("QC", "/qc/kanban")).toBe(true);
    });
    it("ADMIN, EXEC 차단 (경영지원은 QC 포털 직접 접근 불가 — 커뮤니케이션은 별도)", () => {
      expect(canAccessPath("ADMIN", "/qc")).toBe(false);
      expect(canAccessPath("EXEC", "/qc")).toBe(false);
    });
  });

  describe("/exec", () => {
    it("TENANT_OWNER, ADMIN, EXEC 허용", () => {
      expect(canAccessPath("TENANT_OWNER", "/exec")).toBe(true);
      expect(canAccessPath("ADMIN", "/exec")).toBe(true);
      expect(canAccessPath("EXEC", "/exec/clients")).toBe(true);
    });
    it("QC, CLIENT 차단", () => {
      expect(canAccessPath("QC", "/exec")).toBe(false);
      expect(canAccessPath("CLIENT", "/exec")).toBe(false);
    });
  });

  describe("/client", () => {
    it("CLIENT 만 허용", () => {
      expect(canAccessPath("CLIENT", "/client")).toBe(true);
      expect(canAccessPath("CLIENT", "/client/order")).toBe(true);
    });
    it("내부 역할(ADMIN, QC, EXEC, TENANT_OWNER) 차단", () => {
      expect(canAccessPath("ADMIN", "/client")).toBe(false);
      expect(canAccessPath("QC", "/client")).toBe(false);
      expect(canAccessPath("EXEC", "/client")).toBe(false);
      expect(canAccessPath("TENANT_OWNER", "/client")).toBe(false);
    });
  });

  describe("/ceo", () => {
    it("TENANT_OWNER, SUPER_ADMIN 허용", () => {
      expect(canAccessPath("TENANT_OWNER", "/ceo")).toBe(true);
      expect(canAccessPath("SUPER_ADMIN", "/ceo")).toBe(true);
    });
    it("일반 내부 역할 차단", () => {
      expect(canAccessPath("ADMIN", "/ceo")).toBe(false);
      expect(canAccessPath("QC", "/ceo")).toBe(false);
    });
  });

  describe("/system", () => {
    it("SUPER_ADMIN 만 허용", () => {
      expect(canAccessPath("SUPER_ADMIN", "/system")).toBe(true);
    });
    it("TENANT_OWNER 포함 모두 차단", () => {
      expect(canAccessPath("TENANT_OWNER", "/system")).toBe(false);
      expect(canAccessPath("ADMIN", "/system")).toBe(false);
    });
  });

  describe("일반 경로 (매트릭스 없음)", () => {
    it("매트릭스에 없는 경로는 통과 (페이지별 guard 로 위임)", () => {
      expect(canAccessPath("CLIENT", "/profile")).toBe(true);
      expect(canAccessPath("QC", "/dashboard")).toBe(true);
    });
  });

  describe("prefix 엄격성", () => {
    it("/admin 은 /admin2 에 매칭 안 됨", () => {
      // /admin2 는 매트릭스에 없으므로 true 반환 (매트릭스 없는 경로는 통과)
      expect(canAccessPath("CLIENT", "/admin2")).toBe(true);
    });
    it("/admin 은 /administrator 와 혼동 안 됨", () => {
      expect(canAccessPath("CLIENT", "/administrator")).toBe(true);
    });
  });
});
