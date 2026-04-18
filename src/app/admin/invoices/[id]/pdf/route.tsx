/**
 * 거래명세서 PDF 라우트 핸들러.
 *   GET /admin/invoices/{id}/pdf
 *
 * @react-pdf/renderer 의 `renderToBuffer` 로 PDF 바이너리 생성.
 * Response 스트림으로 직접 반환 (Content-Disposition: inline → 브라우저 내 미리보기).
 *
 * RBAC: requireRole("TENANT_OWNER", "ADMIN").
 * CANCELLED 상태도 PDF 출력 허용 (감사/기록 목적).
 *
 * 런타임: Node.js — @react-pdf/renderer 는 Edge 런타임에서 동작 X.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  InvoicePdfDocument,
  type InvoicePdfData,
} from "@/components/admin/invoices/InvoicePdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 공급자 정보 — 테넌트 설정 기반이 이상적이나 Phase 3D-3a 단계에서는 하드코딩.
// TODO(3D-3b): TenantSetting 에서 로드하도록 변경.
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
  await requireRole("TENANT_OWNER", "ADMIN");

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
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

  // ArrayBuffer 로 변환 (Node Buffer → Response 직접 전달도 되지만 타입 안정성 위해).
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
