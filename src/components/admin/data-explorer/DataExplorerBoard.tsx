"use client";

/**
 * DataExplorerBoard — 매입매출 거래원장 탐색기
 *
 * 기능:
 *   - 필터 (날짜 from/to, 거래처, 품목, 구분, 검색)
 *   - 페이지네이션 (100건 단위, 41,000+ 건 처리)
 *   - 엑셀/CSV 업로드 (multipart POST → /api/data-explorer/upload)
 *   - 엑셀/CSV 다운로드 (현재 필터된 데이터)
 *   - 합계 카드 (총 행수, 공급가 합, VAT 합, 합계 합)
 */

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { SearchInput, Input, Select } from "@/components/shared/formElements";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { toast } from "@/components/shared/Toast";
import { formatKRW, formatKRWShort } from "@/lib/format";

export interface TxnRow {
  id: string;
  txnDate: string;       // ISO
  kind: "SALE" | "PURCHASE";
  taxType: string | null;
  clientCode: string | null;
  clientName: string | null;
  productCode: string | null;
  productName: string;
  spec: string | null;
  unit: string | null;
  qty: number;
  unitPrice: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  voucherNo: string | null;
  hasInvoice: boolean;
  category: string | null;
}

export interface Aggregates {
  count: number;
  totalQty: number;
  totalSupply: number;
  totalVat: number;
  totalAmount: number;
  byKind: { kind: "SALE" | "PURCHASE"; count: number; total: number }[];
}

interface Props {
  rows: TxnRow[];
  total: number;
  limit: number;
  offset: number;
  aggregates: Aggregates;
  currentFilter: {
    q: string;
    kind: string;
    clientCode: string;
    productCode: string;
    from: string;
    to: string;
  };
  /** 업로드 가능 여부 (ADMIN/TENANT_OWNER 만 true) */
  canUpload: boolean;
}

