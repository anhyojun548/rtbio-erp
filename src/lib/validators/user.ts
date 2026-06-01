import { z } from "zod";

/** 직원관리로 부여 가능한 role (CLIENT/SUPER_ADMIN/VIEWER 제외) */
export const staffRoleEnum = z.enum(["TENANT_OWNER", "ADMIN", "QC", "EXEC"]);

const passwordField = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72);
const nameField = z.string().trim().min(1, "이름을 입력하세요.").max(50);
const phoneField = z.string().trim().max(20).optional().or(z.literal("")).transform((v) => v || undefined);

export const createUserSchema = z.object({
  name: nameField,
  email: z.string().trim().email("올바른 이메일 형식이 아닙니다.").max(120),
  role: staffRoleEnum,
  phone: phoneField,
  tempPassword: passwordField,
});

export const updateUserSchema = z.object({
  name: nameField.optional(),
  phone: phoneField,
  role: staffRoleEnum.optional(),
  active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  tempPassword: passwordField,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, "현재 비밀번호를 입력하세요."),
  next: passwordField,
});

export const teamAdminToggleSchema = z.object({
  grant: z.boolean(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
