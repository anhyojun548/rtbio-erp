import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AdminHome() {
  const user = await requireRole("TENANT_OWNER", "ADMIN");

  // 빠른 통계 — 아직 Phase 3 시작이므로 몇 가지만
  const [clientCount, addressCount, productCount] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.clientAddress.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true } }),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">경영지원 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.name}님 환영합니다. 테넌트:{" "}
          <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">
            {user.tenantCode ?? "-"}
          </code>
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <StatCard label="활성 거래처" value={clientCount} href="/admin/clients" />
        <StatCard label="등록 배송지" value={addressCount} href="/admin/clients" />
        <StatCard label="활성 제품" value={productCount} href="/admin/products" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-2">
        <h2 className="font-semibold text-slate-900">Phase 진행 상황</h2>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>✅ Phase 1 — 스키마·마이그레이션·복수 배송지</li>
          <li>✅ Phase 2 — 인증·RBAC·감사로그</li>
          <li>🔄 Phase 3 — 거래처/제품/재고 CRUD (진행 중)</li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-5 hover:border-sky-400 hover:shadow-sm transition"
    >
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-2">{value.toLocaleString()}</div>
    </Link>
  );
}
