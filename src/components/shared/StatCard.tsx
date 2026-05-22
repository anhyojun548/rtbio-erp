/**
 * StatCard — 대시보드 KPI 카드 (좌측 컬러 띠 + 큰 숫자)
 *
 * prototype 의 .stat-card 디자인 그대로.
 *
 * 사용:
 *   <StatCard label="오늘 발주" value="8건" variant="primary" change="+3건" />
 *   <StatCard label="활성 거래처" value={5} variant="accent" href="/admin/clients" />
 */

import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "accent" | "warning" | "danger" | "success" | "purple";

const VARIANT_BAR: Record<Variant, string> = {
  primary: "bg-primary",
  accent:  "bg-accent",
  warning: "bg-warning",
  danger:  "bg-danger",
  success: "bg-success",
  purple:  "bg-purple",
};

const VARIANT_VALUE_COLOR: Record<Variant, string> = {
  primary: "text-primary",
  accent:  "text-accent-dark",
  warning: "text-warning",
  danger:  "text-danger",
  success: "text-success",
  purple:  "text-purple",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** 보조 설명 (예: "목표 대비 95.7%") */
  desc?: ReactNode;
  /** 변화량 (예: "+12.3%") */
  change?: string;
  /** 변화 방향 — up=초록, down=빨강 */
  changeDir?: "up" | "down";
  /** 색상 (기본 primary) */
  variant?: Variant;
  /** 클릭 시 이동할 경로 (선택) */
  href?: string;
  /** 아이콘 (이모지 등) */
  icon?: ReactNode;
}

export function StatCard({
  label,
  value,
  desc,
  change,
  changeDir,
  variant = "primary",
  href,
  icon,
}: StatCardProps) {
  const inner = (
    <div className="relative bg-surface rounded shadow-sm border border-border overflow-hidden hover:shadow-md transition">
      {/* 좌측 컬러 띠 */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${VARIANT_BAR[variant]}`} />

      <div className="p-5 pl-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-tiny text-ink-secondary uppercase tracking-wide font-semibold">
            {label}
          </span>
          {icon && <span className="text-lg opacity-70">{icon}</span>}
        </div>

        <div className={`text-3xl font-bold tabular-nums ${VARIANT_VALUE_COLOR[variant]}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>

        {(desc || change) && (
          <div className="mt-2 flex items-center gap-2 text-tiny">
            {change && (
              <span
                className={`font-semibold ${
                  changeDir === "up"   ? "text-success" :
                  changeDir === "down" ? "text-danger"  :
                  "text-ink-secondary"
                }`}
              >
                {changeDir === "up"   && "▲ "}
                {changeDir === "down" && "▼ "}
                {change}
              </span>
            )}
            {desc && <span className="text-ink-muted">{desc}</span>}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}
