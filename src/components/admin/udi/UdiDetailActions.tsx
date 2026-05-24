"use client";

/**
 * UdiDetailActions — 상세 페이지 상단 액션 바
 *
 * DRAFT       → [전송] [삭제]
 * SUBMITTED   → 정보 표시만
 * ACCEPTED    → [접수증 보기]
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitUdiReport, deleteUdiReport } from "@/lib/actions/udi";
import { UDI_STATUS_LABEL } from "@/lib/validators/udi";
import { Button } from "@/components/shared/Button";
import { Modal, confirmDialog } from "@/components/shared/Modal";
import { toast } from "@/components/shared/Toast";

interface Props {
  id: string;
  reportMonth: string;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED";
  receiptNo: string | null;
}

export function UdiDetailActions({ id, reportMonth, status, receiptNo }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [receiptOpen, setReceiptOpen] = useState(false);

  async function onSubmit() {
    const ok = await confirmDialog({
      title: "UDI 식약처 전송",
      body: `${reportMonth} 분 보고서를 의료기기통합정보시스템에 전송하시겠습니까?`,
      confirmText: "전송",
      variant: "primary",
    });
    if (!ok) return;
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

  async function onDelete() {
    const ok = await confirmDialog({
      title: "보고서 삭제",
      body: `${reportMonth} DRAFT 보고서를 삭제하시겠습니까? (되돌릴 수 없습니다)`,
      confirmText: "삭제",
      variant: "danger",
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteUdiReport(id);
      if (res.ok) {
        toast.success("보고서가 삭제되었습니다");
        router.push("/admin/udi");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="bg-surface border border-border rounded p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-caption text-ink-secondary">
        <strong>{UDI_STATUS_LABEL[status]}</strong>
        {status === "DRAFT" && " · 식약처 전송 전입니다. 내역 확인 후 전송하세요."}
        {status === "SUBMITTED" && " · 식약처 전송 완료. 접수 결과를 대기 중입니다."}
        {status === "ACCEPTED" && receiptNo && (
          <span> · 접수 완료 — <code className="font-mono text-primary font-semibold">{receiptNo}</code></span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status === "DRAFT" && (
          <>
            <Button variant="primary" onClick={onSubmit} disabled={pending}>식약처 전송</Button>
            <Button variant="outline" onClick={onDelete} disabled={pending}>삭제</Button>
          </>
        )}
        {status === "ACCEPTED" && (
          <Button variant="outline" onClick={() => setReceiptOpen(true)}>접수증 보기</Button>
        )}
      </div>

      {receiptOpen && (
        <Modal open title={`UDI 접수증 — ${reportMonth}`} onClose={() => setReceiptOpen(false)}>
          <div className="space-y-4">
            <div className="bg-primary text-white rounded p-5 text-center">
              <div className="text-tiny opacity-85">의료기기통합정보시스템</div>
              <div className="text-h2 font-bold my-2">접수 완료</div>
              <div className="font-mono text-caption bg-white/15 px-3 py-1 rounded inline-block">{receiptNo}</div>
            </div>
            <p className="text-tiny text-ink-muted text-center">
              본 접수증은 식약처 의료기기통합정보시스템 mock 발급본입니다.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
