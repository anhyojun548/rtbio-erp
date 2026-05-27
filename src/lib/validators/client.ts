/**
 * 거래처/배송지 Zod 스키마 — 서버 액션/API 공통.
 *
 * 도메인 규칙:
 * - code (거래처코드) 는 테넌트 내 unique (DB 제약 + 앱 중복 체크)
 * - type 은 ClientType enum 과 1:1
 * - 배송지는 label + address 필수
 */
import { z } from "zod";
import { ClientType } from "@prisma/client";

// ─── 공통 타입 ───
const optionalString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal("").transform(() => undefined));

// ─── 거래처 (Client) ───
export const clientCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "거래처 코드는 2자 이상")
    .max(32, "거래처 코드는 32자 이하")
    .regex(/^[A-Z0-9\-_]+$/, "대문자/숫자/-/_ 만 허용"),
  name: z.string().trim().min(1, "업체명 필수").max(120),
  type: z.nativeEnum(ClientType),
  businessNumber: optionalString,
  representative: optionalString,
  phone: optionalString,
  email: z.string().trim().email("이메일 형식 오류").optional().or(z.literal("").transform(() => undefined)),
  address: optionalString,
  postalCode: optionalString,
  paymentTerms: optionalString,
  salesRepId: z.string().trim().min(1).optional().or(z.literal("").transform(() => undefined)),
  // 경쟁업체 / 단가 협상 / 특이사항 등 영업 메모 (자유 텍스트, 최대 2000자)
  note: z
    .string()
    .trim()
    .max(2000, "메모는 2000자 이하")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  active: z.boolean().optional(),
});
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

// ─── 배송지 (ClientAddress) ───
export const addressCreateSchema = z.object({
  label: z.string().trim().min(1, "배송지 별칭 필수").max(60),
  recipientName: optionalString,
  phone: optionalString,
  postalCode: optionalString,
  address: z.string().trim().min(1, "주소 필수").max(500),
  addressDetail: optionalString,
  memo: optionalString,
  isDefault: z.boolean().default(false),
});
export type AddressCreateInput = z.infer<typeof addressCreateSchema>;

export const addressUpdateSchema = addressCreateSchema.partial();
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
