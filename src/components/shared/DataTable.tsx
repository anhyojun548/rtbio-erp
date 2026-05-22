/**
 * DataTable — prototype 디자인 그대로의 목록 테이블
 *
 * 사용:
 *   <DataTable
 *     columns={[
 *       { key: "code", label: "코드", className: "font-mono text-tiny" },
 *       { key: "name", label: "업체명", render: (c) => <Link href={...}>{c.name}</Link> },
 *       { key: "type", label: "유형" },
 *       { key: "action", label: "액션", align: "right", render: (c) => <ActionButtons /> },
 *     ]}
 *     rows={clients}
 *     keyField="id"
 *     emptyMessage="조건에 맞는 거래처가 없습니다"
 *   />
 */

import type { ReactNode } from "react";

export interface ColumnDef<T> {
  /** 컬럼 키 (rows 데이터의 필드명 또는 임의 식별자) */
  key: string;
  /** 헤더 라벨 */
  label: ReactNode;
  /** 정렬 (기본 left) */
  align?: "left" | "right" | "center";
  /** 열 너비 (px 또는 % 등) */
  width?: string;
  /** 커스텀 렌더링. 없으면 row[key] 그대로 출력 */
  render?: (row: T, index: number) => ReactNode;
  /** 셀에 추가 클래스 */
  cellClassName?: string;
  /** 모바일에서 숨김 */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  keyField: keyof T;
  emptyMessage?: string;
  /** 행 클릭 시 (선택) */
  onRowClick?: (row: T) => void;
}

const ALIGN_CLASS = {
  left:   "text-left",
  right:  "text-right",
  center: "text-center",
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  keyField,
  emptyMessage = "데이터가 없습니다",
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="bg-surface rounded shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-caption">
          <thead className="bg-canvas">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 text-tiny font-semibold text-ink-secondary uppercase tracking-wide whitespace-nowrap
                    ${ALIGN_CLASS[col.align ?? "left"]}
                    ${col.hideOnMobile ? "hidden md:table-cell" : ""}
                  `}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-ink-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={String(row[keyField])}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`
                    hover:bg-canvas transition
                    ${onRowClick ? "cursor-pointer" : ""}
                  `}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        px-4 py-3 align-middle
                        ${ALIGN_CLASS[col.align ?? "left"]}
                        ${col.hideOnMobile ? "hidden md:table-cell" : ""}
                        ${col.cellClassName ?? ""}
                      `}
                    >
                      {col.render ? col.render(row, idx) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
