/**
 * payment.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  recordPaymentSchema,
  updatePaymentSchema,
  cancelPaymentSchema,
  createBankTxnSchema,
  matchBankTxnSchema,
  paymentStatusSchema,
} from "./payment";

const CUID = "clabc123def456ghi789jkl0";

describe("recordPaymentSchema", () => {
  it("정상 입력 통과", () => {
    const res = recordPaymentSchema.safeParse({
      clientId: CUID,
      amount: 150000,
      paidAt: "2026-04-19",
      method: "계좌이체",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amount).toBe(150000);
      expect(res.data.paidAt).toBeInstanceOf(Date);
    }
  });

  it("amount=0 거부", () => {
    expect(
      recordPaymentSchema.safeParse({
        clientId: CUID,
        amount: 0,
        paidAt: "2026-04-19",
        method: "계좌이체",
      }).success,
    ).toBe(false);
  });

  it("amount 문자열 coerce", () => {
    const res = recordPaymentSchema.safeParse({
      clientId: CUID,
      amount: "55000",
      paidAt: new Date(),
      method: "현금",
    });
    expect(res.success).toBe(true);
  });

  it("method 공백 거부", () => {
    expect(
      recordPaymentSchema.safeParse({
        clientId: CUID,
        amount: 100,
        paidAt: new Date(),
        method: "   ",
      }).success,
    ).toBe(false);
  });

  it("clientId cuid 검증", () => {
    expect(
      recordPaymentSchema.safeParse({
        clientId: "not-a-cuid",
        amount: 100,
        paidAt: new Date(),
        method: "현금",
      }).success,
    ).toBe(false);
  });

  it("status PAID 지정 허용", () => {
    const res = recordPaymentSchema.safeParse({
      clientId: CUID,
      amount: 100,
      paidAt: new Date(),
      method: "카드",
      status: "PAID",
    });
    expect(res.success).toBe(true);
  });

  it("status 잘못된 값 거부", () => {
    expect(
      recordPaymentSchema.safeParse({
        clientId: CUID,
        amount: 100,
        paidAt: new Date(),
        method: "카드",
        status: "FOO",
      }).success,
    ).toBe(false);
  });
});

describe("updatePaymentSchema", () => {
  it("빈 객체 통과", () => {
    expect(updatePaymentSchema.safeParse({}).success).toBe(true);
  });

  it("amount 업데이트", () => {
    const res = updatePaymentSchema.safeParse({ amount: 200000 });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.amount).toBe(200000);
  });

  it("status PARTIAL 허용", () => {
    const res = updatePaymentSchema.safeParse({ status: "PARTIAL" });
    expect(res.success).toBe(true);
  });

  it("note 1000자 초과 거부", () => {
    expect(
      updatePaymentSchema.safeParse({ note: "x".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("cancelPaymentSchema", () => {
  it("정상 사유 통과", () => {
    const res = cancelPaymentSchema.safeParse({ reason: "오입금 취소" });
    expect(res.success).toBe(true);
  });

  it("reason 3자 미만 거부", () => {
    expect(cancelPaymentSchema.safeParse({ reason: "aa" }).success).toBe(false);
  });

  it("reason 누락 거부", () => {
    expect(cancelPaymentSchema.safeParse({}).success).toBe(false);
  });
});

describe("createBankTxnSchema", () => {
  it("정상 입력 통과", () => {
    const res = createBankTxnSchema.safeParse({
      bankName: "국민은행",
      payer: "홍길동",
      amount: 500000,
      txnDate: "2026-04-19",
      reference: "신협농협10세대",
    });
    expect(res.success).toBe(true);
  });

  it("bankName 누락 거부", () => {
    expect(
      createBankTxnSchema.safeParse({
        payer: "홍길동",
        amount: 500000,
        txnDate: new Date(),
      }).success,
    ).toBe(false);
  });

  it("payer 공백 거부", () => {
    expect(
      createBankTxnSchema.safeParse({
        bankName: "국민",
        payer: "   ",
        amount: 500000,
        txnDate: new Date(),
      }).success,
    ).toBe(false);
  });

  it("amount 음수 거부", () => {
    expect(
      createBankTxnSchema.safeParse({
        bankName: "국민",
        payer: "홍길동",
        amount: -100,
        txnDate: new Date(),
      }).success,
    ).toBe(false);
  });

  it("reference 공백 → undefined", () => {
    const res = createBankTxnSchema.safeParse({
      bankName: "국민",
      payer: "홍길동",
      amount: 100,
      txnDate: new Date(),
      reference: "   ",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reference).toBeUndefined();
  });
});

describe("matchBankTxnSchema", () => {
  it("정상 cuid 통과", () => {
    expect(matchBankTxnSchema.safeParse({ paymentId: CUID }).success).toBe(
      true,
    );
  });

  it("paymentId 누락 거부", () => {
    expect(matchBankTxnSchema.safeParse({}).success).toBe(false);
  });

  it("paymentId 잘못된 형식 거부", () => {
    expect(
      matchBankTxnSchema.safeParse({ paymentId: "foo" }).success,
    ).toBe(false);
  });
});

describe("paymentStatusSchema", () => {
  it("4가지 enum 모두 허용", () => {
    for (const s of ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const) {
      expect(paymentStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("대소문자 구분", () => {
    expect(paymentStatusSchema.safeParse("paid").success).toBe(false);
  });
});
