/**
 * 판매 계약서 목록 — Phase 3G-2 (R20).
 *
 * 기능:
 *   - 상단 4장 stat 카드: ACTIVE / ENDING_SOON / EXPIRED / FUTURE
 *   - 필터: 상태 · 서명완료 · 검색(제목/거래처명/거래처코드)
 *   - 테이블: 시작일 desc 정렬 + 상태 뱃지 + 거래처 링크 + PDF 링크
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import {
  listContracts,
  countContractStatuses,
} from "@/lib/actions/sales-contract";
import type { ContractStatus } from "@/lib/validators/sales-contract";
import { CONTRACT_STATUS_LABEL } from "@/lib/validators/sales-contract";
import { ContractFilterBar } from "@/components/admin/contracts/ContractFilterBar";

type SearchParams = {
  q?: string;
  status?: string;
  signed?: string;
};

const STATUSES: ContractStatus[] = [
  "ACTIVE",
  "ENDING_SOON",
  "EXPIRED",
  "FUTURE",
];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const statusRaw = searchParams.status?.trim() ?? "ALL";
  const status: ContractStatus | "ALL" = STATUSES.includes(
    statusRaw as ContractStatus,
  )
    ? (statusRaw as ContractStatus)
    : "ALL";
  const signedRaw = searchParams.signed?.trim();
  const signed: boolean | undefined =
    signedRaw === "1" ? true : signedRaw === "0" ? false : undefined;
  const q = searchParams.q?.trim() ?? "";

  const [rows, counts] = await Promise.all([
    listContracts({ q: q || undefined, signed, limit: 500 }),
    countContractStatuses(),
  ]);

  const filtered =
    status === "ALL" ? rows : rows.filter((r) => r.status === status);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display m-0">📝 판매 계약서</h1>
          <p className="text-caption text-ink-secondary mt-1">
            거래처별 계약 시작/종료일·서명 여부·PDF 를 관리합니다 (R20). 만료 30일
            이내 계약은 자동으로 "만료임박" 상태가 됩니다.
          </p>
        </div>
        <Link
          href="/admin/contracts/new"
          className="h-9 px-4 inline-flex items-center bg-primary text-white text-caption font-semibold rounded-xs hover:bg-primary-light transition"
        >
          + 신규 계약
        </Link>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={CONTRACT_STATUS_LABEL.ACTIVE}
          count={counts.ACTIVE}
          color="emerald"
          status="ACTIVE"
          active={status === "ACTIVE"}
        />
        <StatCard
          label={CONTRACT_STATUS_LABEL.ENDING_SOON}
          count={counts.ENDING_SOON}
          color="amber"
          status="ENDING_SOON"
          active={status === "ENDING_SOON"}
        />
        <StatCard
          label={CONTRACT_STATUS_LABEL.EXPIRED}
          count={counts.EXPIRED}
          color="red"
          status="EXPIRED"
          active={status === "EXPIRED"}
        />
        <StatCard
          label={CONTRACT_STATUS_LABEL.FUTURE}
          count={counts.FUTURE}
          color="sky"
          status="FUTURE"
          active={status === "FUTURE"}
        />
      </section>

      <ContractFilterBar
        defaults={{ q, status, signed: signedRaw ?? "" }}
      />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">제목</th>
              <th className="px-4 py-3 text-left font-medium">거래처</th>
              <th className="px-4 py-3 text-left font-medium">시작일</th>
              <th className="px-4 py-3 text-left font-medium">종료일</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">서명</th>
              <th className="px-4 py-3 text-left font-medium">PDF</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link
                    href={`/admin/contracts/${r.id}`}
                    className="hover:underline"
                  >
                    {r.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clients/${r.client.id}`}
                    className="text-sky-700 hover:underline"
                  >
                    {r.client.name}
                  </Link>
                  <span className="ml-1 text-xs text-slate-400 font-mono">
                    {r.client.code}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {r.startDate.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {r.endDate ? r.endDate.toISOString().slice(0, 10) : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} daysLeft={r.daysLeft} />
                </td>
                <td className="px-4 py-3">
                  {r.signed ? (
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs">
                      ✓ 서명
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">미서명</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.pdfUrl ? (
                    <a
                      href={r.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 hover:underline text-xs"
                    >
                      📄 열기
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/contracts/${r.id}`}
                    className="text-xs text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    상세/편집
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  조회 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
  status,
  active,
}: {
  label: string;
  count: number;
  color: "emerald" | "amber" | "red" | "sky";
  status: ContractStatus;
  active: boolean;
}) {
  const classes: Record<
    typeof color,
    { bg: string; text: string; border: string }
  > = {
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    sky: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  };
  const c = classes[color];
  return (
    <Link
      href={`/admin/contracts?status=${status}`}
      className={`block rounded-lg border ${c.border} ${c.bg} p-4 transition hover:shadow-sm ${active ? "ring-2 ring-offset-1 ring-slate-900/20" : ""}`}
    >
      <div className={`text-xs font-medium ${c.text} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${c.text} tabular-nums`}>{count}</div>
      <div className="text-xs text-slate-500 mt-0.5">계약</div>
    </Link>
  );
}

function StatusBadge({
  status,
  daysLeft,
}: {
  status: ContractStatus;
  daysLeft: number | null;
}) {
  const map: Record<ContractStatus, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    ENDING_SOON: "bg-amber-100 text-amber-700",
    EXPIRED: "bg-red-100 text-red-700",
    FUTURE: "bg-sky-100 text-sky-700",
  };
  const label = CONTRACT_STATUS_LABEL[status];
  const suffix =
    status === "ENDING_SOON" && daysLeft !== null
      ? ` · ${daysLeft}일 남음`
      : status === "EXPIRED" && daysLeft !== null
        ? ` · ${Math.abs(daysLeft)}일 경과`
        : "";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${map[status]}`}>
      {label}
      {suffix}
    </span>
  );
}
