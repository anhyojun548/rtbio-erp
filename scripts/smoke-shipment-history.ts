/**
 * Phase 3D-4b 스모크 — 출고내역(Shipment history) 조회 + CSV 포맷 검증 (R17).
 *
 * 전략: 테스트용 완료 Shipment 픽스처 3건을 직접 만들어서(주문 생애주기 우회)
 * 필터 의미론과 CSV 포맷만 검증. 끝에 전부 정리.
 *
 * 시나리오:
 *   A. 기본 조회 — completedAt != null 만 반환 (최소 3건 포함 확인)
 *   B. clientId 필터
 *   C. 기간(from/to) 필터
 *   D. q 필터 (orderNumber/clientName/clientCode 부분일치)
 *   E. CSV 포맷 — 헤더 13컬럼, 행 = items 합, UTF-8 BOM, 콤마/따옴표 이스케이프
 *
 * 실행: `npx tsx scripts/smoke-shipment-history.ts`
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { calculatePriceSnapshot } from "../src/lib/pricing";

type Filter = {
  clientId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
};

async function listShipmentHistoryInline(filter: Filter = {}) {
  const where: Prisma.ShipmentWhereInput = { completedAt: { not: null } };
  if (filter.from || filter.to) {
    where.completedAt = { not: null };
    if (filter.from) (where.completedAt as Prisma.DateTimeFilter).gte = filter.from;
    if (filter.to) (where.completedAt as Prisma.DateTimeFilter).lte = filter.to;
  }
  if (filter.clientId) {
    where.order = { clientId: filter.clientId };
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim();
    where.order = {
      ...(where.order as Prisma.OrderWhereInput | undefined),
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
        { client: { code: { contains: q, mode: "insensitive" } } },
      ],
    };
  }
  return prisma.shipment.findMany({
    where,
    orderBy: [{ completedAt: "desc" }],
    take: filter.limit ?? 500,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          billingMonth: true,
          shipToRecipient: true,
          shipToAddress: true,
          client: { select: { id: true, code: true, name: true } },
          items: {
            select: {
              quantity: true,
              lineTotal: true,
              product: { select: { code: true, name: true } },
              productSize: { select: { sizeCode: true } },
            },
          },
        },
      },
    },
  });
}

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(
  shipments: Awaited<ReturnType<typeof listShipmentHistoryInline>>,
): { header: string[]; rows: string[][]; body: string } {
  const header = [
    "완료일시",
    "주문번호",
    "주문일",
    "거래처코드",
    "거래처명",
    "제품코드",
    "제품명",
    "사이즈",
    "수량",
    "라인합계",
    "수령인",
    "배송지",
    "정산월",
  ];
  const rows: string[][] = [];
  for (const s of shipments) {
    const completedAt = s.completedAt
      ? new Date(s.completedAt).toISOString().slice(0, 19).replace("T", " ")
      : "";
    const orderDate = new Date(s.order.orderDate).toISOString().slice(0, 10);
    for (const it of s.order.items) {
      rows.push([
        completedAt,
        s.order.orderNumber,
        orderDate,
        s.order.client.code,
        s.order.client.name,
        it.product.code,
        it.product.name,
        it.productSize?.sizeCode ?? "",
        String(it.quantity),
        String(Number(it.lineTotal ?? 0)),
        s.order.shipToRecipient ?? "",
        s.order.shipToAddress ?? "",
        s.order.billingMonth ?? "",
      ]);
    }
  }
  const BOM = "\uFEFF";
  const body =
    BOM +
    [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join(
      "\r\n",
    ) +
    "\r\n";
  return { header, rows, body };
}

/** 테스트 픽스처: order + shipment(completedAt 고정). 생애주기 우회. */
async function createFixture(opts: {
  clientId: string;
  sizeId: string;
  productId: string;
  quantity: number;
  orderNumber: string;
  completedAt: Date;
  stageId: string;
}) {
  const size = await prisma.productSize.findUnique({
    where: { id: opts.sizeId },
    include: {
      product: { select: { basePrice: true, category: true } },
    },
  });
  if (!size) throw new Error("사이즈 없음");
  const snap = calculatePriceSnapshot({
    basePrice: size.product.basePrice,
    category: size.product.category,
    clientDiscounts: [],
    clientFixedPrice: null,
  });
  const unit = new Prisma.Decimal(Number(snap.unitPrice).toFixed(2));
  const base = new Prisma.Decimal(Number(snap.basePriceAtOrder).toFixed(2));

  const orderDate = new Date(opts.completedAt.getTime() - 3600_000);
  const bmY = orderDate.getFullYear();
  const bmM = `${orderDate.getMonth() + 1}`.padStart(2, "0");

  const order = await prisma.order.create({
    data: {
      orderNumber: opts.orderNumber,
      clientId: opts.clientId,
      status: "COMPLETED",
      orderDate,
      confirmedAt: orderDate,
      completedAt: opts.completedAt,
      billingMonth: `${bmY}-${bmM}`,
      shipToRecipient: "스모크 수령",
      shipToAddress: "서울 강남구, 테스트, 빌딩",
      items: {
        create: [
          {
            productId: opts.productId,
            productSizeId: opts.sizeId,
            quantity: opts.quantity,
            unitPrice: unit,
            basePriceAtOrder: base,
            discountRateAtOrder: null,
            fixedPriceAppliedAtOrder: false,
            lineTotal: unit.mul(opts.quantity),
          },
        ],
      },
    },
    include: { items: true },
  });
  const shipment = await prisma.shipment.create({
    data: {
      orderId: order.id,
      currentStageId: opts.stageId,
      enteredStageAt: opts.completedAt,
      completedAt: opts.completedAt,
    },
  });
  return { order, shipment };
}

