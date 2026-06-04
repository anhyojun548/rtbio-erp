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
