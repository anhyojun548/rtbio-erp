/**
 * 수금 관리 — Phase 3D-3b (R12).
 *
 * 3개 패널:
 *   1. 수금 등록 폼 (거래처 선택 · 금액 · 날짜 · 방법 · 상태 · 비고 · bankTxnId 선택적 매칭)
 *   2. 수금 목록 (?clientId/status/from/to 필터)
 *   3. 은행 입금 목록 (matched=false 만 기본, 매칭 버튼 포함)
 */
import { requireRole } from "@/lib/session";
import { listPayments, listBankTxns } from "@/lib/actions/payment";
import { listClients } from "@/lib/actions/client";
import type { PaymentStatus } from "@prisma/client";
import { PaymentRecordForm } from "@/components/admin/payments/PaymentRecordForm";
import { PaymentList } from "@/components/admin/payments/PaymentList";
import { BankTxnPanel } from "@/components/admin/payments/BankTxnPanel";

type SearchParams = {
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
};

const STATUSES: PaymentStatus[] = ["PENDING", "PARTIAL", "PAID", "OVERDUE"];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const statusParam = searchParams.status?.trim() ?? "";
  const status: PaymentStatus | "ALL" = STATUSES.includes(
    statusParam as PaymentStatus,
  )
    ? (statusParam as PaymentStatus)
    : "ALL";
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;

  const [payments, unmatchedTxns, matchedTxns, clients] = await Promise.all([
    listPayments({
      clientId: searchParams.clientId,
      status,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    }),
    listBankTxns({ matched: false, limit: 100 }),
    listBankTxns({ matched: true, limit: 100 }),
    listClients({ active: "ACTIVE" }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">💰 수금 관리</h1>
        <p className="text-caption text-ink-secondary mt-1">
          거래처별 입금을 기록하고 은행 거래내역과 매칭합니다. 월 마감은{" "}
          <a href="/admin/ledger" className="text-primary hover:underline">
            거래처원장
          </a>
          에서 재계산합니다.
        </p>
      </header>

      <PaymentRecordForm
        clients={clientOptions}
        unmatchedTxns={unmatchedTxns.map((t) => ({
          id: t.id,
          bankName: t.bankName,
          payer: t.payer,
          amount: Number(t.amount),
          txnDate: t.txnDate.toISOString(),
        }))}
      />

      <PaymentList
        payments={payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt.toISOString(),
          method: p.method,
          status: p.status,
          note: p.note,
          client: p.client,
          bankTxn: p.bankTxn
            ? {
                id: p.bankTxn.id,
                bankName: p.bankTxn.bankName,
                payer: p.bankTxn.payer,
                txnDate: p.bankTxn.txnDate.toISOString(),
                reference: p.bankTxn.reference,
              }
            : null,
        }))}
        clients={clientOptions}
        defaults={{
          clientId: searchParams.clientId ?? "",
          status,
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
        }}
      />

      <BankTxnPanel
        unmatchedTxns={unmatchedTxns.map((t) => ({
          id: t.id,
          bankName: t.bankName,
          payer: t.payer,
          amount: Number(t.amount),
          txnDate: t.txnDate.toISOString(),
          reference: t.reference,
          payments: t.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            clientCode: p.client.code,
            clientName: p.client.name,
          })),
        }))}
        matchedTxns={matchedTxns.map((t) => ({
          id: t.id,
          bankName: t.bankName,
          payer: t.payer,
          amount: Number(t.amount),
          txnDate: t.txnDate.toISOString(),
          reference: t.reference,
          payments: t.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            clientCode: p.client.code,
            clientName: p.client.name,
          })),
        }))}
      />
    </div>
  );
}
