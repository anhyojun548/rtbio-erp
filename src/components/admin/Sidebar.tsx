"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/admin", label: "대시보드", icon: "📊" },
  { href: "/admin/clients", label: "거래처 관리", icon: "🏢" },
  { href: "/admin/products", label: "제품 관리", icon: "📦" },
  { href: "/admin/inventory", label: "재고 관리", icon: "📋" },
  { href: "/admin/alerts/stock", label: "재고 알럼", icon: "🚨" },
  { href: "/admin/expiry", label: "유통기한", icon: "⏰" },
  { href: "/admin/orders", label: "발주/출고", icon: "🚚" },
  { href: "/admin/shipments", label: "출고 칸반", icon: "🪧" },
  { href: "/admin/shipments/history", label: "출고내역", icon: "📜" },
  { href: "/admin/invoices", label: "거래명세서", icon: "🧾" },
  { href: "/admin/payments", label: "수금 관리", icon: "💰" },
  { href: "/admin/ledger", label: "거래처원장", icon: "📒" },
  { href: "/admin/reports/monthly", label: "월간 보고서", icon: "📈" },
  { href: "/admin/reports/sales", label: "담당자별 매출", icon: "🧑‍💼" },
  { href: "/admin/reports/sales-history", label: "영업 이력서", icon: "🗓️" },
  { href: "/admin/contracts", label: "판매 계약서", icon: "📝" },
  { href: "/admin/data-usage", label: "데이터 사용량", icon: "📡" },
  { href: "/admin/settings", label: "테넌트 설정", icon: "⚙️" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex-shrink-0">
      <nav className="py-4 text-sm">
        {MENU.map((item) => {
          // 정확 일치 또는 해당 경로의 하위 세그먼트(슬래시 경계) 일 때만 활성
          // "/admin/shipments" 와 "/admin/shipments/history" 양쪽이 동시에 활성되는
          // 문제를 막기 위해, 같은 prefix 라도 더 긴 href 가 있으면 더 긴 것만 우선 적용.
          const candidates = MENU.filter(
            (m) =>
              pathname === m.href ||
              (m.href !== "/admin" && pathname.startsWith(m.href + "/")),
          );
          const longest = candidates.reduce(
            (best, m) => (m.href.length > best.length ? m.href : best),
            "",
          );
          const active = item.href === longest;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 transition ${
                active
                  ? "bg-sky-50 text-sky-700 border-l-2 border-sky-600 font-medium"
                  : "text-slate-700 hover:bg-slate-50 border-l-2 border-transparent"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
