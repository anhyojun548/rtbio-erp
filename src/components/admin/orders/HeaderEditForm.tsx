"use client";

import { useState, useTransition } from "react";
import { updateOrder } from "@/lib/actions/order";

type ClientAddress = {
  id: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string;
  addressDetail: string | null;
  memo: string | null;
  isDefault: boolean;
};

function toIsoDate(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HeaderEditForm({
  orderId,
  editable,
  addresses,
  initial,
}: {
  orderId: string;
  editable: boolean;
  addresses: ClientAddress[];
  initial: {
    orderDate: string;
    requestedDate: string | null;
    note: string | null;
    shipToAddressId: string | null;
    shipToLabel: string | null;
    shipToRecipient: string | null;
    shipToPhone: string | null;
    shipToPostalCode: string | null;
    shipToAddress: string | null;
    shipToAddressDetail: string | null;
    shipToMemo: string | null;
    shipMethod: string | null;
  };
}) {
  const [orderDate, setOrderDate] = useState(toIsoDate(initial.orderDate));
  const [requestedDate, setRequestedDate] = useState(
    toIsoDate(initial.requestedDate),
  );
  const [note, setNote] = useState(initial.note ?? "");
  const [shipToAddressId, setShipToAddressId] = useState(
    initial.shipToAddressId ?? "",
  );
  const [shipToLabel, setShipToLabel] = useState(initial.shipToLabel ?? "");
  const [shipToRecipient, setShipToRecipient] = useState(
    initial.shipToRecipient ?? "",
  );
  const [shipToPhone, setShipToPhone] = useState(initial.shipToPhone ?? "");
  const [shipToPostalCode, setShipToPostalCode] = useState(
    initial.shipToPostalCode ?? "",
  );
  const [shipToAddress, setShipToAddress] = useState(
    initial.shipToAddress ?? "",
  );
  const [shipToAddressDetail, setShipToAddressDetail] = useState(
    initial.shipToAddressDetail ?? "",
  );
  const [shipToMemo, setShipToMemo] = useState(initial.shipToMemo ?? "");
  const [shipMethod, setShipMethod] = useState(initial.shipMethod ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pickAddress(id: string) {
    setShipToAddressId(id);
    if (!id) return;
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setShipToLabel(a.label);
    setShipToRecipient(a.recipientName ?? "");
    setShipToPhone(a.phone ?? "");
    setShipToPostalCode(a.postalCode ?? "");
    setShipToAddress(a.address);
    setShipToAddressDetail(a.addressDetail ?? "");
    setShipToMemo(a.memo ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await updateOrder(orderId, {
        orderDate: orderDate || undefined,
        requestedDate: requestedDate || undefined,
        note: note || undefined,
        shipToAddressId: shipToAddressId || undefined,
        shipToLabel: shipToLabel || undefined,
        shipToRecipient: shipToRecipient || undefined,
        shipToPhone: shipToPhone || undefined,
        shipToPostalCode: shipToPostalCode || undefined,
        shipToAddress: shipToAddress || undefined,
        shipToAddressDetail: shipToAddressDetail || undefined,
        shipToMemo: shipToMemo || undefined,
        shipMethod: shipMethod || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">헤더 · 배송지</h2>
        {!editable && (
          <span className="text-xs rounded bg-slate-100 text-slate-500 px-2 py-0.5">
            DRAFT 가 아닙니다 — 편집 불가
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <fieldset disabled={!editable} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="주문일"
            type="date"
            value={orderDate}
            onChange={setOrderDate}
          />
          <Field
            label="희망 배송일"
            type="date"
            value={requestedDate}
            onChange={setRequestedDate}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">메모</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-y"
          />
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              등록된 배송지
            </label>
            <select
              value={shipToAddressId}
              onChange={(e) => pickAddress(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">-- 임시주소 직접 입력 --</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.isDefault ? "★ " : ""}
                  {a.label} ({a.address})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="별칭" value={shipToLabel} onChange={setShipToLabel} />
            <Field
              label="수령인"
              value={shipToRecipient}
              onChange={setShipToRecipient}
            />
            <Field
              label="연락처"
              value={shipToPhone}
              onChange={setShipToPhone}
            />
            <Field
              label="우편번호"
              value={shipToPostalCode}
              onChange={setShipToPostalCode}
            />
          </div>
          <Field label="주소" value={shipToAddress} onChange={setShipToAddress} />
          <Field
            label="상세주소"
            value={shipToAddressDetail}
            onChange={setShipToAddressDetail}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                배송메모
              </label>
              <input
                value={shipToMemo}
                onChange={(e) => setShipToMemo(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                배송방법
              </label>
              <select
                value={shipMethod}
                onChange={(e) => setShipMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- 선택 --</option>
                <option value="택배">택배</option>
                <option value="방문수령">방문수령</option>
                <option value="퀵">퀵</option>
              </select>
            </div>
          </div>
        </div>

        {editable && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "저장중…" : "헤더/배송지 저장"}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
