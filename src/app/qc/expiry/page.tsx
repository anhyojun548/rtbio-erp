/**
 * QC 유통기한 관리 — /admin/expiry 와 동일, QC 레이아웃.
 */
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { listExpiryLots } from "@/lib/actions/expiry";
import { classifyExpiry, type ExpiryStage } from "@/lib/validators/expiry";
import { ExpiryBoard } from "@/components/admin/expiry/ExpiryBoard";

type SearchParams = {
  q?: string;
  stage?: string;
  includeEmpty?: string;
};

const STAGES: ExpiryStage[] = ["EXPIRED", "URGENT", "SOON", "SAFE"];

export default async function QcExpiryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const stageRaw = searchParams.stage?.trim() ?? "ALL";
  const stage: ExpiryStage | "ALL" = STAGES.includes(stageRaw as ExpiryStage)
    ? (stageRaw as ExpiryStage)
    : "ALL";
  const includeEmpty = searchParams.includeEmpty === "1";
  const q = searchParams.q?.trim() ?? "";

  const allLots = await listExpiryLots({
    stage: "ALL",
    includeEmpty,
    limit: 1000,
  });

  const qLower = q.toLowerCase();
  const filtered = q
    ? allLots.filter((l) => {
        const name = l.productSize.product.name.toLowerCase();
        const code = l.productSize.product.code.toLowerCase();
        const lotNo = l.lotNumber.toLowerCase();
        return (
          name.includes(qLower) ||
          code.includes(qLower) ||
          lotNo.includes(qLower)
        );
      })
    : allLots;

  const now = new Date();
  const stats = { EXPIRED: 0, URGENT: 0, SOON: 0, SAFE: 0 } as Record<
    ExpiryStage,
    number
  >;
  for (const l of filtered) {
    if (!includeEmpty && l.remainingQty <= 0) continue;
    stats[classifyExpiry(l.expiryDate, now).stage]++;
  }

  const rows = filtered
    .filter((l) => {
      if (!includeEmpty && l.remainingQty <= 0) return false;
      if (stage === "ALL") return true;
      return classifyExpiry(l.expiryDate, now).stage === stage;
    })
    .map((l) => {
      const cls = classifyExpiry(l.expiryDate, now);
      return {
        id: l.id,
        lotNumber: l.lotNumber,
        expiryDate: l.expiryDate.toISOString(),
        quantity: l.quantity,
        remainingQty: l.remainingQty,
        note: l.note,
        stage: cls.stage,
        daysLeft: cls.daysLeft,
        sizeCode: l.productSize.sizeCode,
        productSizeId: l.productSize.id,
        productId: l.productSize.product.id,
        productCode: l.productSize.product.code,
        productName: l.productSize.product.name,
        brand: l.productSize.product.brand,
      };
    });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display m-0">⏰ 유통기한 관리</h1>
        <p className="text-caption text-ink-secondary mt-1">
          로트별 유통기한·잔여수량을 추적합니다. 새 로트는{" "}
          <Link href="/admin/products" className="text-primary hover:underline">
            제품 상세
          </Link>
          에서 등록하세요.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="만료"
          count={stats.EXPIRED}
          color="red"
          stage="EXPIRED"
          active={stage === "EXPIRED"}
        />
        <StatCard
          label="30일 이내"
          count={stats.URGENT}
          color="amber"
          stage="URGENT"
          active={stage === "URGENT"}
        />
        <StatCard
          label="90일 이내"
          count={stats.SOON}
          color="sky"
          stage="SOON"
          active={stage === "SOON"}
        />
        <StatCard
          label="안전 (90일 초과)"
          count={stats.SAFE}
          color="emerald"
          stage="SAFE"
          active={stage === "SAFE"}
        />
      </section>

      <ExpiryBoard rows={rows} defaults={{ q, stage, includeEmpty }} />
    </div>
  );
}

function StatCard({
  label,
  count,
  color,
  stage,
  active,
}: {
  label: string;
  count: number;
  color: "red" | "amber" | "sky" | "emerald";
  stage: ExpiryStage;
  active: boolean;
}) {
  const classes: Record<
    typeof color,
    { bg: string; text: string; border: string }
  > = {
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
    },
    sky: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
  };
  const c = classes[color];
  return (
    <Link
      href={`/qc/expiry?stage=${stage}`}
      className={`block rounded-lg border ${c.border} ${c.bg} p-4 transition hover:shadow-sm ${active ? "ring-2 ring-offset-1 ring-slate-900/20" : ""}`}
    >
      <div className={`text-xs font-medium ${c.text} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${c.text} tabular-nums`}>{count}</div>
      <div className="text-xs text-slate-500 mt-0.5">로트</div>
    </Link>
  );
}
