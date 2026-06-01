/**
 * 루트 페이지 — 역할 선택 (prototype index.html 디자인)
 *
 * 비로그인: 로그인 버튼만 표시
 * 로그인 (TENANT_OWNER / SUPER_ADMIN): 5개 포털 카드 선택
 * 로그인 (단일 역할 ADMIN/QC/EXEC/CLIENT): 해당 포털로 자동 리다이렉트
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/shared/Button";
import type { UserRole } from "@prisma/client";

const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN:  "/ceo",
  TENANT_OWNER: "/admin",
  ADMIN:        "/admin",
  QC:           "/qc",
  EXEC:         "/exec",
  CLIENT:       "/client",
  VIEWER:       "/admin",
};

// 멀티 포털 접근 가능한 역할 → 역할 선택 화면 표시
const MULTI_PORTAL_ROLES: UserRole[] = ["TENANT_OWNER", "SUPER_ADMIN"];

interface RoleCard {
  href: string;
  name: string;
  icon: string;
  desc: string;
  screens: string[];
  color: { from: string; to: string };
  allowedRoles: UserRole[];
}

const ROLE_CARDS: RoleCard[] = [
  {
    href: "/client",
    name: "거래처 (발주)",
    icon: "",
    desc: "대리점·병원 담당자가 제품을 발주하고 출고 상태를 확인합니다.",
    screens: ["발주폼", "발주내역", "출고상태", "거래명세서"],
    color: { from: "#9CA3AF", to: "#6B7280" },
    allowedRoles: ["TENANT_OWNER", "SUPER_ADMIN", "CLIENT"],
  },
  {
    href: "/qc",
    name: "품질관리팀",
    icon: "",
    desc: "발주 확정, 담당자 배정, 출고 단계 관리, 재고 현황을 관리합니다.",
    screens: ["발주확정", "출고 칸반", "재고 현황", "샘플 출고", "유통기한"],
    color: { from: "#166534", to: "#14532D" },
    allowedRoles: ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN", "QC"],
  },
  {
    href: "/admin",
    name: "경영지원팀",
    icon: "",
    desc: "발주 관리, 거래처 관리, 거래명세서, 마감 원장, 보고서를 처리합니다.",
    screens: ["대시보드", "거래처", "주문/명세서", "수금/원장", "데이터 탐색기"],
    color: { from: "#1B3A5C", to: "#0F2840" },
    allowedRoles: ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN"],
  },
  {
    href: "/exec",
    name: "영업팀",
    icon: "",
    desc: "영업 대시보드, 거래처별 매출, 학회 방명록, 영업사원 인센티브를 관리합니다.",
    screens: ["영업 대시보드", "거래처", "학회 관리", "사용량", "보고서"],
    color: { from: "#B45309", to: "#92400E" },
    allowedRoles: ["TENANT_OWNER", "SUPER_ADMIN", "ADMIN", "EXEC"],
  },
  {
    href: "/ceo",
    name: "임원진 대시보드",
    icon: "",
    desc: "통합 KPI 위젯, 직원별 매출, 베트남 발주 트래킹을 한 눈에 봅니다.",
    screens: ["임원 대시보드", "직원별 지표", "통합 현황", "위젯 편집"],
    color: { from: "#7C3AED", to: "#5B21B6" },
    allowedRoles: ["TENANT_OWNER", "SUPER_ADMIN"],
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  // 비로그인 → 랜딩
  if (!user) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface rounded shadow-md p-8 space-y-6 text-center">
          <div>
            <h1 className="text-h1 text-primary m-0"> RTBIO ERP</h1>
            <p className="text-caption text-ink-secondary mt-1">알티바이오 업무 자동화 시스템</p>
          </div>
          <Button href="/login" variant="primary" size="lg" className="w-full"> 로그인하기
          </Button>
        </div>
      </main> );
  }

  // 단일 역할 → 자동 리다이렉트
  if (!MULTI_PORTAL_ROLES.includes(user.role)) {
    redirect(ROLE_HOME[user.role]);
  }

  // TENANT_OWNER / SUPER_ADMIN → 역할 선택 카드 표시
  const visibleCards = ROLE_CARDS.filter((c) => c.allowedRoles.includes(user.role));

  return (
    <main className="min-h-screen bg-canvas"> {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary-light text-white py-16 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-5xl mb-4"></div>
          <h1 className="text-display m-0 text-white">RTBIO ERP</h1>
          <p className="text-h3 m-0 mt-2 text-white/85 font-normal">업무 자동화 시스템</p>
          <p className="text-caption text-white/70 mt-3"> {user.name}님 환영합니다 · 사용할 포털을 선택하세요
          </p>
          <span className="inline-block mt-4 px-3 py-1 rounded-full text-tiny bg-white/15 backdrop-blur-sm"> Phase 5 · {new Date().toISOString().slice(0, 10)}
          </span>
        </div>
      </div> {/* Role Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"> {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-surface rounded shadow-sm border border-border p-6 hover:shadow-lg hover:-translate-y-1 transition-all relative overflow-hidden"
            > {/* 상단 컬러 바 */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, ${card.color.from}, ${card.color.to})` }}
              />

              <div className="flex items-start gap-3 mb-3">
                <div className="text-4xl">{card.icon}</div>
                <div className="flex-1">
                  <h2 className="text-h2 m-0">{card.name}</h2>
                </div>
                <div className="text-2xl text-ink-muted group-hover:text-primary group-hover:translate-x-1 transition-all">→</div>
              </div>

              <p className="text-caption text-ink-secondary mb-4 leading-relaxed">{card.desc}</p>

              <div className="flex flex-wrap gap-1.5"> {card.screens.map((s) => (
                  <span
                    key={s}
                    className="text-tiny px-2 py-0.5 rounded-full bg-canvas border border-border text-ink-secondary"
                  > {s}
                  </span> ))}
              </div>
            </Link> ))}
        </div> {/* 푸터 */}
        <div className="mt-12 text-center text-caption text-ink-muted">
          <p>RTBIO 업무 자동화 시스템 · Phase 5 (2026)</p>
          <p className="mt-1">
            <Link href="/admin" className="text-primary hover:underline"> 데이터 탐색기 (41K건)</Link> {" · "}
            <Link href="/api/auth/signout" className="text-ink-muted hover:text-primary hover:underline">로그아웃</Link>
          </p>
        </div>
      </div>
    </main> );
}
