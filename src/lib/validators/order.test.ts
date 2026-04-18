/**
 * order.ts (주문/라인) Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  orderCreateSchema,
  orderUpdateSchema,
  orderItemCreateSchema,
  orderItemUpdateSchema,
  shipToSchema,
} from "./order";

const VALID_ITEM = { productSizeId: "sz_1", quantity: 1 };

describe("orderItemCreateSchema", () => {
  it("정상 입력 통과", () => {
    expect(
      orderItemCreateSchema.safeParse({ productSizeId: "x", quantity: 3 })
        .success,
    ).toBe(true);
  });

  it("productSizeId 필수", () => {
    const res = orderItemCreateSchema.safeParse({
      productSizeId: "",
      quantity: 1,
    });
    expect(res.success).toBe(false);
  });

  it("quantity 0 거부", () => {
    const res = orderItemCreateSchema.safeParse({
      productSizeId: "x",
      quantity: 0,
    });
    expect(res.success).toBe(false);
  });

  it("quantity 음수 거부", () => {
    const res = orderItemCreateSchema.safeParse({
      productSizeId: "x",
      quantity: -1,
    });
    expect(res.success).toBe(false);
  });

  it("quantity 소수점 거부", () => {
    const res = orderItemCreateSchema.safeParse({
      productSizeId: "x",
      quantity: 1.5,
    });
    expect(res.success).toBe(false);
  });

  it("quantity 문자열 coerce", () => {
    const res = orderItemCreateSchema.safeParse({
      productSizeId: "x",
      quantity: "3",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.quantity).toBe(3);
  });
});

describe("orderItemUpdateSchema", () => {
  it("quantity 1 이상 통과", () => {
    expect(orderItemUpdateSchema.safeParse({ quantity: 2 }).success).toBe(true);
  });

  it("quantity 0 거부", () => {
    expect(orderItemUpdateSchema.safeParse({ quantity: 0 }).success).toBe(
      false,
    );
  });
});

describe("shipToSchema", () => {
  it("모든 필드 선택적", () => {
    const res = shipToSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it("shipToAddressId 만 제공도 OK", () => {
    const res = shipToSchema.safeParse({ shipToAddressId: "addr_1" });
    expect(res.success).toBe(true);
  });

  it("빈 문자열 → undefined 로 변환", () => {
    const res = shipToSchema.safeParse({
      shipToLabel: "",
      shipToRecipient: "",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.shipToLabel).toBeUndefined();
      expect(res.data.shipToRecipient).toBeUndefined();
    }
  });

  it("shipToMemo 500자 초과 거부", () => {
    const res = shipToSchema.safeParse({
      shipToMemo: "a".repeat(501),
    });
    expect(res.success).toBe(false);
  });
});

describe("orderCreateSchema", () => {
  it("정상 입력 통과 (임시주소 + 라인 1개)", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      shipToAddress: "서울시 강남구",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.orderDate).toBeInstanceOf(Date);
      expect(res.data.items).toHaveLength(1);
    }
  });

  it("정상 입력 통과 (등록배송지)", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      shipToAddressId: "addr_1",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(true);
  });

  it("clientId 필수", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "",
      orderDate: "2026-04-18",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(false);
  });

  it("items 비어있으면 거부", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      items: [],
    });
    expect(res.success).toBe(false);
  });

  it("orderDate 잘못된 형식 거부", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "not-a-date",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(false);
  });

  it("requestedDate optional", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.requestedDate).toBeUndefined();
  });

  it("requestedDate 빈 문자열 → undefined", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      requestedDate: "",
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.requestedDate).toBeUndefined();
  });

  it("items 2개 이상 허용 (중복 productSizeId 도 허용 — R03 엑셀형)", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      items: [
        { productSizeId: "sz_1", quantity: 2 },
        { productSizeId: "sz_1", quantity: 3 },
      ],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.items).toHaveLength(2);
  });

  it("note 500자 초과 거부", () => {
    const res = orderCreateSchema.safeParse({
      clientId: "cli_1",
      orderDate: "2026-04-18",
      note: "n".repeat(501),
      items: [VALID_ITEM],
    });
    expect(res.success).toBe(false);
  });
});

describe("orderUpdateSchema", () => {
  it("모든 필드 선택적", () => {
    expect(orderUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("clientId 변경 금지 (스키마에 필드 없음 — passthrough 아님)", () => {
    const res = orderUpdateSchema.safeParse({ clientId: "other" });
    // strict 모드 아니라 통과하지만 clientId 는 parsed.data 에 포함 안 됨
    expect(res.success).toBe(true);
    if (res.success) expect("clientId" in res.data).toBe(false);
  });

  it("orderDate 부분 업데이트 가능", () => {
    const res = orderUpdateSchema.safeParse({ orderDate: "2026-04-20" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.orderDate).toBeInstanceOf(Date);
  });

  it("배송지 덮어쓰기 가능", () => {
    const res = orderUpdateSchema.safeParse({
      shipToAddressId: "addr_2",
      shipToMemo: "오후만 가능",
    });
    expect(res.success).toBe(true);
  });
});
