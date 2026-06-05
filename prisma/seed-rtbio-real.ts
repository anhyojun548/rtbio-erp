/**
 * RTBIO ERP — 알티바이오 실데이터 시드 (경영지원팀 엑셀 2종 기반)
 *
 * 원본:
 *   - 거래처별 할인율 단가.xlsx (기준표 시트)
 *   - 병원결제방식 및 담당자.xlsx (병원리스트 시트)
 *
 * 적재 내용:
 *   1) 영업담당자 3명 (박진우 / 배경동 / 신현호) — EXEC
 *   2) 5개 제품군 × {상지, 하지, [실린더]} = 8개 Product + ProductSize 1개씩
 *   3) AGENCY 58개 거래처 + ClientDiscount(제품군) + ClientFixedPrice(제품-부위 단가)
 *   4) HOSPITAL 82개 거래처 + paymentTerms + salesRepId
 *
 * 실행:
 *   pnpm tsx prisma/seed-rtbio-real.ts
 *
 * 멱등성:
 *   - 모든 upsert. 같은 코드/이름 재실행 시 update.
 *   - 기존 prisma/seed.ts 의 가상 데이터(서울대병원 등)는 건드리지 않음.
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const TENANT_CODE = "altibio";

// ────────────────────────────────────────────────────────────────────────────
// 기준 단가 (기준표 시트 R1~R10, 병원/정가)
// ────────────────────────────────────────────────────────────────────────────
const PRODUCT_GROUPS = [
  { brand: "RTBIO", category: "리코탭플러스",      part: "상지",   code: "P-RTP-UP",  basePrice: 36620 },
  { brand: "RTBIO", category: "리코탭플러스",      part: "하지",   code: "P-RTP-LO",  basePrice: 28670 },
  { brand: "RTBIO", category: "리스프린트",        part: "상지",   code: "P-RSP-UP",  basePrice: 31330 },
  { brand: "RTBIO", category: "리스프린트",        part: "하지",   code: "P-RSP-LO",  basePrice: 47390 },
  { brand: "RTBIO", category: "리스프린트 실린더", part: "실린더", code: "P-RSP-CY",  basePrice: 60350 },
  { brand: "RTBIO", category: "바로웰핏",          part: "상지",   code: "P-BWF-UP",  basePrice: 45730 },
  { brand: "RTBIO", category: "알티네오",          part: "상지",   code: "P-RTN-UP",  basePrice: 36620 },
  { brand: "RTBIO", category: "알티네오",          part: "하지",   code: "P-RTN-LO",  basePrice: 28670 },
];

// AGENCY 단가 데이터 (vendor → product → row)
const AGENCY_PRICES: Record<string, Record<string, {rate: number; upper: number|null; lower: number|null; cyl: number|null}>> = {
  "나우메디칼": {
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
  },
  "노엘바이오": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "다온메디칼": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "다올약품": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "더원메디텍": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "더채움": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "라이크메드": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "리메디컬": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "멀티플라넷": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "메가케어": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "메디업": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "메디원팜": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "메디탑": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "문메디칼": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "바른나무파트너스": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "바이오인터팜": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "뷰덱스": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "비즈메드": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "빈메디케어": {
    "리스프린트": { rate: 0.68, upper: 10025.599999999999, lower: 15164.8, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
  },
  "새혼": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "서아메디칼": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "서울메디케어": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "성강의료기": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "송림메디칼": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "씨엔팜": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.65, upper: null, lower: null, cyl: 21122.5 },
    "바로웰핏": { rate: 0.5, upper: 22865.0, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "안다코퍼레이션": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "알티메디": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "알티메디컬": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "에스디파마": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "에스케이메디칼": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "에이스의료기": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "에이치아이메디칼": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "에코메디": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "엘엔이파트너스": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "엘제이컴퍼니": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "엠앤엠": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "엠케이피": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "오티스메디": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "오티스원": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "온메디케어": {
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
  },
  "와이디": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.68, upper: 10025.599999999999, lower: 15164.8, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "와이디엠": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "와이케이팜": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "위플러스메디칼": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "유케어원": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "이연케미칼": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "중원메디케어": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "지오컴퍼니": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "케이넌코리아": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "케이알메드": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "케이플러스메디카": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "케이플러스팜": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "테스": {
    "리코탭플러스": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.5, upper: 18310.0, lower: 14335.0, cyl: null },
  },
  "티케이헬스케어": {
    "리코탭플러스": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.6, upper: null, lower: null, cyl: 24140.0 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.55, upper: 16479.0, lower: 12901.499999999998, cyl: null },
  },
  "프로메디칼": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
  "하나메디": {
    "리스프린트": { rate: 0.6, upper: 12532.0, lower: 18956.0, cyl: null },
  },
  "하얀메디칼": {
    "리코탭플러스": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
    "리스프린트": { rate: 0.65, upper: 10965.5, lower: 16586.5, cyl: null },
    "리스프린트 실린더": { rate: 0.65, upper: null, lower: null, cyl: 21122.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.6, upper: 14648.0, lower: 11468.0, cyl: null },
  },
  "한양의지": {
    "리코탭플러스": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
    "리스프린트": { rate: 0.55, upper: 14098.5, lower: 21325.499999999996, cyl: null },
    "리스프린트 실린더": { rate: 0.55, upper: null, lower: null, cyl: 27157.5 },
    "바로웰핏": { rate: 0.45, upper: 25151.5, lower: null, cyl: null },
    "알티네오": { rate: 0.45, upper: 20141.0, lower: 15768.5, cyl: null },
  },
};
// 총 58개 대리점

const HOSPITALS = [
  { name: "건재활의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "호계튼튼의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "고려다온재활의학과", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "힘내라마취통증의학과의원", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "고려정형외과의원", paymentTerms: "당월말(계좌입금)", repName: "배경동" },
  { name: "아산중앙튼튼탑의원", paymentTerms: "익월말(계좌입금)", repName: "박진우" },
  { name: "김갑수마취통증의학과", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "태능성모의원", paymentTerms: "익월말사용량(카드결제)", repName: "배경동" },
  { name: "나음재활의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "불광고려마취통증의학과의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "늘푸른정형외과", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "153정형외과의원", paymentTerms: "익월말(카드결제)", repName: "박진우" },
  { name: "답십리연세정형외과의원", paymentTerms: "사용량(카드결제)", repName: "박진우" },
  { name: "신정형외과의원", paymentTerms: null, repName: "박진우" },
  { name: "미래연세의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "마디신경외과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "바른몸정형외과의원", paymentTerms: "사용량(계좌입금)", repName: "박진우" },
  { name: "세연마취통증의학과", paymentTerms: "당월말(계좌입금)", repName: "신현호" },
  { name: "바른정형외과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "세화정형외과", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "반듯한정형외과의원홍대점", paymentTerms: "익월초(카드결제)", repName: "박진우" },
  { name: "아주편한재활의학과", paymentTerms: "당월말(계좌입금)", repName: "신현호" },
  { name: "배곧바른마디의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "강남연세재활의학과", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "분당서울재활의학과의원", paymentTerms: "당월말(계좌입금)", repName: "배경동" },
  { name: "강재활의학과", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "뿌리요양병원", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "월곡바른재활의학과", paymentTerms: null, repName: "박진우" },
  { name: "삼성서울정형외과", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "미래연세의원", paymentTerms: null, repName: "박진우" },
  { name: "새연세재활의학과의원", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "한맘플러스재활의학과의원", paymentTerms: "사용량(카드결제)", repName: "박진우" },
  { name: "서울정형외과의원", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "푸른연세정형외과", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "성모Y마취통증의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "봉담척마디의원", paymentTerms: "익월말(계좌입금)", repName: "신현호" },
  { name: "성모윤정형외과", paymentTerms: "익월말(계좌입금)", repName: "박진우" },
  { name: "당산튼튼본마취통증의학과의원", paymentTerms: "당월말(카드결제)", repName: "신현호" },
  { name: "세일정형외과", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "영등포정통증의학과", paymentTerms: "익월말(계좌입금)", repName: "신현호" },
  { name: "송산의원", paymentTerms: "익월말(카드결제)", repName: "박진우" },
  { name: "서울더튼튼재활의학과", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "시흥솔요양병원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "연세닥터스내과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "신당서울휴재활의학과", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "중앙정형외과", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "아산본정형외과의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "제일정형외과", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "아산튼튼신경외과의원", paymentTerms: "당월말(계좌입금)", repName: "배경동" },
  { name: "천시욱정형외과", paymentTerms: "익월말(계좌입금)", repName: "신현호" },
  { name: "안양탑정형외과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "당산정형외과", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "연세신통마취통증의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "류마엔정형외과", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "연세씨앤에스재활의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "이태원정형외과의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "연세차온정형외과", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "21세기정형외과", paymentTerms: "익월말(카드결제)", repName: "배경동" },
  { name: "우성성모정형외과의원", paymentTerms: "총미수금30%(카드)", repName: "배경동" },
  { name: "연세튼튼신경외과의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "이문홍정형외과의원", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "더편한마디의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "이수제일정형외과의원", paymentTerms: "익월초(카드결제)", repName: "박진우" },
  { name: "본누리정형외과의원", paymentTerms: "당월말(계좌입금)", repName: "배경동" },
  { name: "장동욱병원", paymentTerms: "익월말(계좌입금)", repName: "박진우" },
  { name: "분당삼성정형외과의원", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "정승기정형외과의원", paymentTerms: "사용량(카드결제)", repName: "박진우" },
  { name: "인하정형외과", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "지인마취통증의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "서울박내과", paymentTerms: "사용량(카드결제)", repName: "박진우" },
  { name: "참마취통증의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "힘나는재활의학과의원", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "참정형외과의원", paymentTerms: "익월말사용량(카드결제)", repName: "배경동" },
  { name: "중앙메디칼의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "참편한신경과의원", paymentTerms: "당월말(카드결제)", repName: "배경동" },
  { name: "남기헌정형외과", paymentTerms: "익월말(카드결제)", repName: "신현호" },
  { name: "청담정형외과의원", paymentTerms: "3개월단위(계좌입금)", repName: "박진우" },
  { name: "최재활의학과의원", paymentTerms: "당월말(카드결제)", repName: "박진우" },
  { name: "큰나무재활의학과의원", paymentTerms: "당월말(계좌입금)", repName: "박진우" },
  { name: "편한마디정형외과의원", paymentTerms: "3개월단위(계좌입금)", repName: "배경동" },
  { name: "평택탑마취통증의학과의원", paymentTerms: "당월말(계좌입금)", repName: "신현호" },
  { name: "하정한정형외과", paymentTerms: "당월말(카드결제)", repName: "박진우" },
];
// 총 82개 병원

// ────────────────────────────────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 RTBIO 실데이터 시드 시작...");

  // 1) 테넌트
  const tenant = await prisma.tenant.upsert({
    where: { code: TENANT_CODE },
    update: {},
    create: { code: TENANT_CODE, name: "알티바이오", subdomain: "altibio", active: true, createdBy: "seed-real" },
  });
  console.log(`✓ Tenant: ${tenant.name}`);

  // 2) 영업담당자 3명 (EXEC)
  const defaultPw = await bcrypt.hash("rtbio1234!", 10);
  const repsData = [
    { email: "park.jw@rtbio.com",  name: "박진우" },
    { email: "bae.kd@rtbio.com",   name: "배경동" },
    { email: "shin.hh@rtbio.com",  name: "신현호" },
  ];
  const repsByName = new Map<string, string>();
  for (const rd of repsData) {
    const u = await prisma.user.upsert({
      where: { email: rd.email },
      update: { name: rd.name, role: "EXEC", tenantId: tenant.id },
      create: { email: rd.email, password: defaultPw, name: rd.name, role: "EXEC", tenantId: tenant.id, createdBy: "seed-real" },
    });
    repsByName.set(rd.name, u.id);
  }
  console.log(`✓ Sales Reps: ${repsByName.size}명 (박진우/배경동/신현호)`);

  // 3) 제품군 (8개 Product + ProductSize 1개씩)
  const productByKey = new Map<string, string>(); // `${category}|${part}` → productId
  for (const pg of PRODUCT_GROUPS) {
    const p = await prisma.product.upsert({
      where: { code: pg.code },
      update: {
        name: `${pg.category} ${pg.part}`,
        brand: pg.brand,
        category: pg.category,
        part: pg.part,
        basePrice: pg.basePrice,
      },
      create: {
        code: pg.code,
        name: `${pg.category} ${pg.part}`,
        brand: pg.brand,
        category: pg.category,
        part: pg.part,
        basePrice: pg.basePrice,
        expiryMonths: 36,
        createdBy: "seed-real",
        sizes: { create: [{ sizeCode: "기본", physicalStock: 100, availableStock: 100, reorderPoint: 20, createdBy: "seed-real" }] },
      },
    });
    productByKey.set(`${pg.category}|${pg.part}`, p.id);
  }
  console.log(`✓ Products: ${PRODUCT_GROUPS.length}종 (5 제품군 × 부위)`);

  // 4) AGENCY 58곳 + 할인율/단가
  const agencyNames = Object.keys(AGENCY_PRICES).sort();
  let agencyCount = 0, discountCount = 0, fixedPriceCount = 0;
  for (let i = 0; i < agencyNames.length; i++) {
    const name = agencyNames[i]!;
    const code = `C-AGEN-RTB-${String(i + 1).padStart(3, "0")}`;
    const client = await prisma.client.upsert({
      where: { code },
      update: { name, type: "AGENCY", active: true },
      create: {
        code, name, type: "AGENCY",
        email: `${code.toLowerCase()}@agency.local`,
        createdBy: "seed-real",
      },
    });
    agencyCount++;

    // 제품군별 할인율 + 부위별 고정가
    const pricing = AGENCY_PRICES[name];
    if (!pricing) continue;
    for (const [category, row] of Object.entries(pricing)) {
      // ClientDiscount (category 단위) — 할인율 0~1
      if (row.rate > 0 && row.rate < 1) {
        await prisma.clientDiscount.upsert({
          where: { clientId_category: { clientId: client.id, category } },
          update: { discountRate: row.rate },
          create: { clientId: client.id, category, discountRate: row.rate, createdBy: "seed-real" },
        });
        discountCount++;
      }
      // ClientFixedPrice (productId 단위) — 부위별 정확한 단가
      const parts = [
        { part: "상지",   price: row.upper },
        { part: "하지",   price: row.lower },
        { part: "실린더", price: row.cyl },
      ];
      for (const { part, price } of parts) {
        if (price == null || price <= 0) continue;
        const pid = productByKey.get(`${category}|${part}`);
        if (!pid) continue;
        await prisma.clientFixedPrice.upsert({
          where: { clientId_productId: { clientId: client.id, productId: pid } },
          update: { fixedPrice: Number(price.toFixed(2)) },
          create: { clientId: client.id, productId: pid, fixedPrice: Number(price.toFixed(2)), createdBy: "seed-real" },
        });
        fixedPriceCount++;
      }
    }
  }
  console.log(`✓ AGENCY: ${agencyCount}곳 / ClientDiscount ${discountCount}건 / ClientFixedPrice ${fixedPriceCount}건`);

  // 5) HOSPITAL 82곳 + paymentTerms + salesRepId
  // dedup by name (엑셀에 "미래연세의원" 중복 등이 있음 → 첫 등장 유지)
  const seen = new Set<string>();
  const unique = HOSPITALS.filter(h => {
    if (seen.has(h.name)) return false;
    seen.add(h.name);
    return true;
  });
  let hospitalCount = 0;
  for (let i = 0; i < unique.length; i++) {
    const h = unique[i]!;
    const code = `C-HOSP-RTB-${String(i + 1).padStart(3, "0")}`;
    const salesRepId = h.repName ? (repsByName.get(h.repName) ?? null) : null;
    await prisma.client.upsert({
      where: { code },
      update: {
        name: h.name,
        type: "HOSPITAL",
        paymentTerms: h.paymentTerms ?? undefined,
        salesRepId: salesRepId ?? undefined,
        active: true,
      },
      create: {
        code, name: h.name, type: "HOSPITAL",
        paymentTerms: h.paymentTerms ?? undefined,
        salesRepId: salesRepId ?? undefined,
        email: `${code.toLowerCase()}@hospital.local`,
        createdBy: "seed-real",
      },
    });
    hospitalCount++;
  }
  console.log(`✓ HOSPITAL: ${hospitalCount}곳 (paymentTerms + salesRep 매핑)`);

  console.log("🎉 RTBIO 실데이터 시드 완료");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
