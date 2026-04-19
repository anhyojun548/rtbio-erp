"use client";

/**
 * 제품 상세 페이지용 유통기한 로트 패널 — 사이즈별로 로트 목록 + 추가.
 *
 * 초기 로트 목록은 서버에서 주입 (initialLots).
 * 추가/삭제 후엔 router.refresh() 로 서버 재렌더.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createExpiryLot, deleteExpiryLot } from "@/lib/actions/expiry";
import { classifyExpiry, type ExpiryStage } from "@/lib/validators/expiry";

type Size = { id: string; sizeCode: string };

type Lot = {
  id: string;
  productSizeId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  remainingQty: number;
  note: string | null;
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

export function LotsPanel({
  sizes,
  initialLots,
}: {
  sizes: Size[];
  initialLots: Lot[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState(() =>
    new Date(new Date().setFullYear(new Date().getFullYear() + 2))
      .toISOString()
      .slice(0, 10),
  );
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function reset() {
    setShowForm(false);
    setLotNumber("");
    setQuantity("");
    setNote("");
    setMsg(null);
  }

  function onAdd() {
    if (!sizeId) {
      setMsg({ type: "err", text: "사이즈를 선택해주세요." });
      return;
    }
    if (!lotNumber.trim()) {
      setMsg({ type: "err", text: "로트 번호를 입력해주세요." });
      return;
    }
    const n = Number(quantity);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      setMsg({ type: "err", text: "수량은 1 이상의 정수여야 합니다." });
      return;
    }
    start(async () => {
      const res = await createExpiryLot({
        productSizeId: sizeId,
        lotNumber: lotNumber.trim(),
        expiryDate: new Date(expiryDate),
        quantity: n,
        note: note.trim() ? note : undefined,
      });
      if (!res.ok) {
        setMsg({ type: "err", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "로트가 등록되었습니다." });
      setLotNumber("");
      setQuantity("");
      setNote("");
      router.refresh();
    });
  }

  async function onDelete(lot: Lot) {
    if (!window.confirm(`로트 "${lot.lotNumber}" 를 삭제할까요?`)) return;
    setBusyId(lot.id);
    const res = await deleteExpiryLot(lot.id);
    setBusyId(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  const sizeMap = new Map(sizes.map((s) => [s.id, s.sizeCode]));
  const sortedLots = [...initialLots].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">유통기한 로트</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            입고 배치별로 로트·유통기한을 기록합니다 (R19).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          {showForm ? "닫기" : "+ 로트 추가"}
        </button>
      </header>

      {showForm && (
        <div className="rounded-md border border-sky-200 bg-sky-50/40 p-3 space-y-2">
          {msg && (
            <p
              className={`text-sm rounded px-2 py-1.5 border ${
                msg.type === "ok"
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              {msg.text}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                사이즈 *
              </label>
              <select
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
              >
                {sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sizeCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                로트 번호 *
              </label>
              <input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="예: LOT-26-001"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                만료일 *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">
                수량 *
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">비고</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="(선택)"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-300 bg-white text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium">만료일</th>
              <th className="px-3 py-1.5 font-medium">단계</th>
              <th className="px-3 py-1.5 font-medium">사이즈</th>
              <th className="px-3 py-1.5 font-medium">로트</th>
              <th className="px-3 py-1.5 font-medium text-right">원본</th>
              <th className="px-3 py-1.5 font-medium text-right">잔여</th>
              <th className="px-3 py-1.5 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedLots.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-slate-400 text-xs"
                >
                  등록된 로트가 없습니다.
                </td>
              </tr>
            )}
            {sortedLots.map((l) => {
              const cls = classifyExpiry(new Date(l.expiryDate));
              return (
                <tr key={l.id}>
                  <td className="px-3 py-1.5 tabular-nums">
                    {new Date(l.expiryDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 border ${STAGE_BADGE[cls.stage]}`}
                    >
                      {STAGE_LABEL[cls.stage]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    {sizeMap.get(l.productSizeId) ?? l.productSizeId}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {l.lotNumber}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {l.quantity.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                    {l.remainingQty.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(l)}
                      disabled={busyId === l.id}
                      className="rounded-md border border-red-200 text-red-600 px-2 py-0.5 text-xs hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === l.id ? "…" : "삭제"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
