/**
 * Button — prototype 디자인 그대로의 버튼 컴포넌트
 *
 * Variants:
 *   - primary: 진한 네이비 (기본 액션)
 *   - secondary: 회색 외곽선 (보조 액션)
 *   - danger: 빨강 (삭제 등 위험 액션)
 *   - warning: 주황 (보류 등)
 *   - ghost: 배경 없음 (텍스트 링크형)
 *
 * Sizes:
 *   - sm: 작은 버튼 (테이블 행 액션)
 *   - md: 기본 버튼 (페이지 메인 액션)
 *   - lg: 큰 버튼 (모달 확인 등)
 *
 * 사용:
 *   <Button variant="primary" onClick={...}>저장</Button>
 *   <Button href="/admin/clients/new" variant="primary">+ 신규 거래처</Button>
 *   <Button variant="danger" size="sm" onClick={...}>삭제</Button>
 */

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "warning" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   "bg-primary text-white hover:bg-primary-light",
  secondary: "bg-canvas text-ink-secondary hover:bg-border",
  danger:    "bg-danger text-white hover:bg-danger/90",
  warning:   "bg-warning text-white hover:bg-warning/90",
  ghost:     "bg-transparent text-primary hover:bg-primary-lighter",
  outline:   "bg-surface border border-border text-ink-secondary hover:bg-canvas hover:border-primary hover:text-primary",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-7 px-2.5 text-tiny rounded-xs",
  md: "h-9 px-4 text-caption rounded-xs",
  lg: "h-11 px-6 text-body rounded-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  /** 좌측 아이콘 */
  icon?: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type ButtonAsLink   = CommonProps & { href: string; onClick?: never; type?: never };

type Props = ButtonAsButton | ButtonAsLink;

export function Button(props: Props) {
  const {
    variant = "primary",
    size = "md",
    children,
    icon,
    className = "",
    ...rest
  } = props;

  const cls = `
    inline-flex items-center justify-center gap-1.5 font-semibold
    transition disabled:opacity-50 disabled:cursor-not-allowed
    ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}
  `.trim();

  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={cls} {...buttonProps}>
      {icon}
      {children}
    </button>
  );
}
