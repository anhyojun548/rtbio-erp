/**
 * 칸반 단계(KanbanColumn) Zod 스키마 — Phase 3E-1 (R05).
 *
 * key:         대문자/숫자/언더스코어만 허용(1~32). DB unique. 한번 정해지면 사실상 불변 권장.
 * label:       한글 포함 표시용 라벨 (1~50).
 * sortOrder:   0 이상 정수. 낮을수록 왼쪽.
 * isTerminal:  true 면 해당 단계 진입 시 SHIP 트랜잭션이 실행되고 자동 완료.
 * color:       "#RRGGBB" 선택값.
 *
 * 주의: 동일 sortOrder 여러 개를 허용한다(키는 unique이지만 sortOrder는 unique가 아님).
 *       단 UI에서는 reorder 로 normalize 한다.
 */
import { z } from "zod";

export const kanbanKeyField = z
  .string()
  .trim()
  .min(1, "key 는 필수입니다.")
  .max(32, "key 는 32자 이내여야 합니다.")
  .regex(/^[A-Z][A-Z0-9_]*$/, "key 는 대문자/숫자/언더스코어만 사용 가능합니다 (첫글자 대문자).");

export const kanbanLabelField = z
  .string()
  .trim()
  .min(1, "라벨은 필수입니다.")
  .max(50, "라벨은 50자 이내여야 합니다.");

export const sortOrderField = z
  .coerce.number()
  .int()
  .min(0, "sortOrder 는 0 이상이어야 합니다.")
  .max(999, "sortOrder 는 999 이하여야 합니다.");

export const colorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "color 는 #RRGGBB 형식이어야 합니다.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createKanbanColumnSchema = z.object({
  key: kanbanKeyField,
  label: kanbanLabelField,
  sortOrder: sortOrderField,
  isTerminal: z.boolean().optional().default(false),
  color: colorField,
});
export type CreateKanbanColumnInput = z.input<typeof createKanbanColumnSchema>;

export const updateKanbanColumnSchema = z.object({
  label: kanbanLabelField.optional(),
  sortOrder: sortOrderField.optional(),
  isTerminal: z.boolean().optional(),
  color: colorField,
});
export type UpdateKanbanColumnInput = z.input<typeof updateKanbanColumnSchema>;

/**
 * reorderKanbanColumns — 복수 단계의 sortOrder 를 한번에 업데이트.
 * 길이 1~32, id 고유, sortOrder 중복 허용(정렬 시 stable).
 */
export const reorderKanbanColumnsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: sortOrderField,
      }),
    )
    .min(1, "최소 1개 단계가 필요합니다.")
    .max(32, "한번에 재정렬 가능한 최대 단계 수는 32개입니다.")
    .refine(
      (arr) => new Set(arr.map((i) => i.id)).size === arr.length,
      "id 가 중복되었습니다.",
    ),
});
export type ReorderKanbanColumnsInput = z.input<
  typeof reorderKanbanColumnsSchema
>;
