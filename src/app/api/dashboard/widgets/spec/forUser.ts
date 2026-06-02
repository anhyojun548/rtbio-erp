import { prisma } from "@/lib/prisma";

/**
 * 위젯 저장 대상 유저 id 해소.
 * - forUser(email) 미지정 → 세션 유저 본인.
 * - forUser(email) 지정 → 해당 유저 id. 없으면 throw (라우트에서 400).
 *
 * Flowise 등 토큰 인증 요청은 서비스 principal 로 동작하므로,
 * 요청자(예: 대표) 이메일을 forUser 로 넘겨 그 유저의 대시보드에 위젯을 만든다.
 */
export async function resolveTargetUserId(
  sessionUserId: string,
  forUser?: string,
): Promise<string> {
  if (!forUser) return sessionUserId;
  const u = await prisma.user.findUnique({
    where: { email: forUser },
    select: { id: true },
  });
  if (!u) throw new Error(`forUser 사용자를 찾을 수 없습니다: ${forUser}`);
  return u.id;
}
