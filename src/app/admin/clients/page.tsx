/**
 * 거래처 관리 목록 (Phase 3A).
 *
 * 검색/필터는 URL 쿼리 파라미터로 동작 — 새로고침 후에도 상태 유지.
 *   ?q=알티&type=대리점&active=ACTIVE
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listClients } from "@/lib/actions/client";
import { ClientType } from "@prisma/client";
import { ClientListFilter } from "@/components/admin/clients/ListFilter";
import { ToggleActiveButton } from "@/components/admin/clients/ToggleActiveButton";

const TYPE_LABEL: Record<ClientType, string> = {
  AGENCY: "대리점",
  HOSPITAL: "병원",
  PHARMACY: "약국",
  OTHER: "기타",
};

type SearchParams = {
  q?: string;
  type?: string;
  active?: string;
};

export default async function ClientListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN");

  const type =
    searchParams.type && (searchParams.type in TYPE_LABEL)
      ? (searchParams.type as ClientType)
      : ("ALL" as const);
  const active =
    searchParams.active === "ACTIVE" || searchParams.active === "INACTIVE"
      ? searchParams.active
      : "ALL";

  const clients = await listClients({
    q: searchParams.q,
    type,
    active,
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">거래처 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            병원·약국·대리점 등 거래처 정보와 복수 배송지를 관리합니다.
          </p>
        </div>
        <Link
          href="/admin/clients/new"
          className="rounded-md bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:bg-sky-700 transition"
        >
          + 신규 거래처
        </Link>
      </header>

      <ClientListFilter
        defaultValues={{ q: searchParams.q ?? "", type, active }}
      />

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium">코드</th>
              <th className="px-4 py-3 text-left font-medium">업체명</th>
              <th className="px-4 py-3 text-left font-medium">유형</th>
              <th className="px-4 py-3 text-left font-medium">대표자</th>
              <th className="px-4 py-3 text-left font-medium">연락처</th>
              <th className="px-4 py-3 text-right font-medium">배송지</th>
              <th className="px-4 py-3 text-right font-medium">주문</th>
              <th className="px-4 py-3 text-center font-medium">상태</th>
              <th className="px-4 py-3 text-right font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-slate-400">
                  조건에 맞는 거래처가 없습니다.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {c.code}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="hover:text-sky-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {TYPE_LABEL[c.type]}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.representative ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {c._count.addresses}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {c._count.orders}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs font-medium">
                        비활성
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/admin/clients/${c.id}/edit`}
                        className="text-xs text-slate-600 hover:text-sky-700"
                      >
                        편집
                      </Link>
                      <ToggleActiveButton id={c.id} active={c.active} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">총 {clients.length}건</p>
    </div>
  );
}
