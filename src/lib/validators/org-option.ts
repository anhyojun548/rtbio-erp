import { z } from "zod";

export const ORG_OPTION_KINDS = ["DEPARTMENT", "JOB_TITLE"] as const;
export type OrgOptionKind = (typeof ORG_OPTION_KINDS)[number];

export const ORG_OPTION_KIND_LABEL: Record<OrgOptionKind, string> = {
  DEPARTMENT: "부서",
  JOB_TITLE: "직급",
};

export const orgOptionKindEnum = z.enum(ORG_OPTION_KINDS);
const labelField = z.string().trim().min(1, "이름을 입력하세요.").max(40, "40자 이하여야 합니다.");

export const createOrgOptionSchema = z.object({
  kind: orgOptionKindEnum,
  label: labelField,
});
export type CreateOrgOptionInput = z.infer<typeof createOrgOptionSchema>;
