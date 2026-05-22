/**
 * FilterBar — prototype 디자인의 필터 행
 *
 * children 으로 input/select 등을 자유롭게 배치.
 *
 * 사용:
 *   <FilterBar>
 *     <SearchInput placeholder="이름/코드 검색..." defaultValue={q} />
 *     <Select label="유형" options={[...]} />
 *     <Select label="상태" options={[...]} />
 *   </FilterBar>
 */

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function FilterBar({ children }: Props) {
  return (
    <div className="bg-surface border border-border rounded px-4 py-3 flex items-end gap-3 flex-wrap">
      {children}
    </div>
  );
}

/** FilterBar 내부에서 사용하는 라벨 + 입력 묶음 */
export function FilterField({
  label,
  children,
  minWidth,
}: {
  label?: string;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
    >
      {label && (
        <label className="text-tiny text-ink-secondary font-semibold">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
