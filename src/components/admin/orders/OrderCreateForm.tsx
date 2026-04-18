"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createOrder,
  searchClientsForOrder,
  searchProductSizesForOrder,
} from "@/lib/actions/order";

type ClientHit = {
  id: string;
  code: string;
  name: string;
  type: string;
  representative: string | null;
};

type ProductHit = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  basePrice: string;
  unitPricePreview: string;
  fixedPriceApplied: boolean;
  discountRate: string | null;
  sizes: Array<{
    id: string;
    sizeCode: string;
    availableStock: number;
    physicalStock: number;
  }>;
};

type LineDraft = {
  productSizeId: string;
  productName: string;
  sizeCode: string;
  unitPricePreview: string;
  availableStock: number;
  quantity: number;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function OrderCreateForm() {
  const router = useRouter();
  const [clientQ, setClientQ] = useState("");
  const [clientHits, setClientHits] = useState<ClientHit[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [picked, setPicked] = useState<ClientHit | null>(null);

  const [orderDate, setOrderDate] = useState(todayIso());
  const [requestedDate, setRequestedDate] = useState("");
  const [note, setNote] = useState("");

  // 라인
  const [productQ, setProductQ] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  async function runClientSearch(q: string) {
    setClientQ(q);
    setClientSearching(true);
    try {
      const rows = await searchClientsForOrder(q);
      setClientHits(rows);
    } finally {
      setClientSearching(false);
    }
  }

  function pickClient(c: ClientHit) {
    setPicked(c);
    setClientHits([]);
    setClientQ("");
  }
  function clearClient() {
    setPicked(null);
    setLines([]);
    setProductHits([]);
    setProductQ("");
  }

  async function runProductSearch(q: string) {
    setProductQ(q);
    if (!picked || !q.trim()) {
      setProductHits([]);
      return;
    }
    setProductSearching(true);
    try {
      const rows = await searchProductSizesForOrder(picked.id, q);
      setProductHits(rows);
    } finally {
      setProductSearching(false);
    }
  }

  function addLine(p: ProductHit, s: ProductHit["sizes"][number]) {
    setLines((prev) => [
      ...prev,
      {
        productSizeId: s.id,
        productName: p.name,
        sizeCode: s.sizeCode,
        unitPricePreview: p.unitPricePreview,
        availableStock: s.availableStock,
        quantity: 1,
      },
    ]);
    setProductHits([]);
    setProductQ("");
  }

  function updateLineQty(idx: number, qty: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, quantity: Math.max(1, qty | 0) } : l,
      ),
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = lines.reduce(
    (sum, l) => sum + Number(l.unitPricePreview) * l.quantity,
    0,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!picked) {
      setError("거래처를 선택하세요.");
      return;
    }
    if (lines.length === 0) {
      setError("최소 1개 이상의 라인이 필요합니다.");
      return;
    }

    start(async () => {
      const res = await createOrder({
        clientId: picked.id,
        orderDate,
        requestedDate: requestedDate || undefined,
        note: note || undefined,
        items: lines.map((l) => ({
          productSizeId: l.productSizeId,
          quantity: l.quantity,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      router.push(`/admin/orders/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
    >
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* 거래처 */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-900 text-sm">거래처 선택 *</h2>
        {picked ? (
          <div className="flex items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-900">{picked.name}</span>
            <span className="font-mono text-xs text-slate-500">
              ({picked.code})
            </span>
            {picked.representative && (
              <span className="text-xs text-slate-500">
                · {picked.representative}
              </span>
            )}
            <button
              type="button"
              onClick={clearClient}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={clientQ}
              onChange={(e) => runClientSearch(e.target.value)}
              placeholder="거래처명·코드·대표자 검색"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            />
            {(clientHits.length > 0 || clientSearching) && (
              <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                {clientSearching && (
                  <li className="px-3 py-2 text-xs text-slate-400">
                    검색 중…
                  </li>
                )}
                {clientHits.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => pickClient(c)}
                    className="px-3 py-2 hover:bg-sky-50 cursor-pointer"
                  >
                    <span className="font-medium">{c.name}</span>{" "}
                    <span className="font-mono text-xs text-slate-500">
                      ({c.code})
                    </span>
                    {c.representative && (
                      <span className="text-xs text-slate-500 ml-2">
                        {c.representative}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {fieldErrors.clientId?.[0] && (
          <p className="text-xs text-red-600">{fieldErrors.clientId[0]}</p>
        )}
      </section>

      {/* 헤더 */}
      <section className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">주문일 *</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">희망 배송일</label>
          <input
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-500 mb-1">메모</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-y"
          />
        </div>
      </section>

      {/* 라인 */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900 text-sm">주문 라인 *</h2>

        {picked && (
          <div className="relative">
            <input
              value={productQ}
              onChange={(e) => runProductSearch(e.target.value)}
              placeholder="제품명 또는 코드로 검색"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            />
            {(productHits.length > 0 || productSearching) && (
              <ul className="absolute z-10 mt-1 w-full max-h-80 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
                {productSearching && (
                  <li className="px-3 py-2 text-xs text-slate-400">
                    검색 중…
                  </li>
                )}
                {productHits.map((p) => (
                  <li
                    key={p.id}
                    className="border-b last:border-b-0 border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="font-mono text-xs text-slate-500">
                          ({p.code})
                        </span>
                        {p.category && (
                          <span className="text-xs text-slate-500 ml-2">
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="text-xs tabular-nums text-slate-600">
                        {Number(p.unitPricePreview).toLocaleString()}원
                        {p.fixedPriceApplied && (
                          <span className="ml-1 rounded bg-emerald-50 text-emerald-700 px-1 text-[10px]">
                            고정가
                          </span>
                        )}
                        {p.discountRate && !p.fixedPriceApplied && (
                          <span className="ml-1 rounded bg-sky-50 text-sky-700 px-1 text-[10px]">
                            {Math.round(Number(p.discountRate) * 100)}% 할인
                          </span>
                        )}
                      </div>
                    </div>
                    {p.sizes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {p.sizes.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => addLine(p, s)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-sky-50 hover:border-sky-300"
                            title={`가용 ${s.availableStock} / 실재고 ${s.physicalStock}`}
                          >
                            {s.sizeCode}{" "}
                            <span className="text-slate-400">
                              ({s.availableStock})
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">
                        등록된 사이즈가 없습니다.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <table className="w-full text-sm border border-slate-200 rounded">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">제품</th>
                <th className="px-3 py-2 text-left font-medium">사이즈</th>
                <th className="px-3 py-2 text-right font-medium">단가(미리)</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">소계</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">{l.productName}</td>
                  <td className="px-3 py-2">{l.sizeCode}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(l.unitPricePreview).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        updateLineQty(i, Number(e.target.value))
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(
                      Number(l.unitPricePreview) * l.quantity
                    ).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-2 text-right text-xs text-slate-600"
                >
                  합계
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {total.toLocaleString()}원
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}

        {!picked && (
          <p className="text-xs text-slate-400">
            거래처를 먼저 선택하면 라인을 추가할 수 있습니다.
          </p>
        )}
      </section>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "생성중…" : "DRAFT 생성"}
        </button>
      </div>
    </form>
  );
}
