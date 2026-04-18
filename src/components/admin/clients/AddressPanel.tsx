"use client";

import { useState, useTransition } from "react";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/actions/client-address";
import type { AddressCreateInput } from "@/lib/validators/client";

type Address = {
  id: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string;
  addressDetail: string | null;
  memo: string | null;
  isDefault: boolean;
  active: boolean;
};

type FormState = AddressCreateInput & { id?: string };

const EMPTY: FormState = {
  label: "",
  recipientName: "",
  phone: "",
  postalCode: "",
  address: "",
  addressDetail: "",
  memo: "",
  isDefault: false,
};

export function AddressPanel({
  clientId,
  initialAddresses,
}: {
  clientId: string;
  initialAddresses: Address[];
}) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing({ ...EMPTY, isDefault: addresses.length === 0 });
    setFieldErrors({});
    setError(null);
  }

  function openEdit(a: Address) {
    setEditing({
      id: a.id,
      label: a.label,
      recipientName: a.recipientName ?? "",
      phone: a.phone ?? "",
      postalCode: a.postalCode ?? "",
      address: a.address,
      addressDetail: a.addressDetail ?? "",
      memo: a.memo ?? "",
      isDefault: a.isDefault,
    });
    setFieldErrors({});
    setError(null);
  }

  function close() {
    setEditing(null);
    setFieldErrors({});
    setError(null);
  }

  function submit() {
    if (!editing) return;
    const { id, ...input } = editing;
    start(async () => {
      const res = id
        ? await updateAddress(id, input)
        : await createAddress(clientId, input);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      // 서버에서 revalidatePath 가 동작하지만 즉시 반영 위해 로컬 갱신도 수행
      // → 간단히 전체 reload 로 정합성 보장 (배송지 수가 많지 않음)
      window.location.reload();
    });
  }

  function onDelete(id: string) {
    if (!confirm("이 배송지를 삭제하시겠습니까?")) return;
    start(async () => {
      const res = await deleteAddress(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    });
  }

  function onSetDefault(id: string) {
    start(async () => {
      const res = await setDefaultAddress(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id })),
      );
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">배송지 관리</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            복수 배송지 등록 가능. 기본 배송지는 1개만 지정됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-sky-700"
        >
          + 배송지 추가
        </button>
      </div>

      {addresses.length === 0 && !editing ? (
        <p className="text-center py-8 text-sm text-slate-400">
          등록된 배송지가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {addresses.map((a) => (
            <li key={a.id} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{a.label}</span>
                  {a.isDefault && (
                    <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 text-xs font-medium">
                      기본
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 mt-0.5">
                  {a.address}
                  {a.addressDetail ? ` ${a.addressDetail}` : ""}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.recipientName ?? "-"} · {a.phone ?? "-"}
                  {a.memo ? ` · ${a.memo}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {!a.isDefault && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onSetDefault(a.id)}
                    className="text-slate-600 hover:text-sky-700 disabled:opacity-50"
                  >
                    기본지정
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="text-slate-600 hover:text-sky-700"
                >
                  편집
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(a.id)}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-4 rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3"
        >
          <h3 className="font-medium text-slate-800 text-sm">
            {editing.id ? "배송지 편집" : "새 배송지"}
          </h3>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="별칭 *"
              value={editing.label}
              onChange={(v) => setEditing({ ...editing, label: v })}
              error={fieldErrors.label?.[0]}
              placeholder="예: 본점 창고"
            />
            <Field
              label="수령인"
              value={editing.recipientName ?? ""}
              onChange={(v) => setEditing({ ...editing, recipientName: v })}
            />
            <Field
              label="연락처"
              value={editing.phone ?? ""}
              onChange={(v) => setEditing({ ...editing, phone: v })}
            />
            <Field
              label="우편번호"
              value={editing.postalCode ?? ""}
              onChange={(v) => setEditing({ ...editing, postalCode: v })}
            />
            <Field
              label="주소 *"
              className="col-span-2"
              value={editing.address}
              onChange={(v) => setEditing({ ...editing, address: v })}
              error={fieldErrors.address?.[0]}
            />
            <Field
              label="상세주소"
              className="col-span-2"
              value={editing.addressDetail ?? ""}
              onChange={(v) => setEditing({ ...editing, addressDetail: v })}
            />
            <Field
              label="배송 메모"
              className="col-span-2"
              value={editing.memo ?? ""}
              onChange={(v) => setEditing({ ...editing, memo: v })}
              placeholder="예: 3층 창고 옆 문, 금~월요일 수령 불가"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.isDefault}
              onChange={(e) =>
                setEditing({ ...editing, isDefault: e.target.checked })
              }
            />
            <span>기본 배송지로 설정</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-sky-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? "저장중…" : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-300 focus:border-sky-500"
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
