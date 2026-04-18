/**
 * Server Action / API 공통 결과 타입 + Zod 에러 포맷.
 *
 * 사용 예:
 *   return ok({ id: "..." });
 *   return fail("거래처 코드 중복", { field: "code" });
 */
import type { ZodError } from "zod";

export type ActionOk<T> = { ok: true; data: T };
export type ActionFail = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};
export type ActionResult<T> = ActionOk<T> | ActionFail;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function fail(
  message: string,
  opts?: { fieldErrors?: Record<string, string[]> },
): ActionFail {
  return { ok: false, error: message, fieldErrors: opts?.fieldErrors };
}

/**
 * Zod error → fieldErrors 맵 변환.
 */
export function zodFail(err: ZodError): ActionFail {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key]!.push(issue.message);
  }
  return {
    ok: false,
    error: "입력값이 올바르지 않습니다.",
    fieldErrors,
  };
}
