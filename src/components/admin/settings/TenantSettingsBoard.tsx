"use client";

/**
 * 테넌트 설정 편집 Board (R13).
 *
 * - 시드된 5개 알려진 키를 나열.
 * - "저장" 하나로 변경된 항목만 일괄 upsert.
 * - 업무시간(start < end) 서버에서 검증 → 실패 시 전체 거부 (사용자는 이유 확인).
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateSettings } from "@/lib/actions/tenant-setting";
import type { TenantSettingKey } from "@/lib/validators/tenant-setting";

type Row = {
  key: TenantSettingKey;
  value: string | null;
  description: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

type Msg = { type: "ok" | "err"; text: string } | null;

const INPUT_TYPE_BY_KEY: Record<TenantSettingKey, "time" | "text" | "number"> = {
  business_hour_start: "time",
  business_hour_end: "time",
  shipping_cutoff: "time",
  reorder_multiplier: "number",
  vat_rate: "number",
};

const LABEL_BY_KEY: Record<TenantSettingKey, string> = {
  business_hour_start: "업무 시작 시각",
  business_hour_end: "업무 종료 시각",
  shipping_cutoff: "택배 마감시간",
  reorder_multiplier: "재고 알람 배수",
  vat_rate: "부가세율",
};

const STEP_BY_KEY: Record<TenantSettingKey, string | undefined> = {
  business_hour_start: undefined,
  business_hour_end: undefined,
  shipping_cutoff: undefined,
  reorder_multiplier: "0.1",
  vat_rate: "0.01",
};

export function TenantSettingsBoard({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [form, setForm] = useState<Record<TenantSettingKey, string>>(() => {
    const init = {} as Record<TenantSettingKey, string>;
    for (const r of rows) init[r.key] = r.value ?? "";
    return init;
  });

  const initial = useMemo(() => {
    const map = {} as Record<TenantSettingKey, string>;
    for (const r of rows) map[r.key] = r.value ?? "";
    return map;
  }, [rows]);

  const dirtyKeys = (Object.keys(form) as TenantSettingKey[]).filter(
    (k) => form[k] !== initial[k],
  );
  const hasChanges = dirtyKeys.length > 0;

  function onChange(key: TenantSettingKey, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
    setMsg(null);
  }

  function onReset() {
    setForm(initial);
    setMsg(null);
  }

  function onSave() {
    if (!hasChanges) return;
    const items = dirtyKeys.map((k) => ({ key: k, value: form[k].trim() }));
    setMsg(null);
    start(async () => {
      const r = await bulkUpdateSettings({ items });
      if (r.ok) {
        setMsg({ type: "ok", text: `${r.data.count}건 저장되었습니다.` });
        router.refresh();
      } else {
        const first = r.fieldErrors
          ? Object.values(r.fieldErrors).flat()[0]
          : undefined;
        setMsg({ type: "err", text: first ?? r.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div
          role="alert"
          className={`rounded-md border px-3 py-2 text-sm ${
            msg.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
        {rows.map((r) => {
          const inputType = INPUT_TYPE_BY_KEY[r.key];
          const step = STEP_BY_KEY[r.key];
          const dirty = form[r.key] !== initial[r.key];
          return (
            <div
              key={r.key}
              className="p-4 grid grid-cols-1 md:grid-cols-[200px_1fr_240px] gap-3 items-start"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {LABEL_BY_KEY[r.key]}
                  {dirty && (
                    <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">
                      변경됨
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                  {r.key}
                </div>
              </div>

              <div>
                <input
                  type={inputType}
                  step={step}
                  value={form[r.key]}
                  onChange={(e) => onChange(r.key, e.target.value)}
                  className={`w-full rounded border px-2 py-1.5 text-sm font-mono ${
                    dirty ? "border-amber-400 bg-amber-50" : "border-slate-300"
                  } focus:outline-none focus:ring-1 focus:ring-sky-500`}
                  placeholder={
                    r.key === "vat_rate"
                      ? "0.10"
                      : r.key === "reorder_multiplier"
                        ? "2.5"
                        : r.key === "shipping_cutoff"
                          ? "15:30"
                          : "09:00"
                  }
                />
                <p className="text-[11px] text-slate-500 mt-1">{r.description}</p>
              </div>

              <div className="text-[11px] text-slate-500 text-right">
                {r.updatedAt ? (
                  <>
                    <div>
                      최종 수정{" "}
                      {new Date(r.updatedAt).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    {r.updatedBy && (
                      <div className="font-mono text-slate-400">
                        by {r.updatedBy === "seed" ? "시드" : r.updatedBy.slice(-6)}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-slate-400">미설정 (시드 필요)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-slate-500">
          {hasChanges ? `${dirtyKeys.length}개 항목 변경됨` : "변경 사항 없음"}
        </span>
        <button
          type="button"
          disabled={pending || !hasChanges}
          onClick={onReset}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          초기화
        </button>
        <button
          type="button"
          disabled={pending || !hasChanges}
          onClick={onSave}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
