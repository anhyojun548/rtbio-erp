import { requireClient } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "@/components/shared/PortalShell";
import { CLIENT_MENU } from "@/components/shared/portalMenus";

/**
 * 거래처 포털 공통 레이아웃 — role=CLIENT 이고 User.clientId 세팅된 유저만 진입.
 *
 * CLIENT 유저는 자기 거래처의 다음만 본다 (read-only):
 *   - 주문 현황 + 상세
 *   - 거래명세서 (ISSUED/SENT/CANCELLED만, DRAFT 제외)
 *   - 수금 내역 + 월별 원장 (미수금)
 *   - 판매 계약서
 *   - 내 거래처 프로필
 *
 * CLIENT 는 쓰기 권한 거의 없음 (발주는 가능, 나머지는 조회).
 *
 * 2026-05-22: prototype 디자인 그대로 이식. 사이드바에 거래처명 표시.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();

  // 거래처 이름을 사이드바 브랜드에 함께 표기
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, code: true },
  });

  return (
    <PortalShell
      menu={CLIENT_MENU}
      userName={user.name}
      userRole="거래처"
      userAvatar={user.name?.[0] ?? "C"}
      brandText={client?.name ?? "거래처 포털"}
      brandSubText={client?.code ?? "RTBIO ERP"}
    >
      {children}
    </PortalShell>
  );
}
