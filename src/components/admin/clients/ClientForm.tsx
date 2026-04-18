"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClientType } from "@prisma/client";
import type { ClientCreateInput } from "@/lib/validators/client";
import { createClient, updateClient } from "@/lib/actions/client";

type Mode = "create" | "edit";

export type ClientFormInitial = Partial<ClientCreateInput> & {
  id?: string;
  active?: boolean;
};

const TYPES: { value: ClientType; label: string }[] = [
  { value: "AGENCY", label: "대리점" },
  { value: "HOSPITAL", label: "병원" },
  { value: "PHARMACY", label: "약국" },
  { value: "OTHER", label: "기타" },
];

export function ClientForm({
  mode,
  initial,
}: {
  mode: Mode;
  initial?: ClientFormInitial;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ClientCreateInput>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    type: (initial?.type as ClientType) ?? "AGENCY",
    businessNumber: initial?.businessNumber ?? "",
    representative: initial?.representative ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    postalCode: initial?.postalCode ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
    salesRepId: initial?.salesRepId ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof ClientCreateInput>(key: K, v: ClientCreateInput[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    start(async () => {
      const res =
        mode === "create"
          ? await createClient(values)
          : await updateClient(initial!.id!, values);

      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      const id = "id" in res.data ? res.data.id : initial!.id!;
      router.push(`/admin/clients/${id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-slate-200 bg-white p-6 space-y-4"
    >
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="거래처 코드 *"
          value={values.code}
          onChange={(v) => set("code", v.toUpperCase())}
          disabled={mode === "edit"} // 코드 변경은 편집에서도 방지 (감사 추적용)
          error={fieldErrors.code?.[0]}
          placeholder="예: ALTI-001"
        />
        <Field
          label="업체명 *"
          value={values.name}
          onChange={(v) => set("name", v)}
          error={fieldErrors.name?.[0]}
        />
        <div>
          <label className="block text-xs text-slate-500 mb-1">유형 *</label>
          <select
            value={values.type}
            onChange={(e) => set("type", e.target.value as ClientType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="사업자번호"
          value={values.businessNumber ?? ""}
          onChange={(v) => set("businessNumber", v)}
          placeholder="000-00-00000"
        />
        <Field
          label="대표자"
          value={values.representative ?? ""}
          onChange={(v) => set("representative", v)}
        />
        <Field
          label="연락처"
          value={values.phone ?? ""}
          onChange={(v) => set("phone", v)}
          placeholder="02-0000-0000"
        />
        <Field
          label="이메일"
          value={values.email ?? ""}
          onChange={(v) => set("email", v)}
          error={fieldErrors.email?.[0]}
          placeholder="contact@example.com"
        />
        <Field
          label="우편번호"
          value={values.postalCode ?? ""}
          onChange={(v) => set("postalCode", v)}
        />
        <Field
          label="주소"
          className="col-span-2"
          value={values.address ?? ""}
          onChange={(v) => set("address", v)}
        />
        <Field
          label="결제조건"
          className="col-span-2"
          value={values.paymentTerms ?? ""}
          onChange={(v) => set("paymentTerms", v)}
          placeholder="예: 월말 25일 발주, 익월 말 입금"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
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
          {pending ? "저장중…" : mode === "create" ? "등록" : "저장"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 ${
          error
            ? "border-red-400 focus:border-red-500"
            : "border-slate-300 focus:border-sky-500"
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
