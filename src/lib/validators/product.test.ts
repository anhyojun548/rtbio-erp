/**
 * product.ts Zod 스키마 단위 테스트.
 */
import { describe, expect, it } from "vitest";
import {
  productCreateSchema,
  productUpdateSchema,
  productSizeCreateSchema,
  productSizeUpdateSchema,
  isValidUdiCheckDigit,
} from "./product";

describe("productCreateSchema", () => {
  it("최소 필수 필드로 통과", () => {
    const res = productCreateSchema.safeParse({
      code: "SF-SHOULDER-L",
      name: "어깨 고정 보조기",
      basePrice: "150000",
    });
    expect(res.success).toBe(true);
  });

  it("basePrice 숫자 입력 허용 (string 변환)", () => {
    const res = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: 150000,
    });
    expect(res.success).toBe(true);
  });

  it("basePrice 음수 거부", () => {
    const res = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "-1000",
    });
    expect(res.success).toBe(false);
  });

  it("basePrice 소수점 3자리 이상 거부", () => {
    const res = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "100.123",
    });
    expect(res.success).toBe(false);
  });

  it("code 는 대문자/숫자/-/_ 만 허용", () => {
    const res = productCreateSchema.safeParse({
      code: "sf 001",
      name: "X",
      basePrice: "1000",
    });
    expect(res.success).toBe(false);
  });

  it("expiryMonths 1~600 정수 검증", () => {
    const neg = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "1000",
      expiryMonths: -1,
    });
    expect(neg.success).toBe(false);

    const zero = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "1000",
      expiryMonths: 0,
    });
    expect(zero.success).toBe(false);

    const ok24 = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "1000",
      expiryMonths: 24,
    });
    expect(ok24.success).toBe(true);
  });

  it("빈 문자열 optional 필드는 undefined 로 정규화", () => {
    const res = productCreateSchema.safeParse({
      code: "SF-001",
      name: "X",
      basePrice: "1000",
      brand: "",
      category: "",
      part: "",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.brand).toBeUndefined();
      expect(res.data.category).toBeUndefined();
    }
  });
});

describe("productUpdateSchema", () => {
  it("모든 필드 optional", () => {
    expect(productUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("active 단독 업데이트 가능", () => {
    expect(productUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });
});

describe("productSizeCreateSchema", () => {
  it("sizeCode 필수", () => {
    expect(productSizeCreateSchema.safeParse({}).success).toBe(false);
    expect(productSizeCreateSchema.safeParse({ sizeCode: "M" }).success).toBe(
      true,
    );
  });

  it("재고 기본값 0", () => {
    const res = productSizeCreateSchema.safeParse({ sizeCode: "M" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.physicalStock).toBe(0);
      expect(res.data.availableStock).toBe(0);
    }
  });

  it("음수 재고 거부", () => {
    const res = productSizeCreateSchema.safeParse({
      sizeCode: "M",
      physicalStock: -1,
    });
    expect(res.success).toBe(false);
  });

  it("reorderPoint 문자열 입력 변환", () => {
    const res = productSizeCreateSchema.safeParse({
      sizeCode: "M",
      reorderPoint: "10",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.reorderPoint).toBe(10);
  });
});

describe("productSizeUpdateSchema", () => {
  it("빈 객체 통과", () => {
    expect(productSizeUpdateSchema.safeParse({}).success).toBe(true);
  });
});

describe("UDI 등록 정보", () => {
  it("udiCode 14자리 통과", () => {
    const res = productCreateSchema.safeParse({
      code: "U-001", name: "X", basePrice: "1000",
      udiCode: "08801234567890",
    });
    expect(res.success).toBe(true);
  });

  it("udiCode 빈 문자열은 undefined 로 변환", () => {
    const res = productCreateSchema.safeParse({
      code: "U-002", name: "X", basePrice: "1000",
      udiCode: "",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.udiCode).toBeUndefined();
  });

  it("udiCode 13자리 거부", () => {
    const res = productCreateSchema.safeParse({
      code: "U-003", name: "X", basePrice: "1000",
      udiCode: "0880123456789",
    });
    expect(res.success).toBe(false);
  });

  it("udiCode 알파벳 포함 거부", () => {
    const res = productCreateSchema.safeParse({
      code: "U-004", name: "X", basePrice: "1000",
      udiCode: "0880A234567890",
    });
    expect(res.success).toBe(false);
  });

  it("udiRegisteredAt 문자열 → Date 변환", () => {
    const res = productCreateSchema.safeParse({
      code: "U-005", name: "X", basePrice: "1000",
      udiRegisteredAt: "2026-05-01",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.udiRegisteredAt).toBeInstanceOf(Date);
  });
});

describe("isValidUdiCheckDigit (GS1 mod-10)", () => {
  it("올바른 체크 디지트 통과 — '00000000000000'", () => {
    expect(isValidUdiCheckDigit("00000000000000")).toBe(true);
  });

  it("올바른 체크 디지트 통과 — '08801234567890' (예시: 체크자리 0 확인)", () => {
    // 0,8,8,0,1,2,3,4,5,6,7,8,9 ×(3,1,3,1,3,1,3,1,3,1,3,1,3) =
    // 0+8+24+0+3+2+9+4+15+6+21+8+27 = 127 → 10 - (127%10) = 10-7 = 3
    // 따라서 체크자리 3 가 정답 → '08801234567890' 은 체크 X
    expect(isValidUdiCheckDigit("08801234567890")).toBe(false);
    expect(isValidUdiCheckDigit("08801234567893")).toBe(true);
  });

  it("14자리 아니면 false", () => {
    expect(isValidUdiCheckDigit("1234567890123")).toBe(false);
    expect(isValidUdiCheckDigit("123456789012345")).toBe(false);
  });

  it("숫자 외 문자 포함 시 false", () => {
    expect(isValidUdiCheckDigit("0880123456789A")).toBe(false);
  });
});
