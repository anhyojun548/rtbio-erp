"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/qc", label: "대시보드", icon: "📊" },
  { href: "/qc/shipments", label: "출고 칸반", icon: "🪧" },
  { href: "/qc/shipments/history", label: "출고 내역", icon: "📜" },
  { href: "/qc/inventory", label: "재고 현황", icon: "📦" },
  { href: "/qc/alerts", label: "재고 알럼", icon: "🚨" },
  { href: "/qc/expiry", label: "유통기한", icon: "⏰" },
  { href: "/qc/samples", label: "샘플 출고", icon: "📤" },
  { href: "/qc/settings", label: "업무 설정", icon: "⚙️" },
];

export function QcSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex-shrink-0">
      <nav className="py-4 text-sm">
        {MENU.map((item) => {
          const candidates = MENU.filter(
            (m) =>
              pathname === m.href ||
              (m.href !== "/qc" && pathname.startsWith(m.href + "/")),
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
