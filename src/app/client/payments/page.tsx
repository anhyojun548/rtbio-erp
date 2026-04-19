/**
 * 거래처 포털 — 수금·미수금 (읽기 전용).
 *
 * 두 섹션:
 *   1) 월별 원장(ClosingLedger) 테이블 — 전월이월·당월매출·당월수금·잔액
 *   2) 최근 수금(Payment) 이력 (PARTIAL/PAID/OVERDUE, PENDING 제외)
 */
import { listMyLedgers, listMyPayments } from "@/lib/actions/client-portal";

export default async function ClientPaymentsPage() {
  const [ledgers, payments] = await Promise.all([
    listMyLedgers({ limit: 24 }),
    listMyPayments({ limit: 100 }),
  ]);

  // 가장 최근 원장의 balance 가 현재 미수금
  const currentBalance = ledgers[0] ? Number(ledgers[0].balance) : 0;
  const currentMonth = ledgers[0]?.closingMonth ?? "-";
  const lastMonthReceived = ledgers[0] ? Number(ledgers[0].received) : 0;
  const lastMonthSales = ledgers[0] ? Number(ledgers[0].monthlySales) : 0;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">수금·미수금</h1>
        <p className="text-sm text-slate-500 mt-1">
          월별 원장과 최근 수금 내역을 확인합니다. 미수금 관련 문의는 경영지원팀에 연락해주세요.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <StatCard
          label={`${currentMonth} 미수금`}
          value={`${currentBalance.toLocaleString()} 원`}
          tone={currentBalance > 0 ? "rose" : "emerald"}
        />
        <StatCard
          label={`${currentMonth} 매출`}
          value={`${lastMonthSales.toLocaleString()} 원`}
        />
        <StatCard
          label={`${currentMonth} 수금`}
          value={`${lastMonthReceived.toLocaleString()} 원`}
          tone="emerald"
        />
        <StatCard
          label="수금 건수 (90일)"
          value={`${payments.filter((p) => {
            const days = (Date.now() - new Date(p.paidAt).getTime()) / 86400000;
            return days <= 90;
          }).length} 건`}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">
            월별 원장 (최근 24개월)
          </h2>
        </div>
        {ledgers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            아직 생성된 원장이 없습니다.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">월</th>
                <th className="px-4 py-2 text-right">전월 이월</th>
                <th className="px-4 py-2 text-right">당월 매출</th>
                <th className="px-4 py-2 text-right">당월 수금</th>
                <th className="px-4 py-2 text-right">잔액 (미수금)</th>
                <th className="px-4 py-2 text-left">마감</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgers.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    {l.closingMonth}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-600">
                    {Number(l.carryOver).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">
                    {Number(l.monthlySales).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-emerald-700">
                    {Number(l.received).toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums font-semibold ${
                      Number(l.balance) > 0
                        ? "text-rose-700"
                        : "text-slate-700"
                    }`}
                  >
                    {Number(l.balance).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.closedAt ? (
                      <span className="text-emerald-700">
                        🔒 {new Date(l.closedAt).toLocaleDateString("ko-KR")}
                      </span>
                    ) : (
                      <span className="text-slate-400">진행 중</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900 text-sm">
            최근 수금 내역 (최대 100건)
          </h2>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            아직 기록된 수금이 없습니다.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">입금일</th>
                <th className="px-4 py-2 text-left">방법</th>
                <th className="px-4 py-2 text-left">상태</th>
                <th className="px-4 py-2 text-right">금액</th>
                <th className="px-4 py-2 text-left">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 tabular-nums">
                    {new Date(p.paidAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.method}</td>
                  <td className="px-4 py-2">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">
                    {Number(p.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {p.note ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose" | "slate";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-white text-slate-800";
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

const PAY_TONE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-rose-100 text-rose-800",
};
const PAY_LABEL: Record<string, string> = {
  PENDING: "대기",
  PARTIAL: "일부입금",
  PAID: "입금완료",
  OVERDUE: "연체",
};

function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
        PAY_TONE[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {PAY_LABEL[status] ?? status}
    </span>
  );
}
