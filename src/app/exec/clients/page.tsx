/**
 * 내 거래처 목록 — Phase 3F-1.
 *
 * EXEC 롤 사용자에게 배정된 거래처만. 검색/정렬은 클라이언트에서.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listMyClients } from "@/lib/actions/exec";
import { MyClientsTable } from "@/components/exec/MyClientsTable";

export default async function MyClientsPage() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC");

  const clients = await listMyClients();

  const view = clients.map((c) => ({
    ...c,
    lastOrder: c.lastOrder
      ? { ...c.lastOrder, orderDate: c.lastOrder.orderDate.toISOString() }
      : null,
  }));

  const now = new Date();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display m-0">🏢 내 거래처</h1>
          <p className="text-caption text-ink-secondary mt-1">
            {user.name}님에게 배정된{" "}
            <strong className="text-primary">{clients.length}개</strong>{" "}
            거래처입니다. 이번 달({monthLabel}) 매출 기준 정렬/검색이 가능합니다.
          </p>
        </div>
        <Link
          href="/exec"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← 대시보드
        </Link>
      </header>

      <MyClientsTable rows={view} />
    </div>
  );
}
