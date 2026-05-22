/**
 * QC 샘플 출고 — 거래처 선택 + 사이즈 선택 + 수량 입력.
 *
 * 내부적으로는 InventoryAdjustment(reason="샘플출고", qty=-N) 로 기록된다.
 */
import { requireRole } from "@/lib/session";
import { listClients } from "@/lib/actions/client";
import { listProducts } from "@/lib/actions/product";
import { prisma } from "@/lib/prisma";
import { SampleShipForm } from "@/components/qc/SampleShipForm";
import Link from "next/link";

export default async function QcSamplesPage() {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const [clients, products, recent] = await Promise.all([
    listClients({ active: "ACTIVE" }),
    listProducts({ active: "ACTIVE" }),
    prisma.inventoryAdjustment.findMany({
      where: { reason: "샘플출고" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        productSize: {
          select: {
            id: true,
            sizeCode: true,
            product: { select: { code: true, name: true } },
          },
        },
      },
    }),
  ]);

  const sizes = await prisma.productSize.findMany({
    where: { product: { active: true } },
    orderBy: [{ product: { name: "asc" } }, { sizeCode: "asc" }],
    select: {
      id: true,
      sizeCode: true,
      physicalStock: true,
      availableStock: true,
      product: { select: { id: true, code: true, name: true } },
    },
  });

  const clientOptions = clients.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  const sizeOptions = sizes.map((s) => ({
    id: s.id,
    sizeCode: s.sizeCode,
    productCode: s.product.code,
    productName: s.product.name,
    physicalStock: s.physicalStock,
    availableStock: s.availableStock,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">🎁 샘플 출고</h1>
        <p className="text-caption text-ink-secondary mt-1">
          거래처 대상 샘플 제공 기록을 남깁니다. 기록 시{" "}
          <code className="text-tiny font-mono bg-canvas px-1.5 py-0.5 rounded-xs">
            InventoryAdjustment.reason = &quot;샘플출고&quot;
          </code>{" "}
          로 재고가 차감됩니다.
        </p>
      </header>

      <SampleShipForm clients={clientOptions} sizes={sizeOptions} />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">최근 샘플 출고 20건</h2>
          <Link
            href="/admin/inventory/logs"
            className="text-xs text-sky-700 hover:underline"
          >
            전체 변동 이력 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            기록된 샘플 출고가 없습니다.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">일시</th>
                <th className="px-4 py-2 text-left">제품</th>
                <th className="px-4 py-2 text-left">사이즈</th>
                <th className="px-4 py-2 text-right">수량</th>
                <th className="px-4 py-2 text-left">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">
                    {new Date(r.createdAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2">
                    {r.productSize.product.name}
                    <span className="ml-2 text-[11px] font-mono text-slate-400">
                      {r.productSize.product.code}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.productSize.sizeCode}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-rose-700 font-semibold">
                    {r.qty}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.note ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
