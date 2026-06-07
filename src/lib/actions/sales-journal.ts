/**
 * 매출장(거래명세서 기준) 서버 조회 — 경영지원 매입매출장의 매출 탭.
 *
 * 매출 인식 기준: 대시보드/매출보고서/거래처원장과 동일하게 **거래명세서 발급(ISSUED/SENT)**.
 *  - 기간 필터는 매출 발생일 = invoice.issueDate 기준.
 *  - 라인은 명세서에 연결된 주문(order.items)을 우선, 없으면 InvoiceItem, 그것도 없으면 명세서 합계 1줄.
 *  - 클라이언트 200건 로드 한계를 제거하기 위해 서버에서 직접 기간 조회(상한 limit).
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

/** UTC 로 저장된 Date → KST(UTC+9) 달력 날짜 YYYY-MM-DD (서버 타임존 무관) */
function kstYmd(d: Date): string {
  return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export type SalesJournalLine = {
  date: string; // YYYY-MM-DD (issueDate)
  invoiceNumber: string;
  orderId: string | null;
  clientId: string;
  client: string;
  rep: string;
  item: string;
  qty: number;
  unitPrice: number;
  supply: number; // 공급가액(라인)
};

export type SalesJournalResult = {
  lines: SalesJournalLine[];
  invoiceCount: number;
  truncated: boolean; // limit 초과로 잘렸는지
};

export async function getSalesJournal(input: {
  from?: string;
  to?: string;
  clientId?: string;
  q?: string;
  limit?: number;
}): Promise<SalesJournalResult> {
  await requireRole("TENANT_OWNER", "ADMIN");

  const limit = Math.min(Math.max(input.limit ?? 3000, 1), 5000);
  // KST(UTC+9) 기준 일자 경계 — 서버 타임존과 무관하게 한국 날짜로 해석.
  const from = input.from ? new Date(input.from + "T00:00:00+09:00") : undefined;
  const toEx = input.to
    ? new Date(new Date(input.to + "T00:00:00+09:00").getTime() + 86400000) // 종료일 포함(다음날 00:00 KST 미만)
    : undefined;

  const where: {
    status: { in: ("ISSUED" | "SENT")[] };
    issueDate?: { gte?: Date; lt?: Date };
    clientId?: string;
  } = { status: { in: ["ISSUED", "SENT"] } };
  if (from || toEx) where.issueDate = { ...(from ? { gte: from } : {}), ...(toEx ? { lt: toEx } : {}) };
  if (input.clientId) where.clientId = input.clientId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, code: true, salesRepId: true } },
      order: { include: { items: { include: { product: { select: { name: true } } } } } },
      items: true,
    },
    orderBy: { issueDate: "desc" },
    take: limit,
  });
  const truncated = invoices.length === limit;

  // 담당 영업사원 이름 (Client.salesRepId → public.User.name)
  const repIds = [
    ...new Set(invoices.map((i) => i.client?.salesRepId).filter((x): x is string => !!x)),
  ];
  const reps = repIds.length
    ? await prisma.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true } })
    : [];
  const repMap = new Map(reps.map((r) => [r.id, r.name]));

  const q = (input.q || "").toLowerCase().trim();
  const lines: SalesJournalLine[] = [];
  for (const inv of invoices) {
    const rep = inv.client?.salesRepId ? repMap.get(inv.client.salesRepId) || "-" : "-";
    const base = {
      date: kstYmd(inv.issueDate),
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId,
      clientId: inv.clientId,
      client: inv.client?.name || inv.clientId,
      rep,
    };
    const oItems = inv.order?.items ?? [];
    if (oItems.length) {
      for (const it of oItems) {
        const unitPrice = Number(it.unitPrice);
        lines.push({
          ...base,
          item: it.product?.name || it.productId,
          qty: it.quantity,
          unitPrice,
          supply: unitPrice * it.quantity,
        });
      }
    } else if (inv.items.length) {
      for (const it of inv.items) {
        lines.push({
          ...base,
          item: it.description,
          qty: it.quantity,
          unitPrice: Number(it.unitPrice),
          supply: Number(it.amount),
        });
      }
    } else {
      lines.push({ ...base, item: "(거래명세서)", qty: 1, unitPrice: Number(inv.supplyAmount), supply: Number(inv.supplyAmount) });
    }
  }

  const filtered = q
    ? lines.filter((l) => l.item.toLowerCase().includes(q) || l.client.toLowerCase().includes(q))
    : lines;

  return { lines: filtered, invoiceCount: invoices.length, truncated };
}
