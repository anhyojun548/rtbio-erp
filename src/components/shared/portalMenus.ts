/**
 * portalMenus — 5개 포털의 사이드바 메뉴 정의 (단일 진실 원천)
 *
 * prototype 의 nav-section / nav-item 구조를 React 데이터로 변환.
 * Sidebar 컴포넌트에 menu prop 으로 전달.
 */

import type { NavSection } from "./Sidebar";

// ════════════════════════════════════════════════════════
//  경영지원팀 (admin)
// ════════════════════════════════════════════════════════
export const ADMIN_MENU: NavSection[] = [
  {
    title: "주요 업무",
    items: [
      { label: "대시보드",   href: "/admin" },
      // 매입매출장 — /admin/journal 은 /admin/data-explorer 로 리다이렉트, /admin/orders 도 같은 카테고리
      { label: "매입매출장", href: "/admin/data-explorer", matchExtra: ["/admin/journal", "/admin/orders"] },
      { label: "거래처원장", href: "/admin/ledger" },
      { label: "마감원장",   href: "/admin/closing" },
      { label: "월간 보고서", href: "/admin/reports/monthly" },
    ],
  },
  {
    title: "정산",
    items: [
      { label: "거래명세서",   href: "/admin/invoices" },
      { label: "수금 관리",    href: "/admin/payments" },
      { label: "미수금 관리",  href: "/admin/receivables" },
      // 세금계산서: 본 과업 범위 제외 (전자세금계산서 외부 API 연동 필요) — 마스터 플랜 §2
    ],
  },
  {
    title: "관리",
    items: [
      { label: "거래처 관리", href: "/admin/clients" },
      { label: "제품 관리",   href: "/admin/products" },
      { label: "재고 관리",   href: "/admin/inventory" },
      { label: "재고 알럼",   href: "/admin/alerts/stock" },
      { label: "유통기한",    href: "/admin/expiry" },
      { label: "판매 계약서", href: "/admin/contracts" },
    ],
  },
  {
    title: "보고서",
    items: [
      { label: "ISO 13485 보고서",  href: "/admin/reports" },
      { label: "담당자별 매출",      href: "/admin/reports/sales" },
      { label: "영업 이력서",        href: "/admin/reports/sales-history" },
      { label: "데이터 사용량",      href: "/admin/data-usage" },
      { label: "데이터 탐색기",      href: "/admin/data-explorer" },
    ],
  },
  {
    title: "신규 기능",
    items: [
      { label: "공지사항",         href: "/admin/notices" },
      { label: "베트남 발주",      href: "/admin/procurement" },
      { label: "UDI 보고",         href: "/admin/udi" },
      { label: "매뉴얼 · 양식",   href: "/admin/manuals" },
    ],
  },
  {
    title: "설정",
    items: [
      { label: "시스템 설정", href: "/admin/settings" },
    ],
  },
];

// ════════════════════════════════════════════════════════
//  영업팀 (exec)
// ════════════════════════════════════════════════════════
export const EXEC_MENU: NavSection[] = [
  {
    title: "영업",
    items: [
      { label: "영업 대시보드", href: "/exec" },
      { label: "영업 현황",     href: "/exec/sales-status" },
      { label: "거래처 관리",   href: "/exec/clients" },
      { label: "담당자 관리",   href: "/exec/assignments" },
      { label: "학회 관리",     href: "/exec/conferences" },
      { label: "영업사원 계정", href: "/exec/rep-master" },
    ],
  },
  {
    title: "기타",
    items: [
      { label: "공지사항",        href: "/exec/notices" },
      { label: "사용량 입력",     href: "/exec/usage" },
      { label: "보고서 작성",     href: "/exec/reports" },
      { label: "데이터 탐색기",   href: "/exec/data-explorer" },
    ],
  },
];

// ════════════════════════════════════════════════════════
//  품질관리팀 (qc)
// ════════════════════════════════════════════════════════
export const QC_MENU: NavSection[] = [
  {
    title: "주요 업무",
    items: [
      { label: "대시보드",     href: "/qc" },
      { label: "발주 확정",    href: "/qc/confirm" },
      { label: "출고 관리",    href: "/qc/shipments" },
      { label: "출고 내역",    href: "/qc/shipments/history" },
      { label: "재고 현황",    href: "/qc/inventory" },
      { label: "샘플 출고",    href: "/qc/samples" },
      { label: "입고 등록",    href: "/qc/receiving" },
      { label: "재고 조정",    href: "/qc/adjustments" },
    ],
  },
  {
    title: "보고서",
    items: [
      { label: "ISO 13485 보고서", href: "/qc/reports" },
      { label: "UDI 보고",          href: "/qc/udi" },
      { label: "데이터 탐색기",     href: "/qc/data-explorer" },
    ],
  },
  {
    title: "거래처",
    items: [
      { label: "거래처 관리", href: "/qc/clients" },
      { label: "공지사항",   href: "/qc/notices" },
    ],
  },
  {
    title: "시스템",
    items: [
      { label: "설정", href: "/qc/settings" },
    ],
  },
];

// ════════════════════════════════════════════════════════
//  임원진 (ceo)
// ════════════════════════════════════════════════════════
export const CEO_MENU: NavSection[] = [
  {
    title: "대표",
    items: [
      { label: "임원 대시보드", href: "/ceo" },
      { label: "통합 현황",     href: "/ceo/overview" },
      { label: "직원별 지표",   href: "/ceo/staff-metrics" },
      { label: "공지사항",      href: "/ceo/notices" },
    ],
  },
  {
    title: "팀 포털 이동",
    items: [
      { label: "품질관리팀", href: "/qc" },
      { label: "경영지원팀", href: "/admin" },
      { label: "영업팀",     href: "/exec" },
    ],
  },
];

// ════════════════════════════════════════════════════════
// ⚪ 거래처 (client)
// ════════════════════════════════════════════════════════
export const CLIENT_MENU: NavSection[] = [
  {
    items: [
      { label: "대시보드",     href: "/client" },
      { label: "발주",         href: "/client/orders/new" },
      { label: "발주 현황",    href: "/client/orders" },
      { label: "거래명세서",   href: "/client/invoices" },
      { label: "수금",         href: "/client/payments" },
      { label: "계약서",       href: "/client/contracts" },
      { label: "내 정보",      href: "/client/profile" },
    ],
  },
];
