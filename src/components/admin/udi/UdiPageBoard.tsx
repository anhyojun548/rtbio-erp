"use client";

/**
 * UdiPageBoard — UDI 보고 관리 화면 (Client Component)
 *
 * 기능:
 *   - 월 선택 (입력 변경 시 → router.push(?month=YYYY-MM))
 *   - 4 stat 카드 (대상 병원 / 총 품목 / 총 수량 / 보고 상태)
 *   - 보고서 생성 버튼 (createUdiReportFromInvoices)
 *   - 보고 이력 테이블 + 액션 (전송 / 접수증 / 삭제)
 *   - 접수증 모달
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createUdiReportFromInvoices,
  submitUdiReport,
  deleteUdiReport,
} from "@/lib/actions/udi";
import { UDI_STATUS_LABEL } from "@/lib/validators/udi";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/shared/Button";
import { Modal, confirmDialog } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";
import { formatKRW } from "@/lib/format";

// 직렬화된 props (Server → Client)
export type SerializedReport = {
  id: string;
  reportMonth: string;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED";
  receiptNo: string | null;
  submittedAt: string | null;        // ISO
  totalItems: number;
  totalAmount: string;               // Decimal → string
  itemCount: number;                 // _count.items
  createdAt: string;                 // ISO
};

interface Props {
  month: string;                     // YYYY-MM
  preview: {
    hospitalCount: number;
    itemCount: number;
    excludedItemCount: number;       // UDI 미등록 제품으로 빠진 라인 수
    totalQty: number;
    totalAmount: number;
    hasExistingReport: boolean;
  };
  reports: SerializedReport[];
}

export function UdiPageBoard({ month, preview, reports }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [receiptOpen, setReceiptOpen] = useState<SerializedReport | null>(null);

  function shiftMonth(delta: -1 | 1) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    let ny = y;
    let nm = m + delta;
    if (nm > 12) { ny += 1; nm = 1; }
    if (nm < 1)  { ny -= 1; nm = 12; }
    const next = `${ny}-${String(nm).padStart(2, "0")}`;
    start(() => router.push(`/admin/udi?month=${next}`));
  }

  function onMonthChange(next: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next)) return;
    start(() => router.push(`/admin/udi?month=${next}`));
  }

  function onCreate() {
    if (preview.hasExistingReport) {
      toast.error(`${month} 보고서가 이미 존재합니다`);
      return;
    }
    if (preview.itemCount === 0) {
      toast.error("해당 월에 병원 납품 거래명세서가 없습니다");
      return;
    }
    start(async () => {
      const res = await createUdiReportFromInvoices({ reportMonth: month });
      if (res.ok) {
        const { itemCount, excludedCount } = res.data;
        const msg = excludedCount > 0
          ? `${month} 보고서 생성 완료 (${itemCount}건 · UDI 미등록 ${excludedCount}건 제외)`
          : `${month} 보고서 생성 완료 (${itemCount}건)`;
        toast.success(msg);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function onSubmit(id: string, reportMonth: string) {
    const confirmed = await confirmDialog({
      title: "UDI 식약처 전송",
      body: `${reportMonth} 분 보고서를 의료기기통합정보시스템에 전송하시겠습니까?`,
      confirmText: "전송",
      variant: "primary",
    });
    if (!confirmed) return;
    start(async () => {
      const res = await submitUdiReport(id);
      if (res.ok) {
        toast.success(`전송 완료 — 접수번호 ${res.data.receiptNo}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function onDelete(id: string, reportMonth: string) {
    const confirmed = await confirmDialog({
      title: "보고서 삭제",
      body: `${reportMonth} DRAFT 보고서를 삭제하시겠습니까? (되돌릴 수 없습니다)`,
      confirmText: "삭제",
      variant: "danger",
    });
    if (!confirmed) return;
    start(async () => {
      const res = await deleteUdiReport(id);
      if (res.ok) {
        toast.success("보고서가 삭제되었습니다");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const statusForCurrentMonth = (() => {
    const found = reports.find((r) => r.reportMonth === month);
    if (!found) return null;
    return found;
  })();

  return (
    <div className="space-y-6">
      {/* ── 월 선택 + 생성 버튼 ── */}
      <section className="bg-surface border border-border rounded p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} disabled={pending}>← 전월</Button>
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-xs border border-border px-3 py-1.5 text-caption"
          />
          <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} disabled={pending}>다음월 →</Button>
        </div>
        <div className="flex items-center gap-2">
          {statusForCurrentMonth ? (
            <span className="text-tiny text-ink-secondary">
              현재 월 보고서 ID: <code className="font-mono">{statusForCurrentMonth.id}</code> · {UDI_STATUS_LABEL[statusForCurrentMonth.status]}
            </span>
          ) : (
            <span className="text-tiny text-warning">아직 보고서 미생성</span>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
            disabled={pending || preview.hasExistingReport || preview.itemCount === 0}
          >
            + 보고서 생성
          </Button>
        </div>
      </section>

      {/* ── UDI 미등록 제품 경고 (있으면) ── */}
      {preview.excludedItemCount > 0 && (
        <div className="bg-warning-light border border-warning/40 text-warning rounded p-3 text-caption">
          <strong>UDI 미등록 제품 {preview.excludedItemCount}건이 보고에서 제외됩니다.</strong>
          {" "}식약처 UDI 등록을 완료한 후 다시 시도하세요.
          <Link href="/admin/products?udi=missing" className="ml-2 underline hover:no-underline">
            미등록 제품 보기 →
          </Link>
        </div>
      )}

      {/* ── 4 Stat ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="대상 병원"
          value={preview.hospitalCount}
          desc={`${month} 납품`}
          variant="primary"
          icon=""
        />
        <StatCard
          label="총 품목"
          value={preview.itemCount}
          desc="건수"
          variant="accent"
          icon=""
        />
        <StatCard
          label="총 수량"
          value={preview.totalQty.toLocaleString()}
          desc="편측 기준"
          variant="warning"
          icon=""
        />
        <StatCard
          label="공급가 합"
          value={formatKRW(preview.totalAmount)}
          desc={`보고 상태: ${statusForCurrentMonth ? UDI_STATUS_LABEL[statusForCurrentMonth.status] : "미보고"}`}
          variant={statusForCurrentMonth?.status === "ACCEPTED" ? "success" : "danger"}
          icon=""
        />
      </section>

      {/* ── 보고 이력 ── */}
      <section className="bg-surface rounded shadow-sm border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-h3 m-0">월간 보고 이력</h2>
          <span className="text-tiny text-ink-muted">{reports.length}건</span>
        </div>
        {reports.length === 0 ? (
          <div className="p-8 text-center text-caption text-ink-muted">
            작성된 UDI 보고서가 없습니다.
          </div>
        ) : (
          <table className="w-full text-caption">
            <thead className="bg-canvas">
              <tr>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">보고월</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">상태</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">접수번호</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">품목수</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">공급가 합</th>
                <th className="px-4 py-2.5 text-left text-tiny font-semibold text-ink-secondary uppercase">전송일시</th>
                <th className="px-4 py-2.5 text-right text-tiny font-semibold text-ink-secondary uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="px-4 py-2.5 font-mono font-semibold">
                    <Link href={`/admin/udi/${r.id}`} className="text-primary hover:underline">
                      {r.reportMonth}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-tiny font-semibold ${
                      r.status === "ACCEPTED"  ? "bg-success-light text-success" :
                      r.status === "SUBMITTED" ? "bg-accent-light text-accent-dark" :
                                                  "bg-canvas text-ink-muted"
                    }`}>
                      {UDI_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-tiny text-ink-secondary">{r.receiptNo ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.itemCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatKRW(Number(r.totalAmount))}</td>
                  <td className="px-4 py-2.5 tabular-nums text-tiny">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <Link href={`/admin/udi/${r.id}`} className="text-tiny text-primary hover:underline px-2 py-1">상세</Link>
                      {r.status === "DRAFT" && (
                        <>
                          <Button variant="primary" size="sm" onClick={() => onSubmit(r.id, r.reportMonth)} disabled={pending}>전송</Button>
                          <Button variant="outline" size="sm" onClick={() => onDelete(r.id, r.reportMonth)} disabled={pending}>삭제</Button>
                        </>
                      )}
                      {r.status === "ACCEPTED" && (
                        <Button variant="outline" size="sm" onClick={() => setReceiptOpen(r)}>접수증</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── 접수증 모달 (onConfirm 없음 → "닫기" 단일 버튼) ── */}
      {receiptOpen && (
        <Modal
          open
          title={`UDI 접수증 — ${receiptOpen.reportMonth}`}
          onClose={() => setReceiptOpen(null)}
        >
          <div className="space-y-4">
            <div className="bg-primary text-white rounded p-5 text-center">
              <div className="text-tiny opacity-85">의료기기통합정보시스템</div>
              <div className="text-h2 font-bold my-2">접수 완료</div>
              <div className="font-mono text-caption bg-white/15 px-3 py-1 rounded inline-block">
                {receiptOpen.receiptNo}
              </div>
            </div>
            <table className="w-full text-caption">
              <tbody className="divide-y divide-border">
                <tr><th className="text-left py-2 text-ink-secondary font-semibold w-32">보고월</th><td className="py-2 font-mono font-semibold">{receiptOpen.reportMonth}</td></tr>
                <tr><th className="text-left py-2 text-ink-secondary font-semibold">제출일시</th><td className="py-2">
                  {receiptOpen.submittedAt ? new Date(receiptOpen.submittedAt).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" }) : "—"}
                </td></tr>
                <tr><th className="text-left py-2 text-ink-secondary font-semibold">총 품목</th><td className="py-2 tabular-nums">{receiptOpen.itemCount.toLocaleString()}건</td></tr>
                <tr><th className="text-left py-2 text-ink-secondary font-semibold">공급가 합</th><td className="py-2 tabular-nums font-semibold">{formatKRW(Number(receiptOpen.totalAmount))}</td></tr>
                <tr><th className="text-left py-2 text-ink-secondary font-semibold">접수번호</th><td className="py-2 font-mono text-primary">{receiptOpen.receiptNo}</td></tr>
              </tbody>
            </table>
            <div className="text-tiny text-ink-muted text-center pt-2">
              본 접수증은 식약처 의료기기통합정보시스템 mock 발급본입니다.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
