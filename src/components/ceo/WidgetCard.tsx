import Link from "next/link";
import type { WidgetValue } from "@/lib/actions/widget-dashboard";

export function WidgetCard({
  value,
  fallbackLabel,
  fallbackIcon = "",
}: {
  value: WidgetValue | undefined;
  fallbackLabel: string;
  fallbackIcon?: string;
}) {
  if (!value) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 h-full">
        <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <span>{fallbackIcon}</span>
          <span>{fallbackLabel}</span>
        </div>
        <div className="mt-4 text-sm text-slate-400">데이터 없음</div>
      </div> );
  }

  if (value.kind === "kpi") {
    const inner = (
      <div className="rounded-lg border border-slate-200 bg-white p-5 h-full hover:border-sky-300 hover:shadow-sm transition">
        <div className="text-xs font-medium text-slate-500 flex items-center gap-1">
          <span>{value.icon}</span>
          <span>{value.label}</span>
        </div>
        <div className="mt-2 text-3xl font-bold text-slate-900 tabular-nums"> {value.value}
        </div> {value.description && (
          <div className="mt-1 text-xs text-slate-500">{value.description}</div> )}
      </div> );
    return value.href ? (
      <Link href={value.href} className="block h-full"> {inner}
      </Link> ) : (
      inner
    );
  }

  // LIST
  const inner = (
    <div className="rounded-lg border border-slate-200 bg-white h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <span className="text-lg">{value.icon}</span>
        <span className="text-sm font-semibold text-slate-900">{value.label}</span>
      </div> {value.rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400"> 데이터가 없습니다.
        </div> ) : (
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr> {value.headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium"> {h}
                </th> ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100"> {value.rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50"> {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2 ${
                      typeof cell === "number" || /^₩/.test(String(cell))
                        ? "tabular-nums"
                        : ""
                    }`}
                  > {cell}
                  </td> ))}
              </tr> ))}
          </tbody>
        </table> )}
    </div> );
  return value.href ? (
    <Link href={value.href} className="block h-full"> {inner}
    </Link> ) : (
    inner
  );
}
