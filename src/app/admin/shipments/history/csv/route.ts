/**
 * 출고내역 CSV export — Phase 3D-4b (R17).
 *
 * Query: clientId, from, to, q — history 페이지와 동일 스펙.
 * CSV UTF-8 BOM 포함 (엑셀 한글 호환).
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/session";
import { listShipmentHistory } from "@/lib/actions/shipment";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s: string | null, endOfDay = false): Date | undefined {
  if (!s || !DATE_RE.test(s)) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  await requireRole("TENANT_OWNER", "ADMIN", "QC");

  const sp = req.nextUrl.searchParams;
  const clientId = sp.get("clientId") || undefined;
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"), true);
  const q = sp.get("q")?.trim() || undefined;

  const shipments = await listShipmentHistory({
    clientId,
    from,
    to,
    q,
    limit: 5000,
  });

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

  const lines: string[] = [header.map(esc).join(",")];

  for (const s of shipments) {
    const completedAt = s.completedAt
      ? new Date(s.completedAt).toISOString().slice(0, 19).replace("T", " ")
      : "";
    const orderDate = new Date(s.order.orderDate).toISOString().slice(0, 10);
    for (const it of s.order.items) {
      lines.push(
        [
          esc(completedAt),
          esc(s.order.orderNumber),
          esc(orderDate),
          esc(s.order.client.code),
          esc(s.order.client.name),
          esc(it.product.code),
          esc(it.product.name),
          esc(it.productSize?.sizeCode ?? ""),
          esc(it.quantity),
          esc(Number(it.lineTotal ?? 0)),
          esc(s.order.shipToRecipient ?? ""),
          esc(s.order.shipToAddress ?? ""),
          esc(s.order.billingMonth ?? ""),
        ].join(","),
      );
    }
  }

  // UTF-8 BOM + CRLF 로 엑셀 친화 포맷
  const BOM = "\uFEFF";
  const body = BOM + lines.join("\r\n") + "\r\n";

  const today = new Date().toISOString().slice(0, 10);
  const filename = `shipment-history-${today}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
