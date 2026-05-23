/**
 * 월 마감 원장 — Phase 3D-3b (R09, R10).
 *
 * 화면 구성:
 *   1. 상단: 마감월 선택 + "이달 일괄 재계산" + "거래처 필터"
 *   2. 표: 활성 거래처 × 선택월 → carryOver / monthlySales / received / balance / 마감상태
 *      - 레코드가 아직 없는 거래처는 "원장 없음 → 재계산"
 *      - 마감된 거래처는 "재개" 버튼
 */
import { requireRole } from "@/lib/session";
import { listLedgers } from "@/lib/actions/ledger";
import { listClients } from "@/lib/actions/client";
import { LedgerBoard } from "@/components/admin/ledger/LedgerBoard";

type SearchParams = {
  month?: string;
  clientId?: string;
};

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const month =
    searchParams.month && MONTH_RE.test(searchParams.month)
      ? searchParams.month
      : defaultMonth();

  const [ledgers, clients] = await Promise.all([
    listLedgers({ closingMonth: month, limit: 500 }),
    listClients({ active: "ACTIVE" }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  const byClient = new Map(ledgers.map((l) => [l.clientId, l]));
  const filteredClients = searchParams.clientId
    ? clientOptions.filter((c) => c.id === searchParams.clientId)
    : clientOptions;

  const rows = filteredClients.map((c) => {
    const l = byClient.get(c.id);
    return {
      clientId: c.id,
      code: c.code,
      name: c.name,
      exists: !!l,
      carryOver: l ? Number(l.carryOver) : 0,
      monthlySales: l ? Number(l.monthlySales) : 0,
      received: l ? Number(l.received) : 0,
      balance: l ? Number(l.balance) : 0,
      closedAt: l?.closedAt ? l.closedAt.toISOString() : null,
      note: l?.note ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0"> 거래처 원장 (월 마감)</h1>
        <p className="text-caption text-ink-secondary mt-1"> 월별 거래처 원장을 재계산 · 마감합니다. 집계는{" "}
          <span className="font-semibold text-primary">carryOver + monthlySales − received</span>{" "}
          = balance.
        </p>
      </header>

      <LedgerBoard
        month={month}
        clients={clientOptions}
        selectedClientId={searchParams.clientId ?? ""}
        rows={rows}
      />
    </div> );
}