async function cleanupFixtures(orderIds: string[]) {
  await prisma.shipmentStageLog.deleteMany({
    where: { shipment: { orderId: { in: orderIds } } },
  });
  await prisma.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
}

async function main() {
  const size = await prisma.productSize.findFirst({
    include: { product: { select: { id: true } } },
  });
  if (!size) throw new Error("사이즈 없음");
  const otherClient = await prisma.client.findFirst({
    where: { active: true },
  });
  if (!otherClient) throw new Error("거래처 없음");
  const anotherClient = await prisma.client.findFirst({
    where: { active: true, id: { not: otherClient.id } },
  });
  if (!anotherClient) throw new Error("두 번째 거래처 필요");
  const terminal = await prisma.kanbanColumn.findFirst({
    where: { isTerminal: true },
  });
  if (!terminal) throw new Error("terminal 스테이지 없음");

  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = new Date();
  const t0 = new Date(now.getTime() - 30 * 24 * 3600_000); // 30일 전
  const t1 = new Date(now.getTime() - 10 * 24 * 3600_000); // 10일 전
  const t2 = new Date(now.getTime() - 1 * 24 * 3600_000); // 1일 전

  const orderIds: string[] = [];
  try {
    const f1 = await createFixture({
      clientId: otherClient.id,
      sizeId: size.id,
      productId: size.product.id,
      quantity: 1,
      orderNumber: `SMOKE-H-${rand}-1`,
      completedAt: t0,
      stageId: terminal.id,
    });
    orderIds.push(f1.order.id);
    const f2 = await createFixture({
      clientId: otherClient.id,
      sizeId: size.id,
      productId: size.product.id,
      quantity: 2,
      orderNumber: `SMOKE-H-${rand}-2`,
      completedAt: t1,
      stageId: terminal.id,
    });
    orderIds.push(f2.order.id);
    const f3 = await createFixture({
      clientId: anotherClient.id,
      sizeId: size.id,
      productId: size.product.id,
      quantity: 3,
      orderNumber: `SMOKE-H-${rand}-3`,
      completedAt: t2,
      stageId: terminal.id,
    });
    orderIds.push(f3.order.id);

    // ─── A. 기본 조회 ──────────────────────────────
    const all = await listShipmentHistoryInline({
      q: `SMOKE-H-${rand}`,
      limit: 1000,
    });
    if (all.length !== 3)
      throw new Error(`[A] 기대 3건, 실제 ${all.length}`);
    for (const s of all) {
      if (!s.completedAt) throw new Error("[A] completedAt null 포함");
    }
    // 완료일 내림차순 정렬 확인
    const dates = all.map((s) => s.completedAt!.getTime());
    for (let i = 1; i < dates.length; i++) {
      if (dates[i - 1]! < dates[i]!)
        throw new Error(`[A] 정렬 오류 (desc 기대)`);
    }
    console.log(`✓ [A] 기본 조회 3건, completedAt desc 정렬`);

    // ─── B. clientId 필터 ──────────────────────────
    const byClient = await listShipmentHistoryInline({
      clientId: otherClient.id,
      q: `SMOKE-H-${rand}`,
    });
    if (byClient.length !== 2)
      throw new Error(`[B] 기대 2건, 실제 ${byClient.length}`);
    for (const s of byClient) {
      if (s.order.client.id !== otherClient.id)
        throw new Error(`[B] 다른 거래처 혼입`);
    }
    console.log(`✓ [B] clientId 필터 → 2건 (${otherClient.code})`);

    // ─── C. 기간 필터 ──────────────────────────────
    const mid = new Date(now.getTime() - 15 * 24 * 3600_000); // 15일 전
    // from=mid → 15일 이후 완료 (10일 전, 1일 전 = 2건)
    const fromFiltered = await listShipmentHistoryInline({
      from: mid,
      q: `SMOKE-H-${rand}`,
    });
    if (fromFiltered.length !== 2)
      throw new Error(`[C] from 필터 기대 2건, 실제 ${fromFiltered.length}`);
    // to=mid → 15일 이전 완료 (30일 전 = 1건)
    const toFiltered = await listShipmentHistoryInline({
      to: mid,
      q: `SMOKE-H-${rand}`,
    });
    if (toFiltered.length !== 1)
      throw new Error(`[C] to 필터 기대 1건, 실제 ${toFiltered.length}`);
    console.log(`✓ [C] 기간 필터 (from→2건, to→1건)`);

    // ─── D. q 필터 ─────────────────────────────────
    // 주문번호 prefix 검색
    const byOrderNum = await listShipmentHistoryInline({
      q: `SMOKE-H-${rand}-1`,
    });
    if (byOrderNum.length !== 1)
      throw new Error(`[D] orderNumber 기대 1건, 실제 ${byOrderNum.length}`);
    // 거래처 코드 prefix 검색 → 모두 같은 rand prefix 이므로 3건
    const byClientCode = await listShipmentHistoryInline({
      q: otherClient.code,
    });
    const hasAll = byClientCode.filter((s) => orderIds.includes(s.order.id));
    // otherClient 로 만든 2건만 이 코드에 매치되어야
    const matchedOur = hasAll.filter(
      (s) => s.order.client.id === otherClient.id,
    );
    if (matchedOur.length !== 2)
      throw new Error(
        `[D] clientCode 필터 기대 2건, 실제 ${matchedOur.length}`,
      );
    console.log(
      `✓ [D] q 필터 (orderNumber=1건 · clientCode=${matchedOur.length}건 매치)`,
    );

    // ─── E. CSV 포맷 ────────────────────────────────
    const csv = buildCsv(all);
    if (csv.header.length !== 13)
      throw new Error(`[E] 헤더 컬럼 수: ${csv.header.length}`);
    if (!csv.body.startsWith("\uFEFF"))
      throw new Error("[E] UTF-8 BOM 누락");
    const expectedRows = all.reduce((s, x) => s + x.order.items.length, 0);
    if (csv.rows.length !== expectedRows)
      throw new Error(
        `[E] 행수 불일치: csv=${csv.rows.length}, items=${expectedRows}`,
      );
    // 픽스처 shipToAddress 는 콤마 포함 → 쿼팅 되어야
    const hasQuoted = csv.body.includes('"서울 강남구, 테스트, 빌딩"');
    if (!hasQuoted) throw new Error("[E] 콤마 포함 값 quoting 실패");
    console.log(
      `✓ [E] CSV (header=13, rows=${csv.rows.length}, BOM ✓, quoting ✓)`,
    );

    console.log(`\n✅ Shipment History 스모크 통과.`);
  } finally {
    await cleanupFixtures(orderIds);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