export function DataExplorerBoard({
  rows,
  total,
  limit,
  offset,
  aggregates,
  currentFilter,
  canUpload,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  // 로컬 필터 상태
  const [q, setQ] = useState(currentFilter.q);
  const [kind, setKind] = useState(currentFilter.kind);
  const [from, setFrom] = useState(currentFilter.from);
  const [to, setTo] = useState(currentFilter.to);

  // 필터 적용
  function applyFilter() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kind && kind !== "ALL") params.set("kind", kind);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    start(() => router.push(`/admin/data-explorer?${params.toString()}`));
  }

  function resetFilter() {
    setQ("");
    setKind("ALL");
    setFrom("");
    setTo("");
    start(() => router.push("/admin/data-explorer"));
  }

  // 페이지네이션
  function goPage(newOffset: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (kind && kind !== "ALL") params.set("kind", kind);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (newOffset > 0) params.set("offset", String(newOffset));
    start(() => router.push(`/admin/data-explorer?${params.toString()}`));
  }

  // 다운로드 URL 생성 (현재 필터 그대로)
  function downloadUrl(format: "csv" | "xlsx"): string {
    const params = new URLSearchParams({ format });
    if (q.trim()) params.set("q", q.trim());
    if (kind && kind !== "ALL") params.set("kind", kind);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/data-explorer/download?${params.toString()}`;
  }

  // 업로드
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/data-explorer/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        toast.success(
          `업로드 성공: ${json.inserted}건 추가 (전체 ${json.total}, 건너뜀 ${json.skipped})`,
        );
        router.refresh();
      } else {
        toast.error(json.error ?? "업로드 실패");
      }
    } catch (err) {
      toast.error(`업로드 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const pageNo = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // 테이블 컬럼
  const columns: ColumnDef<TxnRow>[] = [
    {
      key: "txnDate",
      label: "날짜",
      width: "110px",
      cellClassName: "tabular-nums text-tiny",
      render: (r) => r.txnDate.slice(0, 10),
    },
    {
      key: "kind",
      label: "구분",
      width: "70px",
      render: (r) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-tiny font-semibold ${
            r.kind === "SALE"
              ? "bg-accent-light text-accent-dark"
              : "bg-warning-light text-warning"
          }`}
        > {r.kind === "SALE" ? "매출" : "매입"}
        </span> ),
    },
    {
      key: "clientName",
      label: "거래처",
      render: (r) => (
        <>
          <div className="text-caption text-ink">{r.clientName ?? "—"}</div> {r.clientCode && <div className="font-mono text-tiny text-ink-muted">{r.clientCode}</div>}
        </> ),
    },
    {
      key: "productName",
      label: "품목",
      render: (r) => (
        <>
          <div className="text-caption text-ink">{r.productName}</div> {r.productCode && <div className="font-mono text-tiny text-ink-muted">{r.productCode}</div>}
        </> ),
    },
    { key: "spec", label: "규격", width: "60px", cellClassName: "font-mono text-tiny" },
    { key: "qty", label: "수량", align: "right", width: "60px", cellClassName: "tabular-nums", render: (r) => Number(r.qty).toLocaleString() },
    {
      key: "totalAmount",
      label: "합계",
      align: "right",
      width: "120px",
      cellClassName: "tabular-nums font-semibold",
      render: (r) => `₩${Number(r.totalAmount).toLocaleString()}`,
    },
    {
      key: "voucherNo",
      label: "전표",
      width: "100px",
      hideOnMobile: true,
      cellClassName: "font-mono text-tiny",
      render: (r) => r.voucherNo ?? "—",
    },
  ];

  return (
    <div className="space-y-6"> {/* 상단: 통계 카드 + 액션 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="조회된 행수" value={total} desc={`${aggregates.count.toLocaleString()}건`} variant="primary" icon="" />
        <StatCard
          label="공급가 합"
          value={formatKRWShort(aggregates.totalSupply)}
          desc={formatKRW(aggregates.totalSupply)}
          variant="accent"
          icon=""
        />
        <StatCard
          label="부가세 합"
          value={formatKRWShort(aggregates.totalVat)}
          desc={formatKRW(aggregates.totalVat)}
          variant="warning"
          icon=""
        />
        <StatCard
          label="합계금액"
          value={formatKRWShort(aggregates.totalAmount)}
          desc={`매출 ${aggregates.byKind.find((b) => b.kind === "SALE")?.count ?? 0} · 매입 ${aggregates.byKind.find((b) => b.kind === "PURCHASE")?.count ?? 0}`}
          variant="success"
          icon=""
        />
      </section> {/* 필터 + 액션 */}
      <FilterBar>
        <FilterField label="검색 (거래처/품목/전표)" minWidth={240}>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="153정형외과 / RECOTAP / S2600426..."
          />
        </FilterField>
        <FilterField label="구분">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="ALL">전체</option>
            <option value="SALE">매출</option>
            <option value="PURCHASE">매입</option>
          </Select>
        </FilterField>
        <FilterField label="시작일">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FilterField>
        <FilterField label="종료일">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FilterField>
        <Button onClick={applyFilter} disabled={pending}> {pending ? "조회 중..." : "조회"}
        </Button>
        <Button onClick={resetFilter} variant="outline" disabled={pending}> 초기화
        </Button>
      </FilterBar> {/* 액션 바: 업로드 / 다운로드 */}
      <div className="flex flex-wrap items-center gap-2 justify-end"> {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
            <Button
              variant="primary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              icon={<span></span>}
            > {uploading ? "업로드 중..." : "엑셀/CSV 업로드"}
            </Button>
          </> )}
        <a
          href={downloadUrl("csv")}
          className="h-9 px-4 inline-flex items-center gap-1.5 bg-success text-white text-caption font-semibold rounded-xs hover:bg-success/90 transition"
        > CSV
        </a>
        <a
          href={downloadUrl("xlsx")}
          className="h-9 px-4 inline-flex items-center gap-1.5 bg-accent text-white text-caption font-semibold rounded-xs hover:bg-accent-dark transition"
        > 엑셀
        </a>
      </div> {/* 테이블 */}
      <DataTable
        columns={columns}
        rows={rows}
        keyField="id"
        emptyMessage="조건에 맞는 거래가 없습니다."
      /> {/* 페이지네이션 */}
      <div className="flex items-center justify-between text-caption">
        <span className="text-ink-muted"> {total === 0
            ? "총 0건"
            : `${(offset + 1).toLocaleString()}–${Math.min(offset + limit, total).toLocaleString()} / 총 ${total.toLocaleString()}건`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goPage(Math.max(0, offset - limit))}
            disabled={pending || offset === 0}
          > ◀ 이전
          </Button>
          <span className="text-tiny text-ink-secondary tabular-nums"> {pageNo} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goPage(offset + limit)}
            disabled={pending || offset + limit >= total}
          > 다음 ▶
          </Button>
        </div>
      </div>
    </div> );
}
