"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/exec", label: "내 대시보드", icon: "📊" },
  { href: "/exec/clients", label: "내 거래처", icon: "🏢" },
  { href: "/exec/orders", label: "내 주문", icon: "📦" },
  { href: "/exec/conferences", label: "학회 방명록", icon: "🎓" },
];

export function ExecSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex-shrink-0">
      <nav className="py-4 text-sm">
        {MENU.map((item) => {
          const candidates = MENU.filter(
            (m) =>
              pathname === m.href ||
              (m.href !== "/exec" && pathname.startsWith(m.href + "/")),
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
