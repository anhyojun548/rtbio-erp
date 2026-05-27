/**
 * /api/client-portal/bootstrap
 *
 * CLIENT 포털(`/portals/client-portal.html`) 의 prototype JS 가
 * window.CLIENTS / PRODUCTS / ORDERS / INVOICES 등을 한 번에 받기 위한 단일 endpoint.
 *
 * 기존 /api/clients, /api/orders, /api/products 등은 admin/exec/qc 전용
 * (requireRole 로 CLIENT 차단). 그래서 CLIENT 유저가 client-portal.html 에 들어왔을 때
 * 모든 endpoint 가 /403 으로 redirect 되어 prototype 데이터가 비어 있었다.
 *
 * 이 엔드포인트는:
 *   - 본인 거래처 1건 (window.CLIENTS = [client])
 *   - 전체 active 제품 (window.PRODUCTS — 발주를 위해 필요)
 *   - 본인 주문 (window.ORDERS)
 *   - 본인 거래명세서 (window.INVOICE_HISTORY / INVOICES)
 *   - 본인 수금 (window.RECEIVABLES / PAYMENTS)
 *   - 본인 원장 (window.LEDGERS)
 *   - 본인 대상 공지 (window.NOTICES)
 * 를 한 번에 반환한다.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const u = session.user as {
    id: string;
    email: string;
    name: string;
    role: string;
    clientId: string | null;
  };

  if (u.role !== "CLIENT" || !u.clientId) {
    return Response.json(
      { ok: false, error: "CLIENT role + clientId required" },
      { status: 403 },
    );
  }

  const clientId = u.clientId;

  // 병렬 조회
  const [
    client,
    products,
    orders,
    invoices,
    payments,
    ledgers,
    notices,
  ] = await Promise.all([
    // 본인 거래처
    prisma.client.findUnique({
      where: { id: clientId },
      include: {
        addresses: { where: { active: true }, orderBy: { isDefault: "desc" } },
        discounts: true,
        fixedPrices: true,
      },
    }),

    // 전체 active 제품 (발주를 위해 필요)
    prisma.product.findMany({
      where: { active: true },
      include: { sizes: true },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),

    // 본인 주문 (DRAFT 제외 — submitted 이상만)
    prisma.order.findMany({
      where: { clientId, status: { not: "DRAFT" } },
      include: {
        items: true,
        shipments: { include: { currentStage: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { orderDate: "desc" },
      take: 200,
    }),

    // 본인 거래명세서 (DRAFT 제외)
    prisma.invoice.findMany({
      where: { clientId, status: { not: "DRAFT" } },
      include: { items: true },
      orderBy: { issueDate: "desc" },
      take: 100,
    }),

    // 본인 수금 (PENDING/취소 제외)
    prisma.payment.findMany({
      where: { clientId, status: { in: ["PARTIAL", "PAID", "OVERDUE"] } },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),

    // 본인 원장 (최근 24개월)
    prisma.closingLedger.findMany({
      where: { clientId },
      orderBy: { closingMonth: "desc" },
      take: 24,
    }),

    // 공지 — 본인 대상 필터링 (DB-level 1차 + 앱-level 2차)
    prisma.notice.findMany({
      where: { OR: [{ target: "ALL" }, { target: "DEALER" }, { target: "HOSPITAL" }, { target: "SPECIFIC" }] },
      include: { recipients: { select: { clientId: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!client) {
    return Response.json(
      { ok: false, error: "Client not found" },
      { status: 404 },
    );
  }

  // 공지 앱-level 필터: 만료된 것 제외 + 본인 type/id 매칭
  const todayStr = new Date().toISOString().slice(0, 10);
  const clientTypeKey = client.type === "HOSPITAL" ? "HOSPITAL" : client.type === "AGENCY" ? "DEALER" : null;
  const applicableNotices = notices
    .filter((n) => {
      if (n.expiresAt && n.expiresAt.toISOString().slice(0, 10) < todayStr) return false;
      if (n.target === "ALL") return true;
      if (n.target === clientTypeKey) return true;
      if (n.target === "SPECIFIC") {
        const recipients = (n as any).recipients as { clientId: string }[] | undefined;
        return Array.isArray(recipients) && recipients.some((r) => r.clientId === clientId);
      }
      return false;
    })
    // prototype 호환을 위해 targetIds 도 평탄화 — 기존 client-portal.html 의
    // 공지 필터링 분기에서 n.targetIds.includes(clientId) 패턴을 그대로 쓸 수 있도록.
    .map((n) => ({
      ...n,
      targetIds: Array.isArray((n as any).recipients)
        ? (n as any).recipients.map((r: { clientId: string }) => r.clientId)
        : [],
    }));

  return Response.json({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      clientId,
    },
    client,
    products,
    orders,
    invoices,
    payments,
    ledgers,
    notices: applicableNotices,
  });
}
