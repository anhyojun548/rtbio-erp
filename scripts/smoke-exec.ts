/**
 * Phase 3F-1 스모크 — 영업 포털(EXEC) 의 row-level 필터 정확성.
 *
 * 시나리오:
 *   A. 두 명의 EXEC 유저(me / other) 생성.
 *   B. 3개 Client 생성:
 *      - C1: salesRepId = me (직접 담당)
 *      - C2: salesRepId = other, SalesAssignment(me, active=true) (복수 배정)
 *      - C3: salesRepId = other, SalesAssignment(me, active=false) (비활성 — 제외돼야 함)
 *   C. getMyClientIds(me) 로직 재현 → {C1, C2} 만 나와야 함 (C3 제외).
 *   D. 주문 3건(각 Client 에 1건) 생성 → listMyOrders(me) 재현 시 C1/C2 만.
 *   E. Invoice 3건 생성 (이번 달, ISSUED/SENT) → thisMonthSales 합산 시 C1+C2 만 포함.
 *   F. other 기준 조회 — C3 만 반환 (대리 조회 시나리오).
 *
 * 실행: `npx tsx scripts/smoke-exec.ts`
 */
import { prisma } from "../src/lib/prisma";

const PREFIX = `SMOKE_EXEC_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

async function getMyClientIds(salesRepId: string): Promise<string[]> {
  const [direct, assigned] = await Promise.all([
    prisma.client.findMany({
      where: { salesRepId, active: true },
      select: { id: true },
    }),
    prisma.salesAssignment.findMany({
      where: { salesRepId, active: true, client: { active: true } },
      select: { clientId: true },
    }),
  ]);
  const set = new Set<string>();
  for (const c of direct) set.add(c.id);
  for (const a of assigned) set.add(a.clientId);
  return [...set];
}

async function cleanup() {
  // 역방향 dependency 순서: Invoice → Order → SalesAssignment → Client → User
  await prisma.invoice.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.orderItem.deleteMany({
    where: { order: { client: { code: { startsWith: PREFIX } } } },
  });
  await prisma.order.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.salesAssignment.deleteMany({
    where: { client: { code: { startsWith: PREFIX } } },
  });
  await prisma.client.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: PREFIX.toLowerCase() } },
  });
}

async function main() {
  console.log(`[smoke-exec] prefix=${PREFIX}`);
  await cleanup();

  const tenant = await prisma.tenant.findFirst({
    where: { subdomain: "altibio" },
  });
  if (!tenant) throw new Error("altibio 테넌트 없음 — seed 먼저 돌려야 함");

  // ─── A. 유저 2명 ──────────────────────────────────────
  const me = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_me@test.local`,
      password: "x",
      name: "영업 A",
      role: "EXEC",
      tenantId: tenant.id,
    },
    select: { id: true, email: true },
  });
  const other = await prisma.user.create({
    data: {
      email: `${PREFIX.toLowerCase()}_other@test.local`,
      password: "x",
      name: "영업 B",
      role: "EXEC",
      tenantId: tenant.id,
    },
    select: { id: true, email: true },
  });
  console.log(`✅ A. users me=${me.id.slice(0, 6)} other=${other.id.slice(0, 6)}`);

  // ─── B. 3개 Client ────────────────────────────────────
  const c1 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C1`,
      name: "직접담당 병원",
      type: "HOSPITAL",
      salesRepId: me.id,
    },
    select: { id: true },
  });
  const c2 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C2`,
      name: "복수배정 병원",
      type: "HOSPITAL",
      salesRepId: other.id,
    },
    select: { id: true },
  });
  const c3 = await prisma.client.create({
    data: {
      code: `${PREFIX}_C3`,
      name: "타인 병원",
      type: "HOSPITAL",
      salesRepId: other.id,
    },
    select: { id: true },
  });

  await prisma.salesAssignment.create({
    data: { clientId: c2.id, salesRepId: me.id, active: true },
  });
  // me 에게 c3 배정은 비활성 — 필터에서 제외돼야
  await prisma.salesAssignment.create({
    data: { clientId: c3.id, salesRepId: me.id, active: false },
  });
  console.log(`✅ B. clients C1/C2/C3 + assignments`);

  // ─── C. getMyClientIds 검증 ───────────────────────────
  const myIds = await getMyClientIds(me.id);
  if (!myIds.includes(c1.id) || !myIds.includes(c2.id))
    throw new Error(`[C] me 는 C1/C2 를 포함해야 함 — got ${myIds}`);
  if (myIds.includes(c3.id))
    throw new Error(`[C] me 가 C3 (비활성 배정) 을 포함 — union 필터 버그`);
  if (myIds.length !== 2)
    throw new Error(`[C] 정확히 2건 기대 — got ${myIds.length}`);
  console.log(`✅ C. me 의 clientIds = {C1, C2} (C3 제외)`);

  const otherIds = await getMyClientIds(other.id);
  if (!otherIds.includes(c2.id) || !otherIds.includes(c3.id))
    throw new Error(`[C] other 는 C2/C3 를 포함해야 함 — got ${otherIds}`);
  if (otherIds.includes(c1.id))
    throw new Error(`[C] other 가 C1 (me 직접담당) 을 포함`);
  console.log(`✅ C. other 의 clientIds = {C2, C3} (C1 제외)`);

  // ─── D. 주문 3건 ───────────────────────────────────────
  const now = new Date();
  const o1 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}-O1`,
      clientId: c1.id,
      orderDate: now,
      status: "DRAFT",
    },
    select: { id: true },
  });
  const o2 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}-O2`,
      clientId: c2.id,
      orderDate: now,
      status: "DRAFT",
    },
    select: { id: true },
  });
  const o3 = await prisma.order.create({
    data: {
      orderNumber: `${PREFIX}-O3`,
      clientId: c3.id,
      orderDate: now,
      status: "DRAFT",
    },
    select: { id: true },
  });

  // listMyOrders 재현 — clientId IN myIds
  const myOrders = await prisma.order.findMany({
    where: { clientId: { in: myIds } },
    select: { id: true, orderNumber: true, clientId: true },
  });
  const myOrderIds = myOrders.map((o) => o.id);
  if (!myOrderIds.includes(o1.id) || !myOrderIds.includes(o2.id))
    throw new Error(`[D] me 주문에 O1/O2 포함돼야 함`);
  if (myOrderIds.includes(o3.id))
    throw new Error(`[D] me 주문에 O3 포함됨 — 필터 버그`);
  console.log(`✅ D. me 주문 = {O1, O2} (O3 제외)`);

  // ─── E. Invoice 3건 (이번 달, ISSUED/SENT) ─────────────
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV1`,
      clientId: c1.id,
      orderId: o1.id,
      issueDate: now,
      status: "ISSUED",
      supplyAmount: 10000,
      vatAmount: 1000,
      totalAmount: 11000,
    },
    select: { id: true },
  });
  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV2`,
      clientId: c2.id,
      orderId: o2.id,
      issueDate: now,
      status: "SENT",
      supplyAmount: 20000,
      vatAmount: 2000,
      totalAmount: 22000,
    },
    select: { id: true },
  });
  await prisma.invoice.create({
    data: {
      invoiceNumber: `${PREFIX}-INV3`,
      clientId: c3.id,
      orderId: o3.id,
      issueDate: now,
      status: "ISSUED",
      supplyAmount: 30000,
      vatAmount: 3000,
      totalAmount: 33000,
    },
  });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const myInvoices = await prisma.invoice.findMany({
    where: {
      clientId: { in: myIds },
      issueDate: { gte: monthStart, lt: nextMonth },
      status: { in: ["ISSUED", "SENT"] },
    },
    select: { totalAmount: true },
  });
  const myMonthSales = myInvoices.reduce(
    (s, inv) => s + Number(inv.totalAmount),
    0,
  );
  const expected = 11000 + 22000;
  if (myMonthSales !== expected)
    throw new Error(
      `[E] me 이달 매출 ${expected} 기대, 실제 ${myMonthSales}`,
    );
  console.log(
    `✅ E. me 이달 매출 = ₩${myMonthSales.toLocaleString()} (C1+C2, C3 제외)`,
  );

  // ─── F. other 대리 조회 — C3 만 (C2 는 me 가 액티브 배정) ──────
  // 주의: other 의 getMyClientIds = {C2, C3} (C2 salesRepId=other, C3 salesRepId=other)
  //   → me 기준 필터와 겹침(C2)이지만 union 로직상 정상
  const otherInvoices = await prisma.invoice.findMany({
    where: {
      clientId: { in: otherIds },
      issueDate: { gte: monthStart, lt: nextMonth },
      status: { in: ["ISSUED", "SENT"] },
    },
    select: { totalAmount: true },
  });
  const otherMonthSales = otherInvoices.reduce(
    (s, inv) => s + Number(inv.totalAmount),
    0,
  );
  const expectedOther = 22000 + 33000; // C2 + C3
  if (otherMonthSales !== expectedOther)
    throw new Error(
      `[F] other 이달 매출 ${expectedOther} 기대, 실제 ${otherMonthSales}`,
    );
  console.log(
    `✅ F. other 이달 매출 = ₩${otherMonthSales.toLocaleString()} (C2+C3)`,
  );

  // 실제 inv 객체 참조(린트 silencer)
  void inv1;
  void inv2;

  console.log("\n[smoke-exec] all scenarios passed ✅");
}

main()
  .catch(async (e) => {
    console.error("❌", e);
    await cleanup();
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
