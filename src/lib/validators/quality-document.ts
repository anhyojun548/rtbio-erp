/**
 * QualityDocument 라벨 상수 (서버 액션과 분리 — "use server" 호환)
 */
import type { QualityDocKind } from "@prisma/client";

export const QDOC_KIND_LABEL: Record<QualityDocKind, string> = {
  MANUAL:    "매뉴얼",
  PROCEDURE: "절차서",
  FORM:      "양식",
};
