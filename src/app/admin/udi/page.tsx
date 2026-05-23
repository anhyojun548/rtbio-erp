/**
 * UDI 공급내역 보고 — 경영지원 포털
 */
import Link from "next/link";
export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/session";
import { listUdiReports } from "@/lib/actions/udi";
import { UDI_STATUS_LABEL } from "@/lib/validators/udi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

type Row = Awaited<ReturnType<typeof listUdiReports>>[number];

export default async function UdiPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "EXEC");
  let reports: Awaited<ReturnType<typeof listUdiReports>> = [];
  try {
    reports = await listUdiReports();
  } catch (e) {
    console.warn("[UdiPage] DB 접근 실패 — 마이그레이션 필요:", (e as Error).message);
  }

  const columns: ColumnDef<Row>[] = [
    { key: "reportMonth", label: "보고월", width: "110px", cellClassName: "font-mono font-semibold" },
    {
      key: "status",
      label: "상태",
      width: "100px",
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-tiny font-semibold ${
          r.status === "ACCEPTED"  ? "bg-success-light text-success" :
          r.status === "SUBMITTED" ? "bg-accent-light text-accent-dark" :
                                     "bg-canvas text-ink-muted"
        }`}> {UDI_STATUS_LABEL[r.status]}
        </span> ),
    },
    { key: "receiptNo", label: "접수번호", cellClassName: "font-mono text-tiny", render: (r) => r.receiptNo ?? "—" },
    { key: "itemCount", label: "품목수", align: "right", width: "80px", cellClassName: "tabular-nums", render: (r) => r._count.items.toLocaleString() },
    { key: "totalAmount", label: "합계", align: "right", width: "140px", cellClassName: "tabular-nums font-semibold", render: (r) => `₩${Number(r.totalAmount).toLocaleString()}` },
    { key: "submittedAt", label: "전송일시", width: "150px", cellClassName: "tabular-nums text-tiny", render: (r) => r.submittedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="UDI 공급내역 보고"
        subtitle="월별 병원 납품 거래를 식약처에 보고합니다. 거래명세서(ISSUED+SENT)에서 자동 집계."
      />

      <DataTable
        columns={columns}
        rows={reports}
        keyField="id"
        emptyMessage="작성된 UDI 보고서가 없습니다."
      />

      <div className="bg-primary-lighter border border-primary/10 rounded p-4 text-caption text-ink-secondary"> 신규 보고서는 <strong className="text-primary">서버 액션 createUdiReportFromInvoices</strong> 호출로 생성됩니다.
        해당 월 ISSUED+SENT 거래명세서의 HOSPITAL 거래처 라인이 자동 집계됩니다.
      </div>
    </div> );
}
