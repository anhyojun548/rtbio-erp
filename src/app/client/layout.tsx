import { requireClient } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { ClientSidebar } from "@/components/client/Sidebar";

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
 * CLIENT 는 쓰기 권한 없음. 주문 생성은 내부 영업팀이 대신 등록.
 */
export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();

  // 거래처 이름을 TopBar 포털명에 함께 표기
  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { name: true, code: true },
  });
  const portalLabel = client ? `거래처 · ${client.name}` : "거래처";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar portal={portalLabel} userName={user.name} role={user.role} />
      <div className="flex flex-1 min-h-0">
        <ClientSidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
