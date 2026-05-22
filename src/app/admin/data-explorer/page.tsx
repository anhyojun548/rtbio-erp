/**
 * 데이터 탐색기 — Phase 5
 *
 * 알티바이오 2023.01 ~ 2026.05 매입매출 거래원장 (41,000+ 건).
 * 엑셀/CSV 업로드·다운로드 + 필터·페이지네이션.
 */
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import {
  listTransactions,
  aggregateTransactions,
} from "@/lib/actions/transaction-ledger";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataExplorerBoard, type TxnRow } from "@/components/admin/data-explorer/DataExplorerBoard";

type SearchParams = {
  q?: string;
  kind?: string;
  clientCode?: string;
  productCode?: string;
  from?: string;
  to?: string;
  offset?: string;
};

export default async function DataExplorerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "EXEC", "QC");
  const canUpload = user.role === "TENANT_OWNER" || user.role === "ADMIN";

  const kindFilter: "SALE" | "PURCHASE" | undefined =
    searchParams.kind === "SALE" || searchParams.kind === "PURCHASE" ? searchParams.kind : undefined;

  const filter = {
    ...(searchParams.q ? { q: searchParams.q } : {}),
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(searchParams.clientCode ? { clientCode: searchParams.clientCode } : {}),
    ...(searchParams.productCode ? { productCode: searchParams.productCode } : {}),
    ...(searchParams.from ? { from: new Date(searchParams.from) } : {}),
    ...(searchParams.to ? { to: new Date(searchParams.to) } : {}),
    limit:  100,
    offset: searchParams.offset ? parseInt(searchParams.offset, 10) : 0,
  };

  let result: Awaited<ReturnType<typeof listTransactions>> = { rows: [], total: 0, limit: 100, offset: 0 };
  let aggregates: Awaited<ReturnType<typeof aggregateTransactions>> = {
    count: 0, totalQty: 0, totalSupply: 0, totalVat: 0, totalAmount: 0, byKind: [],
  };
  try {
    [result, aggregates] = await Promise.all([
      listTransactions(filter),
      aggregateTransactions(filter),
    ]);
  } catch (e) {
    console.warn("[DataExplorer] DB 접근 실패 — 마이그레이션 필요:", (e as Error).message);
  }

  const rows: TxnRow[] = result.rows.map((r) => ({
    id:           r.id,
    txnDate:      r.txnDate.toISOString(),
    kind:         r.kind,
    taxType:      r.taxType,
    clientCode:   r.clientCode,
    clientName:   r.clientName,
    productCode:  r.productCode,
    productName:  r.productName,
    spec:         r.spec,
    unit:         r.unit,
    qty:          Number(r.qty),
    unitPrice:    Number(r.unitPrice),
    supplyAmount: Number(r.supplyAmount),
    vat:          Number(r.vat),
    totalAmount:  Number(r.totalAmount),
    voucherNo:    r.voucherNo,
    hasInvoice:   r.hasInvoice,
    category:     r.category,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="🔍 데이터 탐색기"
        subtitle={
          <>
            2023.01 ~ 2026.05 매입매출 거래원장. 엑셀/CSV 업로드와 필터별 다운로드를 지원합니다.
          </>
        }
      />

      <DataExplorerBoard
        rows={rows}
        total={result.total}
        limit={result.limit}
        offset={result.offset}
        aggregates={aggregates}
        currentFilter={{
          q:           searchParams.q ?? "",
          kind:        searchParams.kind ?? "ALL",
          clientCode:  searchParams.clientCode ?? "",
          productCode: searchParams.productCode ?? "",
          from:        searchParams.from ?? "",
          to:          searchParams.to ?? "",
        }}
        canUpload={canUpload}
      />
    </div>
  );
}
