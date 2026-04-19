/**
 * 재고 임계치 알럼 Server Actions — Phase 3E-3 (R14).
 *
 * 제공 메서드
 *   - listLowStockAlerts({limit?})  → OUT/LOW 사이즈 목록 (OUT 우선, deficit desc)
 *   - countStockAlerts()            → 레벨별 건수 (대시보드 배지용)
 *
 * RBAC: TENANT_OWNER / ADMIN / QC.
 */
"use server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  classifyStock,
  compareStockUrgency,
  type StockLevel,
} from "@/lib/validators/stock-alert";

export type StockAlertRow = {
  sizeId: string;
  productId: string;
  productCode: string;
  productName: string;
  sizeCode: string;
  category: string | null;
  brand: string | null;
  physicalStock: number;
  availableStock: number;
  reorderPoint: number;
  level: StockLevel;
  deficit: number;
  updatedAt: Date;
};

/**
 * reorderPoint 가 설정된 사이즈 중 physicalStock ≤ reorderPoint 를 전부 반환.
 * OUT 먼저, 그 뒤 deficit 큰 순.
 */
export async function listLowStockAlerts(opts?: {
  limit?: number;
}): Promise<StockAlertRow[]> {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  // DB 필터: reorderPoint 가 정의된 것만 1차 컷, 그리고 physicalStock ≤ reorderPoint 는
  // Prisma 로 컬럼 비교가 어려워 전체 로드 후 앱-레벨 필터.
  // 활성 제품의 사이즈 수는 보통 수백 건이므로 N+1 없이 단일 쿼리로 처리.
  const sizes = await prisma.productSize.findMany({
    where: {
      product: { active: true },
      reorderPoint: { not: null, gt: 0 },
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          brand: true,
        },
      },
    },
  });

  const rows: StockAlertRow[] = [];
  for (const s of sizes) {
    if (s.reorderPoint == null) continue;
    const cls = classifyStock({
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint,
    });
    if (cls.level === "OK") continue;
    rows.push({
      sizeId: s.id,
      productId: s.product.id,
      productCode: s.product.code,
      productName: s.product.name,
      sizeCode: s.sizeCode,
      category: s.product.category,
      brand: s.product.brand,
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint,
      level: cls.level,
      deficit: cls.deficit,
      updatedAt: s.updatedAt,
    });
  }

  rows.sort((a, b) =>
    compareStockUrgency(
      { level: a.level, deficit: a.deficit },
      { level: b.level, deficit: b.deficit },
    ),
  );

  if (opts?.limit != null && opts.limit > 0) return rows.slice(0, opts.limit);
  return rows;
}

/**
 * 대시보드 배지용 — OUT / LOW / OK 건수 집계.
 * reorderPoint 미설정 사이즈는 "OK" 카운트에 포함.
 */
export async function countStockAlerts(): Promise<{
  OUT: number;
  LOW: number;
  OK: number;
  totalActiveSizes: number;
}> {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const sizes = await prisma.productSize.findMany({
    where: { product: { active: true } },
    select: { physicalStock: true, availableStock: true, reorderPoint: true },
  });

  let OUT = 0,
    LOW = 0,
    OK = 0;
  for (const s of sizes) {
    const cls = classifyStock({
      physicalStock: s.physicalStock,
      availableStock: s.availableStock,
      reorderPoint: s.reorderPoint,
    });
    if (cls.level === "OUT") OUT += 1;
    else if (cls.level === "LOW") LOW += 1;
    else OK += 1;
  }

  return { OUT, LOW, OK, totalActiveSizes: sizes.length };
}
