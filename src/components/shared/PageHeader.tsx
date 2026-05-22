/**
 * PageHeader — 페이지 상단 (제목 + 부제 + 액션 버튼)
 *
 * 사용:
 *   <PageHeader
 *     title="거래처 관리"
 *     subtitle="병원·약국·대리점 정보와 복수 배송지를 관리합니다"
 *     actions={<PrimaryButton href="/admin/clients/new">+ 신규 거래처</PrimaryButton>}
 *   />
 */

import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-display m-0">{title}</h1>
        {subtitle && (
          <p className="text-caption text-ink-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
