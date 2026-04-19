/**
 * QC 업무 설정 — 업무시간 · 택배 마감시간 읽기 전용 표시.
 *
 * 수정은 경영지원(ADMIN) 전용 `/admin/settings` 에서 처리.
 * QC 는 현재 설정값 확인만 가능.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listSettings } from "@/lib/actions/tenant-setting";
import type { TenantSettingKey } from "@/lib/validators/tenant-setting";

const QC_VISIBLE_KEYS: TenantSettingKey[] = [
  "business_hour_start",
  "business_hour_end",
  "shipping_cutoff",
];

const LABEL: Record<string, { label: string; hint: string }> = {
  business_hour_start: {
    label: "업무 시작시간",
    hint: "HH:MM 24h 형식",
  },
  business_hour_end: {
    label: "업무 종료시간",
    hint: "HH:MM 24h 형식",
  },
  shipping_cutoff: {
    label: "택배 마감시간",
    hint: "이 시간 이후 접수는 익일 출고",
  },
};

export default async function QcSettingsPage() {
  const user = await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const rows = await listSettings();
  const filtered = rows.filter((r) =>
    QC_VISIBLE_KEYS.includes(r.key as TenantSettingKey),
  );

  const isAdmin = user.role === "ADMIN" || user.role === "TENANT_OWNER";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">업무 설정</h1>
          <p className="text-sm text-slate-500 mt-1">
            업무시간과 택배 마감시간을 확인합니다.{" "}
            {isAdmin ? (
              <span>
                설정 변경은{" "}
                <Link
                  href="/admin/settings"
                  className="text-sky-700 hover:underline"
                >
                  테넌트 설정
                </Link>{" "}
                페이지에서 가능합니다.
              </span>
            ) : (
              <span>설정 변경은 경영지원(ADMIN)에게 요청해주세요.</span>
            )}
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {filtered.map((r) => {
            const meta = LABEL[r.key];
            return (
              <li key={r.key} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {meta?.label ?? r.key}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {meta?.hint ?? r.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">
                    {r.value ?? (
                      <span className="text-slate-400 text-base font-normal">
                        미설정
                      </span>
                    )}
                  </div>
                  {r.updatedAt && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      업데이트 {new Date(r.updatedAt).toLocaleDateString("ko-KR")}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin && (
        <div className="text-right">
          <Link
            href="/admin/settings"
            className="inline-block rounded-md bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
          >
            ⚙️ 설정 편집으로 이동
          </Link>
        </div>
      )}
    </div>
  );
}
