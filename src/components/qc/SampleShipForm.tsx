"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createAdjustment } from "@/lib/actions/inventory";

type ClientOption = { id: string; code: string; name: string };
type SizeOption = {
  id: string;
  sizeCode: string;
  productCode: string;
  productName: string;
  physicalStock: number;
  availableStock: number;
};

export function SampleShipForm({
  clients,
  sizes,
}: {
  clients: ClientOption[];
  sizes: SizeOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [clientQuery, setClientQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [qty, setQty] = useState<string>("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [clients, clientQuery]);

  const filteredSizes = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const base = q
      ? sizes.filter(
          (s) =>
            s.productName.toLowerCase().includes(q) ||
            s.productCode.toLowerCase().includes(q) ||
            s.sizeCode.toLowerCase().includes(q),
        )
      : sizes;
    return base.slice(0, 30);
  }, [sizes, productQuery]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const selectedSize = sizes.find((s) => s.id === sizeId) ?? null;

  function reset() {
    setClientId("");
    setClientQuery("");
    setSizeId("");
    setProductQuery("");
    setQty("1");
    setNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!clientId) {
      setError("거래처를 선택해주세요.");
      return;
    }
    if (!sizeId) {
      setError("사이즈를 선택해주세요.");
      return;
    }
    const n = Number.parseInt(qty, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError("수량은 1 이상 정수여야 합니다.");
      return;
    }
    if (selectedSize && n > selectedSize.physicalStock) {
      setError(
        `실재고(${selectedSize.physicalStock})보다 많은 수량은 출고할 수 없습니다.`,
      );
      return;
    }

    const clientLabel = selectedClient
      ? `[${selectedClient.code}] ${selectedClient.name}`
      : "";
    const combinedNote = [clientLabel, note.trim()].filter(Boolean).join(" | ");

    start(async () => {
      const res = await createAdjustment({
        productSizeId: sizeId,
        qty: -n, // 샘플출고 = 음수
        reason: "샘플출고",
        note: combinedNote || undefined,
      });
      if (res.ok) {
        setSuccess(
          `샘플 출고 완료 · 실재고 ${res.data.physicalAfter} / 가용 ${res.data.availableAfter}`,
        );
        reset();
        router.refresh();
      } else {
        setError(res.error ?? "샘플 출고 처리에 실패했습니다.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
    >
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* 거래처 선택 */}
      <div>
        <label className="text-xs font-medium text-slate-600 uppercase">
          거래처
        </label>
        <input
          type="text"
          value={selectedClient ? `[${selectedClient.code}] ${selectedClient.name}` : clientQuery}
          onChange={(e) => {
            setClientQuery(e.target.value);
            setClientId("");
          }}
          placeholder="거래처명/코드 검색"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {!selectedClient && clientQuery && filteredClients.length > 0 && (
          <ul className="mt-1 rounded-md border border-slate-200 bg-white max-h-40 overflow-y-auto text-sm">
            {filteredClients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setClientId(c.id);
                    setClientQuery("");
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-50"
                >
                  <span className="font-mono text-xs text-slate-400 mr-2">
                    {c.code}
                  </span>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 사이즈 선택 */}
      <div>
        <label className="text-xs font-medium text-slate-600 uppercase">
          제품 / 사이즈
        </label>
        <input
          type="text"
          value={
            selectedSize
              ? `${selectedSize.productName} · ${selectedSize.sizeCode} (실재고 ${selectedSize.physicalStock})`
              : productQuery
          }
          onChange={(e) => {
            setProductQuery(e.target.value);
            setSizeId("");
          }}
          placeholder="제품명/코드/사이즈 검색"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {!selectedSize && productQuery && filteredSizes.length > 0 && (
          <ul className="mt-1 rounded-md border border-slate-200 bg-white max-h-60 overflow-y-auto text-sm">
            {filteredSizes.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSizeId(s.id);
                    setProductQuery("");
                  }}
                  disabled={s.physicalStock <= 0}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-50 disabled:opacity-40 disabled:bg-slate-50 flex items-center justify-between"
                >
                  <span>
                    <span className="font-mono text-xs text-slate-400 mr-2">
                      {s.productCode}
                    </span>
                    {s.productName}
                    <span className="ml-2 text-xs font-mono text-slate-500">
                      · {s.sizeCode}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    실 {s.physicalStock} / 가 {s.availableStock}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 수량 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 uppercase">
            수량
          </label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            재고는 이 수량만큼 차감됩니다.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 uppercase">
            메모 (선택)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 영업팀 요청, 학회 부스용"
            maxLength={400}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={pending || !clientId || !sizeId}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "처리중..." : "샘플 출고 기록"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          초기화
        </button>
      </div>
    </form>
  );
}
