/**
 * invoice.ts Zod 스키마 + VAT 계산 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  createInvoiceFromOrderSchema,
  updateInvoiceDraftSchema,
  issueInvoiceSchema,
  markInvoiceSentSchema,
  cancelInvoiceSchema,
  calcVatTotal,
} from "./invoice";

describe("createInvoiceFromOrderSchema", () => {
  it("빈 객체 통과 (모두 선택)", () => {
    expect(createInvoiceFromOrderSchema.safeParse({}).success).toBe(true);
  });

  it("issueDate 문자열 coerce", () => {
    const res = createInvoiceFromOrderSchema.safeParse({
      issueDate: "2026-04-19",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.issueDate).toBeInstanceOf(Date);
  });

  it("dueDate null 허용", () => {
    const res = createInvoiceFromOrderSchema.safeParse({ dueDate: null });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.dueDate).toBeNull();
  });

  it("note 1000자 초과 거부", () => {
    expect(
      createInvoiceFromOrderSchema.safeParse({ note: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });

  it("note 공백만 → undefined", () => {
    const res = createInvoiceFromOrderSchema.safeParse({ note: "   " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBeUndefined();
  });

  it("issueDate 잘못된 날짜 거부", () => {
    expect(
      createInvoiceFromOrderSchema.safeParse({ issueDate: "abc" }).success,
    ).toBe(false);
  });
});

describe("updateInvoiceDraftSchema", () => {
  it("빈 객체 통과", () => {
    expect(updateInvoiceDraftSchema.safeParse({}).success).toBe(true);
  });

  it("dueDate 문자열 → Date", () => {
    const res = updateInvoiceDraftSchema.safeParse({
      dueDate: "2026-05-31",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.dueDate).toBeInstanceOf(Date);
  });
});

describe("issueInvoiceSchema", () => {
  it("빈 객체 통과", () => {
    expect(issueInvoiceSchema.safeParse({}).success).toBe(true);
  });

  it("issueDate 재지정", () => {
    const res = issueInvoiceSchema.safeParse({ issueDate: "2026-04-20" });
    expect(res.success).toBe(true);
  });
});

describe("markInvoiceSentSchema", () => {
  it("빈 객체 통과", () => {
    expect(markInvoiceSentSchema.safeParse({}).success).toBe(true);
  });

  it("note 보존", () => {
    const res = markInvoiceSentSchema.safeParse({ note: "이메일 발송 완료" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.note).toBe("이메일 발송 완료");
  });
});

describe("cancelInvoiceSchema", () => {
  it("정상 사유 통과", () => {
    const res = cancelInvoiceSchema.safeParse({ reason: "거래 취소" });
    expect(res.success).toBe(true);
  });

  it("reason 누락 거부", () => {
    expect(cancelInvoiceSchema.safeParse({}).success).toBe(false);
  });

  it("reason 3자 미만 거부", () => {
    expect(cancelInvoiceSchema.safeParse({ reason: "ab" }).success).toBe(false);
  });
});

describe("calcVatTotal", () => {
  it("공급가 1,000원 → VAT 100, 총액 1,100", () => {
    const { vat, total } = calcVatTotal(1000);
    expect(vat).toBe(100);
    expect(total).toBe(1100);
  });

  it("공급가 0원 → VAT 0, 총액 0", () => {
    const { vat, total } = calcVatTotal(0);
    expect(vat).toBe(0);
    expect(total).toBe(0);
  });

  it("공급가 123,456원 → VAT 12,345.6, 총액 135,801.6", () => {
    const { vat, total } = calcVatTotal(123456);
    expect(vat).toBe(12345.6);
    expect(total).toBe(135801.6);
  });

  it("공급가 99.99원 → VAT 10.00(round), 총액 109.99", () => {
    // 99.99 * 0.1 = 9.999 → 10.00 (half-up)
    const { vat, total } = calcVatTotal(99.99);
    expect(vat).toBe(10);
    expect(total).toBe(109.99);
  });

  it("공급가 55,000원 → VAT 5,500, 총액 60,500", () => {
    const { vat, total } = calcVatTotal(55000);
    expect(vat).toBe(5500);
    expect(total).toBe(60500);
  });

  it("부동소수점 경계: 공급가 10.05 → 반올림 안정성", () => {
    const { vat, total } = calcVatTotal(10.05);
    // 10.05 * 0.1 = 1.005 → 1.01 (half-up via Math.round)
    expect(vat).toBe(1.01);
    expect(total).toBeCloseTo(11.06, 2);
  });
});
