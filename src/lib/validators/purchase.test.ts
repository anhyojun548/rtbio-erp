import { describe, it, expect } from "vitest";
import {
  calcPurchaseLine,
  createPurchaseEntrySchema,
  purchaseLineSchema,
} from "./purchase";

describe("calcPurchaseLine", () => {
  it("과세 — supply=수량×단가, VAT=round(supply×0.1)", () => {
    // 실제 라이브 매입 1건과 동일 케이스
    const r = calcPurchaseLine(3, 13191, "과세");
    expect(r.supply).toBe(39573);
    expect(r.vat).toBe(3957); // round(3957.3)
    expect(r.total).toBe(43530);
  });

  it("면세 — VAT 0", () => {
    const r = calcPurchaseLine(10, 5000, "면세");
    expect(r.supply).toBe(50000);
    expect(r.vat).toBe(0);
    expect(r.total).toBe(50000);
  });

  it("영세 — VAT 0", () => {
    const r = calcPurchaseLine(2, 1000, "영세");
    expect(r.vat).toBe(0);
    expect(r.total).toBe(2000);
  });

  it("vatRate override (0.08)", () => {
    const r = calcPurchaseLine(10, 1000, "과세", 0.08);
    expect(r.supply).toBe(10000);
    expect(r.vat).toBe(800);
    expect(r.total).toBe(10800);
  });

  it("단가 0 — supply/vat/total 모두 0", () => {
    const r = calcPurchaseLine(28, 0, "과세");
    expect(r.supply).toBe(0);
    expect(r.vat).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe("purchaseLineSchema", () => {
  it("정상 라인 파싱 + 선택값 빈문자 → undefined", () => {
    const r = purchaseLineSchema.parse({
      productName: "  RECOTAP L  ",
      spec: "",
      qty: "3",
      unitPrice: "13191",
    });
    expect(r.productName).toBe("RECOTAP L"); // trim
    expect(r.spec).toBeUndefined();
    expect(r.qty).toBe(3); // coerce
    expect(r.unitPrice).toBe(13191);
  });

  it("수량 0 이하 거부", () => {
    expect(purchaseLineSchema.safeParse({ productName: "X", qty: 0, unitPrice: 100 }).success).toBe(false);
    expect(purchaseLineSchema.safeParse({ productName: "X", qty: -1, unitPrice: 100 }).success).toBe(false);
  });

  it("단가 음수 거부, 0 은 허용", () => {
    expect(purchaseLineSchema.safeParse({ productName: "X", qty: 1, unitPrice: -1 }).success).toBe(false);
    expect(purchaseLineSchema.safeParse({ productName: "X", qty: 1, unitPrice: 0 }).success).toBe(true);
  });

  it("품목명 필수", () => {
    expect(purchaseLineSchema.safeParse({ productName: "", qty: 1, unitPrice: 100 }).success).toBe(false);
  });
});

describe("createPurchaseEntrySchema", () => {
  const base = {
    date: "2026-06-08",
    supplier: "주식회사 건우나인",
    lines: [{ productName: "RECOTAP L", qty: 3, unitPrice: 13191 }],
  };

  it("정상 — taxType 기본 과세", () => {
    const r = createPurchaseEntrySchema.parse(base);
    expect(r.taxType).toBe("과세");
    expect(r.lines).toHaveLength(1);
  });

  it("날짜 형식 검증 (YYYY-MM-DD)", () => {
    expect(createPurchaseEntrySchema.safeParse({ ...base, date: "2026/06/08" }).success).toBe(false);
    expect(createPurchaseEntrySchema.safeParse({ ...base, date: "20260608" }).success).toBe(false);
  });

  it("공급처 필수", () => {
    expect(createPurchaseEntrySchema.safeParse({ ...base, supplier: "" }).success).toBe(false);
  });

  it("라인 1개 이상 필수", () => {
    expect(createPurchaseEntrySchema.safeParse({ ...base, lines: [] }).success).toBe(false);
  });

  it("taxType 잘못된 값 거부", () => {
    expect(createPurchaseEntrySchema.safeParse({ ...base, taxType: "VAT" }).success).toBe(false);
  });
});
