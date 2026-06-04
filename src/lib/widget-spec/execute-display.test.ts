import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {
  invoice: { groupBy: vi.fn() }, client: { findMany: vi.fn() },
}}));
import { prisma } from "@/lib/prisma";
import { executeWidgetSpec } from "./execute";

beforeEach(() => vi.clearAllMocks());
it("groupBy clientId → 거래처명 라벨", async () => {
  (prisma.invoice.groupBy as any).mockResolvedValue([
    { clientId: "c1", _sum: { totalAmount: 100 } },
    { clientId: "c2", _sum: { totalAmount: 50 } },
  ]);
  (prisma.client.findMany as any).mockResolvedValue([
    { id: "c1", name: "메디칼" }, { id: "c2", name: "한빛" },
  ]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"hbar", data:{ source:"invoice", aggregate:{type:"sum",field:"totalAmount"}, groupBy:["clientId"] } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(r.series!.map(s=>s.label)).toEqual(["메디칼","한빛"]);
  expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: { in: ["c1","c2"] } }, select: { id: true, name: true } }));
});
it("resolver 없는 groupBy(status)는 값 유지", async () => {
  (prisma.invoice.groupBy as any).mockResolvedValue([{ status:"ISSUED", _count: 3 }]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"bar", data:{ source:"invoice", groupBy:["status"] } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(r.series![0]?.label).toBe("ISSUED");
});
it("table 위젯은 displayColumns 로 큐레이트 + 관계 이름", async () => {
  vi.mocked((prisma as any).order = { findMany: vi.fn() });
  ((prisma as any).order.findMany as any).mockResolvedValue([
    { id:"o1", orderNumber:"ORD-1", clientId:"c1", client:{name:"메디칼"}, status:"COMPLETED", orderDate:new Date("2026-06-01T00:00:00Z"), note:"x", billingMonth:"2026-06" },
  ]);
  const r = await executeWidgetSpec(
    { version:"1.0", title:"x", kind:"table", data:{ source:"order", limit:5 } } as any,
    { now: new Date(), userId:"u", role:"ADMIN" });
  expect(Object.keys(r.rows![0]!)).toEqual(["주문번호","거래처","상태","주문일"]);
  expect(r.rows![0]!["거래처"]).toBe("메디칼");
  expect((prisma as any).order.findMany).toHaveBeenCalledWith(expect.objectContaining({
    include: { client: { select: { name: true } } } }));
});
