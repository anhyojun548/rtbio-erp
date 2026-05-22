/**
 * Notice 검증자 — Phase 5 (2026-05-22)
 *
 * 4개 포털(경영지원/영업/품질관리/임원진)에서 발송되는 공지사항.
 * 거래처 포털에 팝업으로 표시.
 */
import { z } from "zod";

// ── 발송 대상 ────────────────────────────────────────
export const NOTICE_TARGETS = ["ALL", "DEALER", "HOSPITAL", "SPECIFIC"] as const;
export type NoticeTargetType = (typeof NOTICE_TARGETS)[number];

export const NOTICE_TARGET_LABEL: Record<NoticeTargetType, string> = {
  ALL:      "전체 거래처",
  DEALER:   "대리점만",
  HOSPITAL: "병원만",
  SPECIFIC: "특정 거래처",
};

// ── 긴급도 ───────────────────────────────────────────
export const NOTICE_PRIORITIES = ["NORMAL", "HIGH"] as const;
export type NoticePriorityType = (typeof NOTICE_PRIORITIES)[number];

// ── 작성자 팀 (4팀) ──────────────────────────────────
export const NOTICE_AUTHOR_TEAMS = ["경영지원팀", "영업팀", "품질관리팀", "임원진"] as const;
export type NoticeAuthorTeam = (typeof NOTICE_AUTHOR_TEAMS)[number];

export const NOTICE_AUTHOR_META: Record<NoticeAuthorTeam, { color: string; bg: string; icon: string }> = {
  "경영지원팀": { color: "#1B3A5C", bg: "#E3F2FD", icon: "🔵" },
  "영업팀":     { color: "#B45309", bg: "#FFF3E0", icon: "🟡" },
  "품질관리팀": { color: "#166534", bg: "#E8F5E9", icon: "🟢" },
  "임원진":     { color: "#7C3AED", bg: "#F3E8FD", icon: "🔴" },
};

// ── 스키마 ───────────────────────────────────────────
export const createNoticeSchema = z
  .object({
    title:    z.string().trim().min(1, "제목은 필수입니다").max(200, "제목은 200자 이하"),
    body:     z.string().trim().min(1, "본문은 필수입니다").max(5000, "본문은 5000자 이하"),
    target:   z.enum(NOTICE_TARGETS),
    priority: z.enum(NOTICE_PRIORITIES).default("NORMAL"),
    pinned:   z.boolean().default(false),
    expiresAt: z.coerce.date().optional().nullable(),
    targetClientIds: z.array(z.string().cuid()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.target === "SPECIFIC" && data.targetClientIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetClientIds"],
        message: "특정 거래처를 1개 이상 선택해주세요",
      });
    }
  });

export const updateNoticeSchema = z.object({
  id:       z.string().cuid(),
  title:    z.string().trim().min(1).max(200).optional(),
  body:     z.string().trim().min(1).max(5000).optional(),
  priority: z.enum(NOTICE_PRIORITIES).optional(),
  pinned:   z.boolean().optional(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export const markReadSchema = z.object({
  noticeId: z.string().cuid(),
  dontShowAgain: z.boolean().default(false),
});

export type CreateNoticeInput  = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput  = z.infer<typeof updateNoticeSchema>;
export type MarkReadInput      = z.infer<typeof markReadSchema>;

// ── 헬퍼 ─────────────────────────────────────────────
/** 공지가 만료됐는지 */
export function isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt < now;
}

/** 거래처(client) 가 이 공지의 대상인지 */
export function isTargetClient(
  notice: { target: NoticeTargetType; recipients?: { clientId: string }[] },
  client: { id: string; type: string },
): boolean {
  switch (notice.target) {
    case "ALL":      return true;
    case "DEALER":   return client.type === "AGENCY";
    case "HOSPITAL": return client.type === "HOSPITAL";
    case "SPECIFIC":
      return (notice.recipients ?? []).some((r) => r.clientId === client.id);
    default: return false;
  }
}
