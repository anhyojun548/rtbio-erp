"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/admin", label: "대시보드", icon: "📊" },
  { href: "/admin/clients", label: "거래처 관리", icon: "🏢" },
  { href: "/admin/products", label: "제품 관리", icon: "📦" },
  { href: "/admin/inventory", label: "재고 관리", icon: "📋" },
  { href: "/admin/orders", label: "발주/출고", icon: "🚚" },
  { href: "/admin/shipments", label: "출고 칸반", icon: "🪧" },
  { href: "/admin/invoices", label: "거래명세서", icon: "🧾" },
  { href: "/admin/payments", label: "수금 관리", icon: "💰" },
  { href: "/admin/ledger", label: "거래처원장", icon: "📒" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex-shrink-0">
      <nav className="py-4 text-sm">
        {MENU.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
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
