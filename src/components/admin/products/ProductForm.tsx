"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductCreateInput } from "@/lib/validators/product";
import { createProduct, updateProduct } from "@/lib/actions/product";

type Mode = "create" | "edit";

export type ProductFormInitial = Partial<ProductCreateInput> & {
  id?: string;
  active?: boolean;
};

type FormState = {
  code: string;
  name: string;
  brand: string;
  category: string;
  part: string;
  basePrice: string;
  expiryMonths: string;
};

export function ProductForm({
  mode,
  initial,
  categories,
}: {
  mode: Mode;
  initial?: ProductFormInitial;
  categories: string[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    brand: initial?.brand ?? "",
    category: initial?.category ?? "",
    part: initial?.part ?? "",
    basePrice:
      initial?.basePrice !== undefined ? String(initial.basePrice) : "",
    expiryMonths:
      initial?.expiryMonths !== undefined && initial.expiryMonths !== null
        ? String(initial.expiryMonths)
        : "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof FormState>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    const input: ProductCreateInput = {
      code: values.code,
      name: values.name,
      brand: values.brand || undefined,
      category: values.category || undefined,
      part: values.part || undefined,
      basePrice: values.basePrice,
      expiryMonths: values.expiryMonths || undefined,
    };

    start(async () => {
      const res =
        mode === "create"
          ? await createProduct(input)
          : await updateProduct(initial!.id!, input);

      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      const id = "id" in res.data ? res.data.id : initial!.id!;
      router.push(`/admin/products/${id}`);
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
          label="제품 코드 *"
          value={values.code}
          onChange={(v) => set("code", v.toUpperCase())}
          disabled={mode === "edit"}
          error={fieldErrors.code?.[0]}
          placeholder="예: SF-SHOULDER-L"
        />
        <Field
          label="제품명 *"
          value={values.name}
          onChange={(v) => set("name", v)}
          error={fieldErrors.name?.[0]}
        />
        <Field
          label="브랜드"
          value={values.brand}
          onChange={(v) => set("brand", v)}
        />
        <div>
          <label className="block text-xs text-slate-500 mb-1">카테고리</label>
          <input
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            list="product-category-list"
            placeholder="예: 관절"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <datalist id="product-category-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <Field
          label="부위"
          value={values.part}
          onChange={(v) => set("part", v)}
          placeholder="예: 어깨, 하지"
        />
        <Field
          label="기준단가(원) *"
          type="number"
          value={values.basePrice}
          onChange={(v) => set("basePrice", v)}
          error={fieldErrors.basePrice?.[0]}
          placeholder="0"
        />
        <Field
          label="유통기한(개월)"
          type="number"
          value={values.expiryMonths}
          onChange={(v) => set("expiryMonths", v)}
          error={fieldErrors.expiryMonths?.[0]}
          placeholder="예: 24"
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
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
