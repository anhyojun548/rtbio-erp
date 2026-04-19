"use client";

/**
 * 유통기한 보드 — 검색/단계/빈로트 토글 + 로트 테이블 (수정/삭제 인라인).
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { updateExpiryLot, deleteExpiryLot } from "@/lib/actions/expiry";
import type { ExpiryStage } from "@/lib/validators/expiry";

type Row = {
  id: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  remainingQty: number;
  note: string | null;
  stage: ExpiryStage;
  daysLeft: number;
  sizeCode: string;
  productSizeId: string;
  productId: string;
  productCode: string;
  productName: string;
  brand: string | null;
};

const STAGE_LABEL: Record<ExpiryStage, string> = {
  EXPIRED: "만료",
  URGENT: "30일 이내",
  SOON: "90일 이내",
  SAFE: "안전",
};

const STAGE_BADGE: Record<ExpiryStage, string> = {
  EXPIRED: "bg-red-100 text-red-800 border-red-200",
  URGENT: "bg-amber-100 text-amber-800 border-amber-200",
  SOON: "bg-sky-100 text-sky-800 border-sky-200",
  SAFE: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function ExpiryBoard({
  rows,
  defaults,
}: {
  rows: Row[];
  defaults: { q: string; stage: ExpiryStage | "ALL"; includeEmpty: boolean };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(defaults.q);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  function applyParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`/admin/expiry?${next.toString()}`));
  }

  function applyQ() {
    applyParam("q", q.trim());
  }

  function openEdit(r: Row) {
    setEditId(r.id);
    setEditQty(String(r.remainingQty));
    setEditNote(r.note ?? "");
  }

  function closeEdit() {
    setEditId(null);
    setEditQty("");
    setEditNote("");
  }

  async function saveEdit(r: Row) {
    const n = Number(editQty);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      alert("잔여수량은 0 이상의 정수여야 합니다.");
      return;
    }
    if (n > r.quantity) {
      alert(`잔여수량은 원본 수량(${r.quantity})을 초과할 수 없습니다.`);
      return;
    }
    setBusyId(r.id);
    const res = await updateExpiryLot(r.id, {
      remainingQty: n,
      note: editNote.trim() ? editNote : undefined,
    });
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    closeEdit();
    router.refresh();
  }

  async function onDelete(r: Row) {
    if (
      !window.confirm(
        `로트 "${r.lotNumber}" 를 삭제할까요?\n제품: ${r.productName} / ${r.sizeCode}\n잔여 ${r.remainingQty}개`,
      )
    )
      return;
    setBusyId(r.id);
    const res = await deleteExpiryLot(r.id);
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-slate-500 mb-1">검색</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyQ()}
            placeholder="제품명·코드·로트번호"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">단계</label>
          <select
            value={defaults.stage}
            onChange={(e) => applyParam("stage", e.target.value === "ALL" ? "" : e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="ALL">전체</option>
            <option value="EXPIRED">만료</option>
            <option value="URGENT">30일 이내</option>
            <option value="SOON">90일 이내</option>
            <option value="SAFE">안전</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={defaults.includeEmpty}
            onChange={(e) =>
              applyParam("includeEmpty", e.target.checked ? "1" : "")
            }
            className="rounded border-slate-300"
          />
          소진된 로트 포함
        </label>
        <button
          type="button"
          onClick={applyQ}
          disabled={pending}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "검색 중…" : "검색"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">만료일</th>
              <th className="px-3 py-2 font-medium">단계</th>
              <th className="px-3 py-2 font-medium">제품 / 사이즈</th>
              <th className="px-3 py-2 font-medium">로트번호</th>
              <th className="px-3 py-2 font-medium text-right">원본</th>
              <th className="px-3 py-2 font-medium text-right">잔여</th>
              <th className="px-3 py-2 font-medium">비고</th>
              <th className="px-3 py-2 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-slate-400 text-sm"
                >
                  조건에 맞는 로트가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 tabular-nums">
                  <div className="font-medium">
                    {new Date(r.expiryDate).toLocaleDateString("ko-KR")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.daysLeft < 0
                      ? `${Math.abs(r.daysLeft)}일 경과`
                      : `D-${r.daysLeft}`}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block text-xs font-medium rounded px-2 py-0.5 border ${STAGE_BADGE[r.stage]}`}
                  >
                    {STAGE_LABEL[r.stage]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/products/${r.productId}`}
                    className="font-medium text-slate-900 hover:text-sky-700"
                  >
                    {r.productName}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {r.productCode} · {r.sizeCode}
                    {r.brand && ` · ${r.brand}`}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.lotNumber}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  {r.quantity.toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {editId === r.id ? (
                    <input
                      type="number"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      min={0}
                      max={r.quantity}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right"
                    />
                  ) : (
                    <span
                      className={
                        r.remainingQty === 0
                          ? "text-slate-300"
                          : r.stage === "EXPIRED"
                            ? "text-red-600"
                            : ""
                      }
                    >
                      {r.remainingQty.toLocaleString("ko-KR")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 max-w-[220px]">
                  {editId === r.id ? (
                    <input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="메모"
                      className="w-full rounded border border-slate-300 px-2 py-1"
                    />
                  ) : (
                    <span className="truncate block">{r.note ?? ""}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                  {editId === r.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveEdit(r)}
                        disabled={busyId === r.id}
                        className="rounded-md bg-sky-600 text-white px-2.5 py-1 text-xs hover:bg-sky-700 disabled:opacity-50"
                      >
                        {busyId === r.id ? "…" : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={closeEdit}
                        disabled={busyId === r.id}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-50"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs hover:bg-slate-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-red-200 text-red-600 px-2.5 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
