/**
 * 거래처용 거래명세서 PDF — /client/invoices/{id}/pdf
 *
 * requireClient + 본인 거래처 소유 확인.
 * DRAFT 는 거부 (ISSUED/SENT/CANCELLED 만 허용).
 */
import { NextResponse } from "next/server";
import { requireClient } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  InvoicePdfDocument,
  type InvoicePdfData,
} from "@/components/admin/invoices/InvoicePdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPLIER = {
  name: "알티바이오",
  businessNumber: "000-00-00000",
  representative: "김대표",
  address: "서울특별시 강남구 테헤란로 123",
  phone: "02-0000-0000",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await requireClient();

  const inv = await prisma.invoice.findFirst({
    where: {
      id: params.id,
      clientId: user.clientId,
      status: { in: ["ISSUED", "SENT", "CANCELLED"] },
    },
    include: {
      client: true,
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: InvoicePdfData = {
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    note: inv.note,
    supplyAmount: inv.supplyAmount.toString(),
    vatAmount: inv.vatAmount.toString(),
    totalAmount: inv.totalAmount.toString(),
    supplier: SUPPLIER,
    client: {
      name: inv.client.name,
      code: inv.client.code,
      businessNumber: inv.client.businessNumber,
      representative: inv.client.representative,
      phone: inv.client.phone,
      address: inv.client.address,
    },
    items: inv.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice.toString(),
      amount: it.amount.toString(),
    })),
  };

  const buffer = await renderToBuffer(<InvoicePdfDocument data={data} />);

  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);

  return new Response(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(inv.invoiceNumber)}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
