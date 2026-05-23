/**
 * 거래처 관리 목록 (Phase 3A → 2026-05-22 UI 재작성)
 *
 * 검색/필터는 URL 쿼리로 동작 — 새로고침 후에도 상태 유지.
 *   ?q=알티&type=AGENCY&active=ACTIVE
 *
 * 2026-05-22: prototype 디자인 적용 (PageHeader + FilterBar + DataTable + StatusBadge).
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listClients } from "@/lib/actions/client";
import { ClientType } from "@prisma/client";
import { ClientListFilter } from "@/components/admin/clients/ListFilter";
import { ToggleActiveButton } from "@/components/admin/clients/ToggleActiveButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/shared/Button";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

const TYPE_LABEL: Record<ClientType, string> = {
  AGENCY:   "대리점",
  HOSPITAL: "병원",
  PHARMACY: "약국",
  OTHER:    "기타",
};

const TYPE_COLOR: Record<ClientType, string> = {
  AGENCY:   "bg-purple-light  text-purple",
  HOSPITAL: "bg-accent-light  text-accent-dark",
  PHARMACY: "bg-warning-light text-warning",
  OTHER:    "bg-canvas        text-ink-secondary",
};

type SearchParams = {
  q?: string;
  type?: string;
  active?: string;
};

type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

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

  // 컬럼 정의
  const columns: ColumnDef<ClientRow>[] = [
    {
      key: "code",
      label: "코드",
      width: "100px",
      cellClassName: "font-mono text-tiny text-ink-secondary",
    },
    {
      key: "name",
      label: "업체명",
      render: (c) => (
        <Link href={`/admin/clients/${c.id}`} className="font-semibold text-ink hover:text-primary hover:underline"> {c.name}
        </Link> ),
    },
    {
      key: "type",
      label: "유형",
      width: "90px",
      render: (c) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-tiny font-semibold ${TYPE_COLOR[c.type]}`}> {TYPE_LABEL[c.type]}
        </span> ),
    },
    {
      key: "representative",
      label: "대표자",
      hideOnMobile: true,
      render: (c) => c.representative ?? "—",
    },
    {
      key: "phone",
      label: "연락처",
      hideOnMobile: true,
      render: (c) => c.phone ?? "—",
    },
    {
      key: "addresses",
      label: "배송지",
      align: "right",
      width: "70px",
      cellClassName: "tabular-nums",
      render: (c) => c._count.addresses,
    },
    {
      key: "orders",
      label: "주문",
      align: "right",
      width: "70px",
      cellClassName: "tabular-nums",
      render: (c) => c._count.orders,
    },
    {
      key: "active",
      label: "상태",
      align: "center",
      width: "80px",
      render: (c) => c.active ? (
          <span className="inline-flex items-center rounded-full bg-success-light text-success px-2 py-0.5 text-tiny font-semibold"> 활성
          </span> ) : (
          <span className="inline-flex items-center rounded-full bg-canvas text-ink-muted px-2 py-0.5 text-tiny font-semibold"> 비활성
          </span> ),
    },
    {
      key: "actions",
      label: "액션",
      align: "right",
      width: "120px",
      render: (c) => (
        <div className="inline-flex gap-2 items-center">
          <Link href={`/admin/clients/${c.id}/edit`} className="text-tiny text-ink-secondary hover:text-primary hover:underline"> 편집
          </Link>
          <ToggleActiveButton id={c.id} active={c.active} />
        </div> ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="거래처 관리"
        subtitle="병원·약국·대리점 등 거래처 정보와 복수 배송지를 관리합니다."
        actions={
          <Button href="/admin/clients/new" variant="primary"> + 신규 거래처
          </Button> }
      />

      <ClientListFilter
        defaultValues={{ q: searchParams.q ?? "", type, active }}
      />

      <DataTable
        columns={columns}
        rows={clients}
        keyField="id"
        emptyMessage="조건에 맞는 거래처가 없습니다."
      />

      <p className="text-tiny text-ink-muted">총 {clients.length}건</p>
    </div> );
}
